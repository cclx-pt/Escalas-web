/**
 * routes/schedule.js — editor de escala (posição × domingo).
 *
 * Regras de conflito:
 *  - Em `scheduling`: só voluntários marcados como DISPONÍVEIS podem ser escalados.
 *  - Em `final`: líderes/admins podem forçar manualmente (is_manual) mesmo que o
 *    voluntário esteja indisponível, desde que seja membro da equipa.
 *
 * Âmbito: admin edita todas as equipas; líder edita apenas as que lidera.
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'
import { monthLabel, sundaysOf } from '../lib/dates.js'

export const scheduleRouter = Router()

scheduleRouter.use(requireRole('admin', 'leader'))

// GET /data/schedule/:monthId — dados do editor.
scheduleRouter.get(
  '/:monthId',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const month = await fetchMonth(req.params.monthId, churchId)
    const sundays = sundaysOf(month.year, month.month)

    const isLeader = req.user.role === 'leader' && !req.user.isOrgAdmin
    const teamParams = [churchId]
    let teamWhere = 't.church_id = $1'
    if (isLeader) {
      teamParams.push(req.user.sub)
      teamWhere += ` AND t.leader_id = $2`
    }

    const teams = await pool.query(
      `SELECT t.id, t.name, t.color FROM teams t WHERE ${teamWhere} ORDER BY t.sort_order, t.name`,
      teamParams,
    )
    const teamIds = teams.rows.map((t) => t.id)

    if (teamIds.length === 0) {
      return res.json({
        month: { id: month.id, label: monthLabel(month.year, month.month), status: month.status, sundays },
        teams: [],
        conflicts: [],
      })
    }

    const positions = await pool.query(
      `SELECT id, team_id, name FROM positions WHERE team_id = ANY($1) ORDER BY sort_order, name`,
      [teamIds],
    )
    const members = await pool.query(
      `SELECT tm.team_id, u.id, u.name FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ANY($1) AND u.is_active = TRUE AND u.approved_at IS NOT NULL
       ORDER BY u.name`,
      [teamIds],
    )
    const availabilities = await pool.query(
      `SELECT user_id, sunday, status FROM availabilities WHERE month_id = $1`,
      [req.params.monthId],
    )
    const assignments = await pool.query(
      `SELECT s.position_id, s.sunday, s.user_id, s.is_manual, p.team_id
       FROM assignments s JOIN positions p ON p.id = s.position_id
       WHERE s.month_id = $1 AND p.team_id = ANY($2)`,
      [req.params.monthId, teamIds],
    )

    // Índices auxiliares.
    const availByUser = new Map() // userId -> { sunday: status }
    for (const a of availabilities.rows) {
      const iso = toIso(a.sunday)
      if (!availByUser.has(a.user_id)) availByUser.set(a.user_id, {})
      availByUser.get(a.user_id)[iso] = a.status
    }

    const membersByTeam = new Map()
    for (const m of members.rows) {
      if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, [])
      membersByTeam.get(m.team_id).push({
        id: m.id,
        name: m.name,
        availability: availByUser.get(m.id) || {},
      })
    }

    const positionsByTeam = new Map()
    for (const p of positions.rows) {
      if (!positionsByTeam.has(p.team_id)) positionsByTeam.set(p.team_id, [])
      positionsByTeam.get(p.team_id).push({ id: p.id, name: p.name })
    }

    // assignments: positionId -> { sunday: { userId, isManual } }
    const assignByPosition = {}
    const memberName = new Map(members.rows.map((m) => [m.id, m.name]))
    const conflicts = []
    for (const a of assignments.rows) {
      const iso = toIso(a.sunday)
      if (!assignByPosition[a.position_id]) assignByPosition[a.position_id] = {}
      assignByPosition[a.position_id][iso] = { userId: a.user_id, isManual: a.is_manual }
      const av = availByUser.get(a.user_id)?.[iso]
      if (av === 'unavailable') {
        conflicts.push({ positionId: a.position_id, sunday: iso, userId: a.user_id, userName: memberName.get(a.user_id) })
      }
    }

    res.json({
      month: { id: month.id, label: monthLabel(month.year, month.month), status: month.status, sundays },
      teams: teams.rows.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        positions: positionsByTeam.get(t.id) || [],
        members: membersByTeam.get(t.id) || [],
        assignments: filterAssignmentsForTeam(assignByPosition, positionsByTeam.get(t.id) || []),
      })),
      conflicts,
    })
  }),
)

const saveSchema = z.object({
  entries: z.array(
    z.object({
      positionId: z.string().uuid(),
      sunday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      userId: z.string().uuid().nullable(),
    }),
  ),
})

// POST /data/schedule/:monthId — grava escalações.
scheduleRouter.post(
  '/:monthId',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.monthId, 'Mês')
    const month = await fetchMonth(req.params.monthId, churchId)
    if (!['scheduling', 'final'].includes(month.status)) {
      throw new HttpError(409, 'A escala só pode ser editada em preparação ou publicada.')
    }
    const { entries } = saveSchema.parse(req.body)
    const validSundays = new Set(sundaysOf(month.year, month.month))
    const isLeader = req.user.role === 'leader' && !req.user.isOrgAdmin

    const warnings = []

    await pool.withTransaction(async (client) => {
      for (const entry of entries) {
        if (!validSundays.has(entry.sunday)) continue

        // A posição pertence a uma equipa da igreja (e liderada, se for líder)?
        const pos = await client.query(
          `SELECT p.id, p.team_id, t.leader_id FROM positions p
           JOIN teams t ON t.id = p.team_id
           WHERE p.id = $1 AND t.church_id = $2`,
          [entry.positionId, churchId],
        )
        const position = pos.rows[0]
        if (!position) throw new HttpError(404, 'Posição não encontrada.')
        if (isLeader && position.leader_id !== req.user.sub) {
          throw new HttpError(403, 'Só pode editar as equipas que lidera.')
        }

        if (!entry.userId) {
          await client.query(
            'DELETE FROM assignments WHERE month_id = $1 AND position_id = $2 AND sunday = $3',
            [req.params.monthId, entry.positionId, entry.sunday],
          )
          continue
        }

        // O utilizador é membro da equipa?
        const member = await client.query(
          'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
          [position.team_id, entry.userId],
        )
        if (!member.rows[0]) {
          throw new HttpError(400, 'O voluntário não pertence a esta equipa.')
        }

        // Disponibilidade nesse domingo.
        const av = await client.query(
          'SELECT status FROM availabilities WHERE month_id = $1 AND user_id = $2 AND sunday = $3',
          [req.params.monthId, entry.userId, entry.sunday],
        )
        const status = av.rows[0]?.status
        const unavailable = status === 'unavailable'

        if (month.status === 'scheduling' && unavailable) {
          // Pré-publicação: não é permitido escalar indisponíveis.
          throw new HttpError(409, 'Não é possível escalar um voluntário indisponível antes de publicar.')
        }

        const isManual = month.status === 'final' && unavailable
        if (isManual) {
          warnings.push({ positionId: entry.positionId, sunday: entry.sunday, userId: entry.userId })
        }

        await client.query(
          `INSERT INTO assignments (month_id, position_id, user_id, sunday, is_manual)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (month_id, position_id, sunday)
           DO UPDATE SET user_id = EXCLUDED.user_id, is_manual = EXCLUDED.is_manual`,
          [req.params.monthId, entry.positionId, entry.userId, entry.sunday, isManual],
        )
      }
    })

    res.json({ ok: true, manualOverrides: warnings })
  }),
)

function filterAssignmentsForTeam(assignByPosition, positions) {
  const out = {}
  for (const p of positions) {
    if (assignByPosition[p.id]) out[p.id] = assignByPosition[p.id]
  }
  return out
}

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
