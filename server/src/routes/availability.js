/**
 * routes/availability.js — disponibilidade do próprio utilizador por domingo.
 *
 * Editável apenas quando o mês está em `availability_open`. Fora disso, é
 * apresentada em modo leitura.
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireAuth } from '../middleware/auth.js'
import { monthLabel, sundaysOf } from '../lib/dates.js'

export const availabilityRouter = Router()

availabilityRouter.use(requireAuth)

// GET /data/availability — meses abertos/em curso para o utilizador.
availabilityRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { rows } = await pool.query(
      `SELECT m.*,
              (SELECT COUNT(*) FROM availabilities a WHERE a.month_id = m.id AND a.user_id = $2) AS my_count
       FROM months m
       WHERE m.church_id = $1 AND m.status IN ('availability_open', 'scheduling', 'final')
       ORDER BY m.year DESC, m.month DESC`,
      [churchId, req.user.sub],
    )
    res.json({
      months: rows.map((m) => ({
        id: m.id,
        year: m.year,
        month: m.month,
        label: monthLabel(m.year, m.month),
        status: m.status,
        sundayCount: sundaysOf(m.year, m.month).length,
        myResponses: Number(m.my_count),
      })),
    })
  }),
)

// GET /data/availability/:monthId — formulário do utilizador.
availabilityRouter.get(
  '/:monthId',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const month = await fetchMonth(req.params.monthId, churchId)
    const sundays = sundaysOf(month.year, month.month)

    const existing = await pool.query(
      'SELECT sunday, status FROM availabilities WHERE month_id = $1 AND user_id = $2',
      [req.params.monthId, req.user.sub],
    )
    const statusBySunday = {}
    for (const row of existing.rows) {
      statusBySunday[toIso(row.sunday)] = row.status
    }

    res.json({
      month: {
        id: month.id,
        label: monthLabel(month.year, month.month),
        status: month.status,
      },
      sundays,
      responses: statusBySunday,
      editable: month.status === 'availability_open',
    })
  }),
)

const saveSchema = z.object({
  responses: z.record(z.string(), z.enum(['available', 'unavailable'])),
})

// POST /data/availability/:monthId — grava a disponibilidade do utilizador.
availabilityRouter.post(
  '/:monthId',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const month = await fetchMonth(req.params.monthId, churchId)
    if (month.status !== 'availability_open') {
      throw new HttpError(409, 'As disponibilidades não estão abertas para este mês.')
    }
    const { responses } = saveSchema.parse(req.body)
    const validSundays = new Set(sundaysOf(month.year, month.month))

    await pool.withTransaction(async (client) => {
      for (const [sunday, status] of Object.entries(responses)) {
        if (!validSundays.has(sunday)) continue
        await client.query(
          `INSERT INTO availabilities (month_id, user_id, sunday, status)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (month_id, user_id, sunday)
           DO UPDATE SET status = EXCLUDED.status, submitted_at = now()`,
          [req.params.monthId, req.user.sub, sunday, status],
        )
      }
    })

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

function toIso(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}
