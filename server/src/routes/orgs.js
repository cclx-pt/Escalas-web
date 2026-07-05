/**
 * routes/orgs.js — gestão de organizações (apenas org admin).
 */
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { slugify } from '../lib/slug.js'
import { requireOrgAdmin } from '../middleware/auth.js'

export const orgsRouter = Router()

orgsRouter.use(requireOrgAdmin)

const mapOrg = (r) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  isSystem: r.is_system,
  churchCount: Number(r.church_count ?? 0),
  createdAt: r.created_at,
})

// GET /data/orgs — lista organizações com contagem de igrejas.
orgsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT o.*, COUNT(c.id) AS church_count
       FROM organizations o
       LEFT JOIN churches c ON c.organization_id = o.id
       GROUP BY o.id ORDER BY o.name`,
    )
    res.json({ organizations: rows.map(mapOrg) })
  }),
)

const orgSchema = z.object({ name: z.string().trim().min(1, 'O nome é obrigatório.') })

// POST /data/orgs — cria organização.
orgsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = orgSchema.parse(req.body)
    const existing = await pool.query('SELECT slug FROM organizations')
    const slug = ensureUniqueSlug(name, existing.rows.map((r) => r.slug))
    const { rows } = await pool.query(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2)
       RETURNING *, 0 AS church_count`,
      [name, slug],
    )
    res.status(201).json({ organization: mapOrg(rows[0]) })
  }),
)

// PUT /data/orgs/:id — atualiza organização.
orgsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    assertUuid(req.params.id, 'Organização')
    const { name } = orgSchema.parse(req.body)
    const { rows } = await pool.query(
      `UPDATE organizations SET name = $2 WHERE id = $1 RETURNING *, 0 AS church_count`,
      [req.params.id, name],
    )
    if (!rows[0]) throw new HttpError(404, 'Organização não encontrada.')
    res.json({ organization: mapOrg(rows[0]) })
  }),
)

// DELETE /data/orgs/:id — apaga (apenas se não tiver igrejas).
orgsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    assertUuid(req.params.id, 'Organização')
    const churches = await pool.query('SELECT COUNT(*) AS n FROM churches WHERE organization_id = $1', [
      req.params.id,
    ])
    if (Number(churches.rows[0].n) > 0) {
      throw new HttpError(409, 'Não é possível apagar: a organização ainda tem igrejas.')
    }
    await pool.query('DELETE FROM organizations WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  }),
)

function ensureUniqueSlug(base, existing) {
  const set = new Set(existing)
  const root = slugify(base) || 'org'
  let candidate = root
  let i = 2
  while (set.has(candidate)) {
    candidate = `${root}-${i}`
    i += 1
  }
  return candidate
}
