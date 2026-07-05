/**
 * routes/months.js — meses e máquina de estados.
 *
 * Estados: draft -> availability_open -> scheduling -> final.
 * Transições para trás apagam os dados dependentes (disponibilidades e/ou
 * escalações), para manter a coerência.
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'
import { monthLabel, sundaysOf } from '../lib/dates.js'

export const monthsRouter = Router()

const manage = requireRole('admin')
const STATUS = ['draft', 'availability_open', 'scheduling', 'final']
const ORDER = { draft: 0, availability_open: 1, scheduling: 2, final: 3 }

const mapMonth = (r) => ({
  id: r.id,
  year: r.year,
  month: r.month,
  label: monthLabel(r.year, r.month),
  status: r.status,
  sundays: sundaysOf(r.year, r.month),
  createdAt: r.created_at,
  availabilityOpenedAt: r.availability_opened_at,
  schedulingStartedAt: r.scheduling_started_at,
  publishedAt: r.published_at,
  availabilityCount: r.availability_count != null ? Number(r.availability_count) : undefined,
  assignmentCount: r.assignment_count != null ? Number(r.assignment_count) : undefined,
})

// GET /data/months?status=&sort= — lista meses.
monthsRouter.get(
  '/',
  requireRole('admin', 'leader'),
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const status = (req.query.status || '').toString().trim()
    const sort = (req.query.sort || 'desc').toString() === 'asc' ? 'ASC' : 'DESC'

    const params = [churchId]
    let where = 'm.church_id = $1'
    if (status && STATUS.includes(status)) {
      params.push(status)
      where += ` AND m.status = $${params.length}`
    }

    const { rows } = await pool.query(
      `SELECT m.*,
              (SELECT COUNT(*) FROM availabilities a WHERE a.month_id = m.id) AS availability_count,
              (SELECT COUNT(*) FROM assignments s WHERE s.month_id = m.id) AS assignment_count
       FROM months m
       WHERE ${where}
       ORDER BY m.year ${sort}, m.month ${sort}`,
      params,
    )
    res.json({ months: rows.map(mapMonth) })
  }),
)

const createSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
})

// POST /data/months — cria um mês.
monthsRouter.post(
  '/',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { year, month } = createSchema.parse(req.body)
    const dup = await pool.query(
      'SELECT id FROM months WHERE church_id = $1 AND year = $2 AND month = $3',
      [churchId, year, month],
    )
    if (dup.rows[0]) throw new HttpError(409, 'Esse mês já existe.')
    const { rows } = await pool.query(
      `INSERT INTO months (church_id, year, month, status) VALUES ($1, $2, $3, 'draft') RETURNING *`,
      [churchId, year, month],
    )
    res.status(201).json({ month: mapMonth(rows[0]) })
  }),
)

// POST /data/months/year — cria os 12 meses de um ano.
monthsRouter.post(
  '/year',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { year } = z.object({ year: z.number().int().min(2000).max(2100) }).parse(req.body)
    let created = 0
    await pool.withTransaction(async (client) => {
      for (let m = 1; m <= 12; m += 1) {
        const r = await client.query(
          `INSERT INTO months (church_id, year, month, status) VALUES ($1, $2, $3, 'draft')
           ON CONFLICT (church_id, year, month) DO NOTHING RETURNING id`,
          [churchId, year, m],
        )
        if (r.rows[0]) created += 1
      }
    })
    res.status(201).json({ ok: true, created })
  }),
)

// POST /data/months/delete-drafts — apaga todos os meses em rascunho.
monthsRouter.post(
  '/delete-drafts',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { rowCount } = await pool.query(
      `DELETE FROM months WHERE church_id = $1 AND status = 'draft'`,
      [churchId],
    )
    res.json({ ok: true, deleted: rowCount })
  }),
)

// GET /data/months/:id — detalhe + relatório de pendentes por equipa.
monthsRouter.get(
  '/:id',
  requireRole('admin', 'leader'),
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Mês')
    const month = await fetchMonth(req.params.id, churchId)

    // Relatório de pendentes: por equipa, quantos membros ainda não responderam
    // a todos os domingos.
    const sundays = sundaysOf(month.year, month.month)
    const teams = await pool.query(
      `SELECT t.id, t.name, t.color,
              COUNT(DISTINCT tm.user_id) AS member_count
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id
       WHERE t.church_id = $1
       GROUP BY t.id ORDER BY t.sort_order, t.name`,
      [churchId],
    )

    const responded = await pool.query(
      `SELECT tm.team_id, COUNT(DISTINCT a.user_id) AS responded
       FROM team_members tm
       JOIN availabilities a ON a.user_id = tm.user_id AND a.month_id = $1
       JOIN teams t ON t.id = tm.team_id AND t.church_id = $2
       GROUP BY tm.team_id`,
      [req.params.id, churchId],
    )
    const respondedMap = new Map(responded.rows.map((r) => [r.team_id, Number(r.responded)]))

    const teamsReport = teams.rows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      memberCount: Number(t.member_count),
      respondedCount: respondedMap.get(t.id) ?? 0,
    }))

    res.json({ month: { ...mapMonth(month), sundays }, teamsReport })
  }),
)

const statusSchema = z.object({ status: z.enum(['draft', 'availability_open', 'scheduling', 'final']) })

// PATCH /data/months/:id/status — transição de estado.
monthsRouter.patch(
  '/:id/status',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Mês')
    const { status: target } = statusSchema.parse(req.body)
    const month = await fetchMonth(req.params.id, churchId)

    const goingBack = ORDER[target] < ORDER[month.status]

    await pool.withTransaction(async (client) => {
      // Limpeza de dados em transições para trás.
      if (target === 'draft') {
        await client.query('DELETE FROM assignments WHERE month_id = $1', [req.params.id])
        await client.query('DELETE FROM availabilities WHERE month_id = $1', [req.params.id])
      } else if (target === 'availability_open' && ORDER[month.status] >= ORDER.scheduling) {
        await client.query('DELETE FROM assignments WHERE month_id = $1', [req.params.id])
      }

      // Timestamps.
      const sets = ['status = $2']
      const params = [req.params.id, target]
      if (target === 'draft') {
        sets.push('availability_opened_at = NULL', 'scheduling_started_at = NULL', 'published_at = NULL')
      }
      if (target === 'availability_open') {
        sets.push('availability_opened_at = COALESCE(availability_opened_at, now())')
        sets.push('scheduling_started_at = NULL', 'published_at = NULL')
      }
      if (target === 'scheduling') {
        sets.push('scheduling_started_at = COALESCE(scheduling_started_at, now())', 'published_at = NULL')
      }
      if (target === 'final') {
        sets.push('published_at = now()')
      }
      await client.query(`UPDATE months SET ${sets.join(', ')} WHERE id = $1`, params)
    })

    const updated = await fetchMonth(req.params.id, churchId)
    res.json({ month: mapMonth(updated), wentBack: goingBack })
  }),
)

// DELETE /data/months/:id — apaga mês.
monthsRouter.delete(
  '/:id',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Mês')
    const { rowCount } = await pool.query('DELETE FROM months WHERE id = $1 AND church_id = $2', [
      req.params.id,
      churchId,
    ])
    if (!rowCount) throw new HttpError(404, 'Mês não encontrado.')
    res.json({ ok: true })
  }),
)

async function fetchMonth(id, churchId) {
  const { rows } = await pool.query('SELECT * FROM months WHERE id = $1 AND church_id = $2', [
    id,
    churchId,
  ])
  if (!rows[0]) throw new HttpError(404, 'Mês não encontrado.')
  return rows[0]
}
