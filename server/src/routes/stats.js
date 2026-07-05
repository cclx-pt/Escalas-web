/**
 * routes/stats.js — visão geral de estatísticas da igreja ativa.
 */
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'

export const statsRouter = Router()

statsRouter.use(requireRole('admin', 'leader'))

// GET /data/stats — totais e distribuições.
statsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)

    const totals = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE church_id = $1 AND is_active = TRUE AND approved_at IS NOT NULL) AS volunteers,
         (SELECT COUNT(*) FROM teams WHERE church_id = $1) AS teams,
         (SELECT COUNT(*) FROM months WHERE church_id = $1) AS months,
         (SELECT COUNT(*) FROM months WHERE church_id = $1 AND status = 'final') AS published_months,
         (SELECT COUNT(*) FROM users WHERE church_id = $1 AND approved_at IS NULL) AS pending_requests`,
      [churchId],
    )

    const byRole = await pool.query(
      `SELECT role, COUNT(*) AS n FROM users
       WHERE church_id = $1 AND is_active = TRUE AND approved_at IS NOT NULL
       GROUP BY role`,
      [churchId],
    )

    const topVolunteers = await pool.query(
      `SELECT u.name, COUNT(s.id) AS assignments
       FROM assignments s
       JOIN users u ON u.id = s.user_id
       JOIN months m ON m.id = s.month_id
       WHERE m.church_id = $1
       GROUP BY u.id ORDER BY assignments DESC LIMIT 10`,
      [churchId],
    )

    res.json({
      totals: {
        volunteers: Number(totals.rows[0].volunteers),
        teams: Number(totals.rows[0].teams),
        months: Number(totals.rows[0].months),
        publishedMonths: Number(totals.rows[0].published_months),
        pendingRequests: Number(totals.rows[0].pending_requests),
      },
      byRole: byRole.rows.map((r) => ({ role: r.role, count: Number(r.n) })),
      topVolunteers: topVolunteers.rows.map((r) => ({ name: r.name, assignments: Number(r.assignments) })),
    })
  }),
)
