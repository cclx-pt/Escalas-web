/**
 * routes/teams.js — gestão de equipas, posições, membros e líder.
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'

export const teamsRouter = Router()

const manage = requireRole('admin')
const HEX_RE = /^#[0-9a-fA-F]{6}$/

const mapTeam = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  color: r.color,
  planningPriority: r.planning_priority,
  sortOrder: r.sort_order,
  leaderId: r.leader_id,
  leaderName: r.leader_name ?? null,
  positionCount: Number(r.position_count ?? 0),
  memberCount: Number(r.member_count ?? 0),
})

// GET /data/teams — lista equipas da igreja.
teamsRouter.get(
  '/',
  requireRole('admin', 'leader'),
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { rows } = await pool.query(
      `SELECT t.*, l.name AS leader_name,
              (SELECT COUNT(*) FROM positions p WHERE p.team_id = t.id) AS position_count,
              (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS member_count
       FROM teams t
       LEFT JOIN users l ON l.id = t.leader_id
       WHERE t.church_id = $1
       ORDER BY t.sort_order, t.name`,
      [churchId],
    )
    res.json({ teams: rows.map(mapTeam) })
  }),
)

const teamSchema = z.object({
  name: z.string().trim().min(1, 'O nome é obrigatório.'),
  description: z.string().trim().optional().nullable(),
  color: z.string().regex(HEX_RE, 'Cor inválida (use #rrggbb).').default('#6366f1'),
  planningPriority: z.number().int().min(0).max(100).default(50),
  sortOrder: z.number().int().optional().default(100),
})

// POST /data/teams — cria equipa.
teamsRouter.post(
  '/',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const data = teamSchema.parse(req.body)
    const dup = await pool.query('SELECT id FROM teams WHERE church_id = $1 AND name = $2', [
      churchId,
      data.name,
    ])
    if (dup.rows[0]) throw new HttpError(409, 'Já existe uma equipa com este nome.')
    const { rows } = await pool.query(
      `INSERT INTO teams (church_id, name, description, color, planning_priority, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [churchId, data.name, data.description ?? null, data.color, data.planningPriority, data.sortOrder],
    )
    res.status(201).json({ team: mapTeam(rows[0]) })
  }),
)

// GET /data/teams/:id — detalhe (posições, membros, não-membros disponíveis).
teamsRouter.get(
  '/:id',
  requireRole('admin', 'leader'),
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Equipa')
    const team = await pool.query(
      `SELECT t.*, l.name AS leader_name FROM teams t
       LEFT JOIN users l ON l.id = t.leader_id
       WHERE t.id = $1 AND t.church_id = $2`,
      [req.params.id, churchId],
    )
    if (!team.rows[0]) throw new HttpError(404, 'Equipa não encontrada.')

    const positions = await pool.query(
      'SELECT id, name, sort_order FROM positions WHERE team_id = $1 ORDER BY sort_order, name',
      [req.params.id],
    )
    const members = await pool.query(
      `SELECT u.id, u.name, u.email, u.role FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 ORDER BY u.name`,
      [req.params.id],
    )
    const available = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u
       WHERE u.church_id = $1 AND u.is_active = TRUE AND u.approved_at IS NOT NULL
         AND u.id NOT IN (SELECT user_id FROM team_members WHERE team_id = $2)
       ORDER BY u.name`,
      [churchId, req.params.id],
    )

    res.json({
      team: mapTeam(team.rows[0]),
      positions: positions.rows.map((p) => ({ id: p.id, name: p.name, sortOrder: p.sort_order })),
      members: members.rows,
      available: available.rows,
    })
  }),
)

// PUT /data/teams/:id — atualiza definições.
teamsRouter.put(
  '/:id',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Equipa')
    const data = teamSchema.partial().parse(req.body)
    const { rows } = await pool.query(
      `UPDATE teams SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         color = COALESCE($5, color),
         planning_priority = COALESCE($6, planning_priority),
         sort_order = COALESCE($7, sort_order)
       WHERE id = $1 AND church_id = $2 RETURNING *`,
      [
        req.params.id,
        churchId,
        data.name,
        data.description,
        data.color,
        data.planningPriority,
        data.sortOrder,
      ],
    )
    if (!rows[0]) throw new HttpError(404, 'Equipa não encontrada.')
    res.json({ team: mapTeam(rows[0]) })
  }),
)

// DELETE /data/teams/:id — apaga equipa (cascata).
teamsRouter.delete(
  '/:id',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Equipa')
    const { rowCount } = await pool.query('DELETE FROM teams WHERE id = $1 AND church_id = $2', [
      req.params.id,
      churchId,
    ])
    if (!rowCount) throw new HttpError(404, 'Equipa não encontrada.')
    res.json({ ok: true })
  }),
)

// POST /data/teams/:id/positions — adiciona posição.
teamsRouter.post(
  '/:id/positions',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Equipa')
    const { name, sortOrder } = z
      .object({ name: z.string().trim().min(1, 'O nome é obrigatório.'), sortOrder: z.number().int().optional().default(100) })
      .parse(req.body)
    await assertTeamInChurch(req.params.id, churchId)
    const dup = await pool.query('SELECT id FROM positions WHERE team_id = $1 AND name = $2', [
      req.params.id,
      name,
    ])
    if (dup.rows[0]) throw new HttpError(409, 'Já existe uma posição com este nome.')
    const { rows } = await pool.query(
      'INSERT INTO positions (team_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id, name, sort_order',
      [req.params.id, name, sortOrder],
    )
    res.status(201).json({ position: { id: rows[0].id, name: rows[0].name, sortOrder: rows[0].sort_order } })
  }),
)

// DELETE /data/teams/:id/positions/:positionId — apaga posição.
teamsRouter.delete(
  '/:id/positions/:positionId',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Equipa')
    assertUuid(req.params.positionId, 'Posição')
    await assertTeamInChurch(req.params.id, churchId)
    await pool.query('DELETE FROM positions WHERE id = $1 AND team_id = $2', [
      req.params.positionId,
      req.params.id,
    ])
    res.json({ ok: true })
  }),
)

// POST /data/teams/:id/members — adiciona membro.
teamsRouter.post(
  '/:id/members',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Equipa')
    const { userId } = z.object({ userId: z.string().uuid('Voluntário inválido.') }).parse(req.body)
    await assertTeamInChurch(req.params.id, churchId)
    const user = await pool.query('SELECT id FROM users WHERE id = $1 AND church_id = $2', [
      userId,
      churchId,
    ])
    if (!user.rows[0]) throw new HttpError(404, 'Voluntário não encontrado nesta igreja.')
    await pool.query(
      'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, userId],
    )
    res.status(201).json({ ok: true })
  }),
)

// DELETE /data/teams/:id/members/:userId — remove membro.
teamsRouter.delete(
  '/:id/members/:userId',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Equipa')
    assertUuid(req.params.userId, 'Voluntário')
    await assertTeamInChurch(req.params.id, churchId)
    await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [
      req.params.id,
      req.params.userId,
    ])
    res.json({ ok: true })
  }),
)

// PUT /data/teams/:id/leader — define/remove o líder.
teamsRouter.put(
  '/:id/leader',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Equipa')
    const { leaderId } = z
      .object({ leaderId: z.string().uuid().nullable() })
      .parse(req.body)
    await assertTeamInChurch(req.params.id, churchId)
    if (leaderId) {
      const user = await pool.query('SELECT id FROM users WHERE id = $1 AND church_id = $2', [
        leaderId,
        churchId,
      ])
      if (!user.rows[0]) throw new HttpError(404, 'Líder não encontrado nesta igreja.')
    }
    await pool.query('UPDATE teams SET leader_id = $2 WHERE id = $1', [req.params.id, leaderId])
    res.json({ ok: true, leaderId })
  }),
)

async function assertTeamInChurch(teamId, churchId) {
  const { rows } = await pool.query('SELECT id FROM teams WHERE id = $1 AND church_id = $2', [
    teamId,
    churchId,
  ])
  if (!rows[0]) throw new HttpError(404, 'Equipa não encontrada.')
}
