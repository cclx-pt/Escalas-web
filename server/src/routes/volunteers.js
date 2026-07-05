/**
 * routes/volunteers.js — gestão de voluntários (utilizadores) da igreja ativa.
 *
 * Todas as ações exigem papel admin. Contas são passwordless (login por OTP).
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'

export const volunteersRouter = Router()

const manage = requireRole('admin')

const mapUser = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  isActive: r.is_active,
  isOrgAdmin: r.is_org_admin,
  approved: !!r.approved_at,
  language: r.language,
  teams: r.teams ?? [],
  createdAt: r.created_at,
})

// GET /data/volunteers?q=&teamId= — lista voluntários (aprovados) da igreja.
volunteersRouter.get(
  '/',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const q = (req.query.q || '').toString().trim().toLowerCase()
    const teamId = (req.query.teamId || '').toString().trim()

    const params = [churchId]
    const where = ['u.church_id = $1', 'u.approved_at IS NOT NULL']
    if (q) {
      params.push(`%${q}%`)
      where.push(`(LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`)
    }
    if (teamId) {
      params.push(teamId)
      where.push(`EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = u.id AND tm.team_id = $${params.length})`)
    }

    const { rows } = await pool.query(
      `SELECT u.*,
              COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)
                       ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]') AS teams
       FROM users u
       LEFT JOIN team_members tm ON tm.user_id = u.id
       LEFT JOIN teams t ON t.id = tm.team_id
       WHERE ${where.join(' AND ')}
       GROUP BY u.id
       ORDER BY u.name`,
      params,
    )
    res.json({ volunteers: rows.map(mapUser) })
  }),
)

const createSchema = z.object({
  name: z.string().trim().min(1, 'O nome é obrigatório.'),
  email: z
    .string()
    .email('Email inválido.')
    .transform((v) => v.toLowerCase().trim()),
  role: z.enum(['admin', 'leader', 'volunteer']).default('volunteer'),
  teamIds: z.array(z.string().uuid()).optional().default([]),
})

// POST /data/volunteers — cria voluntário (já aprovado).
volunteersRouter.post(
  '/',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const data = createSchema.parse(req.body)
    const dup = await pool.query('SELECT id FROM users WHERE email = $1', [data.email])
    if (dup.rows[0]) throw new HttpError(409, 'Já existe uma conta com este email.')

    const user = await pool.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO users (church_id, name, email, role, is_active, approved_at)
         VALUES ($1, $2, $3, $4, TRUE, now()) RETURNING id`,
        [churchId, data.name, data.email, data.role],
      )
      const userId = inserted.rows[0].id
      for (const teamId of data.teamIds) {
        await client.query(
          `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [teamId, userId],
        )
      }
      return userId
    })

    res.status(201).json({ id: user, ok: true })
  }),
)

const editSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z
    .string()
    .email('Email inválido.')
    .transform((v) => v.toLowerCase().trim())
    .optional(),
  role: z.enum(['admin', 'leader', 'volunteer']).optional(),
  isActive: z.boolean().optional(),
  language: z.string().trim().optional(),
  teamIds: z.array(z.string().uuid()).optional(),
})

// PUT /data/volunteers/:id — edita voluntário.
volunteersRouter.put(
  '/:id',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Voluntário')
    const data = editSchema.parse(req.body)

    const target = await pool.query('SELECT id, is_org_admin FROM users WHERE id = $1 AND church_id = $2', [
      req.params.id,
      churchId,
    ])
    if (!target.rows[0]) throw new HttpError(404, 'Voluntário não encontrado.')

    // Regras: não te podes despromover/desativar a ti próprio.
    if (req.params.id === req.user.sub) {
      if (data.role && data.role !== 'admin') throw new HttpError(400, 'Não pode alterar o seu próprio papel.')
      if (data.isActive === false) throw new HttpError(400, 'Não pode desativar a sua própria conta.')
    }

    if (data.email) {
      const dup = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [
        data.email,
        req.params.id,
      ])
      if (dup.rows[0]) throw new HttpError(409, 'Já existe outra conta com este email.')
    }

    await pool.withTransaction(async (client) => {
      await client.query(
        `UPDATE users SET
           name = COALESCE($2, name),
           email = COALESCE($3, email),
           role = COALESCE($4, role),
           is_active = COALESCE($5, is_active),
           language = COALESCE($6, language)
         WHERE id = $1`,
        [req.params.id, data.name, data.email, data.role, data.isActive, data.language],
      )
      if (data.teamIds) {
        await client.query('DELETE FROM team_members WHERE user_id = $1', [req.params.id])
        for (const teamId of data.teamIds) {
          await client.query(
            `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [teamId, req.params.id],
          )
        }
      }
    })

    res.json({ ok: true })
  }),
)

// PATCH /data/volunteers/:id/toggle — ativa/desativa.
volunteersRouter.patch(
  '/:id/toggle',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Voluntário')
    if (req.params.id === req.user.sub) throw new HttpError(400, 'Não pode desativar a sua própria conta.')
    const target = await pool.query(
      'SELECT is_active, is_org_admin FROM users WHERE id = $1 AND church_id = $2',
      [req.params.id, churchId],
    )
    if (!target.rows[0]) throw new HttpError(404, 'Voluntário não encontrado.')
    if (target.rows[0].is_org_admin) throw new HttpError(400, 'Não é possível desativar um org admin.')
    const { rows } = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active',
      [req.params.id],
    )
    res.json({ ok: true, isActive: rows[0].is_active })
  }),
)

// PATCH /data/volunteers/:id/role — muda o papel.
volunteersRouter.patch(
  '/:id/role',
  manage,
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Voluntário')
    const { role } = z.object({ role: z.enum(['admin', 'leader', 'volunteer']) }).parse(req.body)
    if (req.params.id === req.user.sub && role !== 'admin') {
      throw new HttpError(400, 'Não pode alterar o seu próprio papel.')
    }
    const { rowCount } = await pool.query(
      'UPDATE users SET role = $3 WHERE id = $1 AND church_id = $2',
      [req.params.id, churchId, role],
    )
    if (!rowCount) throw new HttpError(404, 'Voluntário não encontrado.')
    res.json({ ok: true, role })
  }),
)
