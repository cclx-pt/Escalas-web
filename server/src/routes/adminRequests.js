/**
 * routes/adminRequests.js — fila de pedidos de acesso (aprovação de contas).
 */
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError, assertUuid } from '../lib/http.js'
import { effectiveChurchId } from '../lib/tenant.js'
import { requireRole } from '../middleware/auth.js'
import { sendEmail } from '../auth/email.js'

export const adminRequestsRouter = Router()

adminRequestsRouter.use(requireRole('admin'))

// GET /data/admin-requests — pedidos pendentes (não aprovados) da igreja.
adminRequestsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    const { rows } = await pool.query(
      `SELECT id, name, email, created_at FROM users
       WHERE church_id = $1 AND approved_at IS NULL AND is_active = TRUE
       ORDER BY created_at`,
      [churchId],
    )
    res.json({ requests: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, createdAt: r.created_at })) })
  }),
)

// POST /data/admin-requests/:id/approve — aprova o pedido.
adminRequestsRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Pedido')
    const { rows } = await pool.query(
      `UPDATE users SET approved_at = now(), approved_by_id = $3
       WHERE id = $1 AND church_id = $2 AND approved_at IS NULL
       RETURNING name, email`,
      [req.params.id, churchId, req.user.sub],
    )
    if (!rows[0]) throw new HttpError(404, 'Pedido não encontrado.')
    await sendEmail({
      to: rows[0].email,
      subject: 'Acesso aprovado — Escalas CCLX',
      text: `Olá ${rows[0].name}, o seu acesso foi aprovado. Já pode entrar com o seu email.`,
      html: `<p>Olá ${escapeHtml(rows[0].name)},</p><p>O seu acesso às Escalas CCLX foi <strong>aprovado</strong>. Já pode entrar com o seu email.</p>`,
    }).catch(() => {})
    res.json({ ok: true })
  }),
)

// POST /data/admin-requests/:id/reject — rejeita e remove o pedido.
adminRequestsRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const churchId = effectiveChurchId(req)
    assertUuid(req.params.id, 'Pedido')
    const { rows } = await pool.query(
      `SELECT name, email FROM users WHERE id = $1 AND church_id = $2 AND approved_at IS NULL`,
      [req.params.id, churchId],
    )
    if (!rows[0]) throw new HttpError(404, 'Pedido não encontrado.')
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    await sendEmail({
      to: rows[0].email,
      subject: 'Pedido de acesso — Escalas CCLX',
      text: `Olá ${rows[0].name}, o seu pedido de acesso não foi aprovado.`,
      html: `<p>Olá ${escapeHtml(rows[0].name)},</p><p>O seu pedido de acesso não foi aprovado. Contacte o responsável da sua igreja se achar que é um engano.</p>`,
    }).catch(() => {})
    res.json({ ok: true })
  }),
)

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])
}
