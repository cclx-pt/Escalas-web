/**
 * routes/churches.js — gestão de igrejas e troca de igreja ativa.
 *
 * CRUD é apenas para org admins. `enter`/`leave` permitem a um org admin
 * assumir o contexto de uma igreja específica (reemite o JWT).
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { slugify } from '../lib/slug.js'
import { requireAuth, requireOrgAdmin } from '../middleware/auth.js'
import { reissueSession } from '../auth/session.js'

export const churchesRouter = Router()

const mapChurch = (r) => ({
  id: r.id,
  organizationId: r.organization_id,
  organizationName: r.organization_name ?? null,
  name: r.name,
  slug: r.slug,
  timezone: r.timezone,
  dateFormat: r.date_format,
  isSystem: r.is_system,
  userCount: Number(r.user_count ?? 0),
  createdAt: r.created_at,
})

// GET /data/churches — lista igrejas (org admin).
churchesRouter.get(
  '/',
  requireOrgAdmin,
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT c.*, o.name AS organization_name, COUNT(u.id) AS user_count
       FROM churches c
       JOIN organizations o ON o.id = c.organization_id
       LEFT JOIN users u ON u.church_id = c.id
       GROUP BY c.id, o.name ORDER BY o.name, c.name`,
    )
    res.json({ churches: rows.map(mapChurch) })
  }),
)

const churchSchema = z.object({
  name: z.string().trim().min(1, 'O nome é obrigatório.'),
  organizationId: z.string().uuid('Organização inválida.'),
  timezone: z.string().trim().min(1).default('Europe/Lisbon'),
  dateFormat: z.string().trim().min(1).default('dd/MM/yyyy HH:mm'),
})

// POST /data/churches — cria igreja (org admin).
churchesRouter.post(
  '/',
  requireOrgAdmin,
  asyncHandler(async (req, res) => {
    const data = churchSchema.parse(req.body)
    const existing = await pool.query('SELECT slug FROM churches')
    const slug = uniqueSlug(data.name, existing.rows.map((r) => r.slug))
    const { rows } = await pool.query(
      `INSERT INTO churches (organization_id, name, slug, timezone, date_format)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.organizationId, data.name, slug, data.timezone, data.dateFormat],
    )
    res.status(201).json({ church: mapChurch(rows[0]) })
  }),
)

// PUT /data/churches/:id — atualiza igreja (org admin).
churchesRouter.put(
  '/:id',
  requireOrgAdmin,
  asyncHandler(async (req, res) => {
    assertUuid(req.params.id, 'Igreja')
    const data = churchSchema.partial().parse(req.body)
    const { rows } = await pool.query(
      `UPDATE churches SET
         name = COALESCE($2, name),
         organization_id = COALESCE($3, organization_id),
         timezone = COALESCE($4, timezone),
         date_format = COALESCE($5, date_format)
       WHERE id = $1 RETURNING *`,
      [req.params.id, data.name, data.organizationId, data.timezone, data.dateFormat],
    )
    if (!rows[0]) throw new HttpError(404, 'Igreja não encontrada.')
    res.json({ church: mapChurch(rows[0]) })
  }),
)

// DELETE /data/churches/:id — apaga igreja (cascata).
churchesRouter.delete(
  '/:id',
  requireOrgAdmin,
  asyncHandler(async (req, res) => {
    assertUuid(req.params.id, 'Igreja')
    await pool.query('DELETE FROM churches WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  }),
)

// POST /data/churches/:id/enter — org admin assume o contexto da igreja.
churchesRouter.post(
  '/:id/enter',
  requireOrgAdmin,
  asyncHandler(async (req, res) => {
    assertUuid(req.params.id, 'Igreja')
    const church = await pool.query('SELECT id FROM churches WHERE id = $1', [req.params.id])
    if (!church.rows[0]) throw new HttpError(404, 'Igreja não encontrada.')
    await reissueSession(res, req.user.sub, req.params.id)
    res.json({ ok: true, activeChurchId: req.params.id })
  }),
)

// POST /data/churches/leave — limpa a igreja ativa.
churchesRouter.post(
  '/leave',
  requireOrgAdmin,
  asyncHandler(async (req, res) => {
    await reissueSession(res, req.user.sub, null)
    res.json({ ok: true })
  }),
)

// POST /data/churches/:id/admins — cria um admin (passwordless) numa igreja.
const adminSchema = z.object({
  name: z.string().trim().min(1, 'O nome é obrigatório.'),
  email: z
    .string()
    .email('Email inválido.')
    .transform((v) => v.toLowerCase().trim()),
  isOrgAdmin: z.boolean().optional().default(false),
})

churchesRouter.post(
  '/:id/admins',
  requireOrgAdmin,
  asyncHandler(async (req, res) => {
    assertUuid(req.params.id, 'Igreja')
    const data = adminSchema.parse(req.body)
    const dup = await pool.query('SELECT id FROM users WHERE email = $1', [data.email])
    if (dup.rows[0]) throw new HttpError(409, 'Já existe uma conta com este email.')
    const { rows } = await pool.query(
      `INSERT INTO users (church_id, name, email, role, is_active, is_org_admin, approved_at)
       VALUES ($1, $2, $3, 'admin', TRUE, $4, now())
       RETURNING id, name, email, role, is_org_admin`,
      [req.params.id, data.name, data.email, data.isOrgAdmin],
    )
    res.status(201).json({ admin: rows[0] })
  }),
)

// GET /data/churches/mine — igreja(s) visíveis ao utilizador atual (para o seletor).
churchesRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.isOrgAdmin) {
      const { rows } = await pool.query(
        `SELECT c.id, c.name, o.name AS organization_name
         FROM churches c JOIN organizations o ON o.id = c.organization_id
         ORDER BY o.name, c.name`,
      )
      res.json({ churches: rows })
    } else {
      const { rows } = await pool.query(
        `SELECT c.id, c.name, o.name AS organization_name
         FROM churches c JOIN organizations o ON o.id = c.organization_id
         WHERE c.id = $1`,
        [req.user.churchId],
      )
      res.json({ churches: rows })
    }
  }),
)

function uniqueSlug(base, existing) {
  const set = new Set(existing)
  const root = slugify(base) || 'igreja'
  let candidate = root
  let i = 2
  while (set.has(candidate)) {
    candidate = `${root}-${i}`
    i += 1
  }
  return candidate
}
