/**
 * middleware/auth.js — carrega o utilizador do cookie e protege rotas.
 *
 * - loadUser: popula req.user (não bloqueia).
 * - requireAuth: exige sessão válida (401).
 * - requireRole: exige um dos papéis indicados (403).
 * - requireOrgAdmin: exige is_org_admin (403).
 *
 * `req.churchId` = igreja efetiva do pedido (igreja ativa do org admin, ou a
 * igreja do próprio utilizador). Usado para o scoping multi-tenant.
 */
import { SESSION_COOKIE, verifySession } from '../auth/jwt.js'

export function loadUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) {
    try {
      req.user = verifySession(token)
      req.churchId = req.user.activeChurchId || req.user.churchId || null
    } catch {
      req.user = null
    }
  }
  next()
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária.' })
  }
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária.' })
    }
    // Org admins têm sempre acesso total.
    if (req.user.isOrgAdmin) return next()
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' })
    }
    next()
  }
}

export function requireOrgAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária.' })
  }
  if (!req.user.isOrgAdmin) {
    return res.status(403).json({ error: 'Apenas administradores da organização.' })
  }
  next()
}

/** Exige que a conta esteja aprovada (fora da fila de pedidos de acesso). */
export function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária.' })
  }
  if (!req.user.approved && !req.user.isOrgAdmin) {
    return res.status(403).json({ error: 'Conta pendente de aprovação.', code: 'pending' })
  }
  next()
}
