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
import { asyncHandler } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'

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
