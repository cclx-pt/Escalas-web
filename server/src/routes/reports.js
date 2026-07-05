/**
 * routes/reports.js — relatórios de um mês: matriz de disponibilidade,
 * pendentes (quem não respondeu tudo), conflitos (escalado + indisponível)
 * e carga por voluntário.
 */
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'
import { monthLabel, sundaysOf } from '../lib/dates.js'

export const reportsRouter = Router()

reportsRouter.use(requireRole('admin', 'leader'))

// GET /data/reports/:monthId — relatório completo do mês.
reportsRouter.get(
  '/:monthId',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const month = await fetchMonth(req.params.monthId, churchId)
    const sundays = sundaysOf(month.year, month.month)

    const users = await pool.query(
      `SELECT id, name, email FROM users
       WHERE church_id = $1 AND is_active = TRUE AND approved_at IS NOT NULL
       ORDER BY name`,
      [churchId],
    )
    const availabilities = await pool.query(
      'SELECT user_id, sunday, status FROM availabilities WHERE month_id = $1',
      [req.params.monthId],
    )
    const assignments = await pool.query(
      `SELECT s.user_id, s.sunday, s.is_manual, p.name AS position_name, t.name AS team_name, t.color
       FROM assignments s
       JOIN positions p ON p.id = s.position_id
       JOIN teams t ON t.id = p.team_id
       WHERE s.month_id = $1`,
      [req.params.monthId],
    )

    // Índice disponibilidade user×sunday.
    const avail = new Map()
    for (const a of availabilities.rows) {
      const iso = toIso(a.sunday)
      if (!avail.has(a.user_id)) avail.set(a.user_id, {})
      avail.get(a.user_id)[iso] = a.status
    }

    // Matriz.
    const matrix = users.rows.map((u) => {
      const row = avail.get(u.id) || {}
      const responded = sundays.filter((s) => row[s]).length
      return {
        userId: u.id,
        name: u.name,
        cells: sundays.map((s) => ({ sunday: s, status: row[s] || null })),
        responded,
        missing: sundays.length - responded,
      }
    })

    // Pendentes (não responderam a tudo).
    const pending = matrix
      .filter((m) => m.missing > 0)
      .map((m) => ({ userId: m.userId, name: m.name, missing: m.missing, responded: m.responded }))

    // Conflitos (escalado num domingo em que se marcou indisponível).
    const nameById = new Map(users.rows.map((u) => [u.id, u.name]))
    const conflicts = []
    for (const a of assignments.rows) {
      const iso = toIso(a.sunday)
      if (avail.get(a.user_id)?.[iso] === 'unavailable') {
        conflicts.push({
          userId: a.user_id,
          name: nameById.get(a.user_id) ?? '—',
          sunday: iso,
          team: a.team_name,
          position: a.position_name,
          isManual: a.is_manual,
        })
      }
    }

    // Carga por voluntário.
    const workloadMap = new Map()
    for (const a of assignments.rows) {
      workloadMap.set(a.user_id, (workloadMap.get(a.user_id) ?? 0) + 1)
    }
    const workload = [...workloadMap.entries()]
      .map(([userId, count]) => ({ userId, name: nameById.get(userId) ?? '—', count }))
      .sort((a, b) => b.count - a.count)

    res.json({
      month: { id: month.id, label: monthLabel(month.year, month.month), status: month.status },
      sundays,
      matrix,
      pending,
      conflicts,
      workload,
    })
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

function toIso(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}
