/**
 * routes/dataImport.js — importação de equipas e voluntários por CSV.
 *
 * Recebe o conteúdo do CSV como texto (JSON `{ csv }`), separado por ';'.
 *  - Equipas: `nome_equipa;descricao`
 *  - Voluntários: `nome;email;equipas` (equipas separadas por vírgula)
 * A primeira linha é ignorada se parecer um cabeçalho.
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'
import { monthLabel, sundaysOf, parseImportDate } from '../lib/dates.js'

export const dataImportRouter = Router()

dataImportRouter.use(requireRole('admin'))

const bodySchema = z.object({ csv: z.string().min(1, 'CSV vazio.') })

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(';').map((c) => c.trim()))
}

function looksLikeHeader(cols, headerHints) {
  const first = (cols[0] || '').toLowerCase()
  return headerHints.some((h) => first.includes(h))
}

/** Normaliza um nome para comparação (sem acentos, minúsculas, espaços colapsados). */
function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// POST /data/import/teams — cria equipas a partir de CSV.
dataImportRouter.post(
  '/teams',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { csv } = bodySchema.parse(req.body)
    const rows = parseCsv(csv)
    if (rows.length && looksLikeHeader(rows[0], ['nome', 'equipa', 'name'])) rows.shift()

    let created = 0
    const skipped = []
    await pool.withTransaction(async (client) => {
      for (const [name, description] of rows) {
        if (!name) continue
        const r = await client.query(
          `INSERT INTO teams (church_id, name, description) VALUES ($1, $2, $3)
           ON CONFLICT (church_id, name) DO NOTHING RETURNING id`,
          [churchId, name, description || null],
        )
        if (r.rows[0]) created += 1
        else skipped.push(name)
      }
    })
    res.json({ ok: true, created, skipped })
  }),
)

// POST /data/import/users — cria voluntários (e liga a equipas) a partir de CSV.
dataImportRouter.post(
  '/users',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { csv } = bodySchema.parse(req.body)
    const rows = parseCsv(csv)
    if (rows.length && looksLikeHeader(rows[0], ['nome', 'name', 'email'])) rows.shift()

    // Mapa de equipas existentes (por nome, minúsculas).
    const teams = await pool.query('SELECT id, name FROM teams WHERE church_id = $1', [churchId])
    const teamByName = new Map(teams.rows.map((t) => [t.name.toLowerCase(), t.id]))

    let created = 0
    const skipped = []
    const errors = []

    await pool.withTransaction(async (client) => {
      for (const cols of rows) {
        const [name, emailRaw, teamsCol] = cols
        const email = (emailRaw || '').toLowerCase().trim()
        if (!name || !email) {
          skipped.push(cols.join(';'))
          continue
        }

        const dup = await client.query('SELECT id FROM users WHERE email = $1', [email])
        if (dup.rows[0]) {
          skipped.push(email)
          continue
        }

        const inserted = await client.query(
          `INSERT INTO users (church_id, name, email, role, is_active, approved_at)
           VALUES ($1, $2, $3, 'volunteer', TRUE, now()) RETURNING id`,
          [churchId, name, email],
        )
        const userId = inserted.rows[0].id
        created += 1

        const teamNames = (teamsCol || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10)
        for (const tn of teamNames) {
          const teamId = teamByName.get(tn.toLowerCase())
          if (teamId) {
            await client.query(
              'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [teamId, userId],
            )
          } else {
            errors.push(`Equipa desconhecida "${tn}" para ${email}`)
          }
        }
      }
    })

    res.json({ ok: true, created, skipped, errors })
  }),
)

const availabilitiesSchema = z.object({
  csv: z.string().min(1, 'CSV vazio.'),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  markUnavailable: z.boolean().optional().default(true),
})

// POST /data/import/availabilities — importa disponibilidades (nome + até 5 datas).
// Pede o mês (ano/mês) e valida que já está criado nesta igreja.
dataImportRouter.post(
  '/availabilities',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { csv, year, month, markUnavailable } = availabilitiesSchema.parse(req.body)

    // Valida que o mês está criado nesta igreja.
    const monthRes = await pool.query(
      'SELECT id FROM months WHERE church_id = $1 AND year = $2 AND month = $3',
      [churchId, year, month],
    )
    if (!monthRes.rows[0]) {
      throw new HttpError(404, `O mês ${monthLabel(year, month)} ainda não está criado.`)
    }
    const monthId = monthRes.rows[0].id
    const sundays = sundaysOf(year, month)
    const sundaySet = new Set(sundays)

    const rows = parseCsv(csv)
    if (
      rows.length &&
      looksLikeHeader(rows[0], ['nome', 'name', 'voluntario', 'volunteer', 'cooperador', 'cooperator'])
    ) {
      rows.shift()
    }

    // Mapa nome -> ids de utilizadores ativos (deteta homónimos).
    const usersRes = await pool.query(
      'SELECT id, name FROM users WHERE church_id = $1 AND is_active = TRUE',
      [churchId],
    )
    const idsByName = new Map()
    for (const u of usersRes.rows) {
      const key = normalizeName(u.name)
      if (!idsByName.has(key)) idsByName.set(key, [])
      idsByName.get(key).push(u.id)
    }

    let processed = 0
    let availableMarked = 0
    let unavailableMarked = 0
    const notFound = []
    const ambiguous = []
    const errors = []

    await pool.withTransaction(async (client) => {
      for (const cols of rows) {
        const name = (cols[0] || '').trim()
        if (!name) continue

        const matches = idsByName.get(normalizeName(name)) || []
        if (matches.length === 0) {
          notFound.push(name)
          continue
        }
        if (matches.length > 1) {
          ambiguous.push(name)
          continue
        }
        const userId = matches[0]

        // Datas listadas -> domingos disponíveis (até 5).
        const availableSundays = new Set()
        for (const token of cols.slice(1, 6).map((c) => c.trim()).filter(Boolean)) {
          const iso = parseImportDate(token, year, month)
          if (!iso) {
            errors.push(`Data inválida "${token}" (${name})`)
            continue
          }
          if (!sundaySet.has(iso)) {
            errors.push(`${token} não é um domingo de ${monthLabel(year, month)} (${name})`)
            continue
          }
          availableSundays.add(iso)
        }

        processed += 1

        for (const sunday of sundays) {
          const isAvailable = availableSundays.has(sunday)
          if (!isAvailable && !markUnavailable) continue
          await client.query(
            `INSERT INTO availabilities (month_id, user_id, sunday, status)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (month_id, user_id, sunday)
             DO UPDATE SET status = EXCLUDED.status, submitted_at = now()`,
            [monthId, userId, sunday, isAvailable ? 'available' : 'unavailable'],
          )
          if (isAvailable) availableMarked += 1
          else unavailableMarked += 1
        }
      }
    })

    res.json({
      ok: true,
      processed,
      availableMarked,
      unavailableMarked,
      notFound,
      ambiguous,
      errors,
    })
  }),
)
