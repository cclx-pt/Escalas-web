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
import { pool } from '../db/pool.js'

/** Estado atual do utilizador na BD (fonte de verdade para papel/ativo/aprovado). */
async function findSessionUser(userId) {
  const { rows } = await pool.query(
    `SELECT church_id, role, is_active, is_org_admin, approved_at
     FROM users WHERE id = $1`,
    [userId],
  )
  return rows[0] ?? null
}

/**
 * Cria o middleware loadUser. O JWT só prova a identidade; papel, estado ativo
 * e aprovação são relidos da BD em cada pedido, para que desativar uma conta ou
 * mudar o papel tenha efeito imediato (e não só quando o token expira).
 */
export function createLoadUser(findUser = findSessionUser) {
  return async function loadUser(req, res, next) {
    const token = req.cookies?.[SESSION_COOKIE]
    if (!token) return next()

    let session
    try {
      session = verifySession(token)
    } catch {
      req.user = null
      return next()
    }

    try {
      const current = await findUser(session.sub)
      if (!current || !current.is_active) {
        res.clearCookie(SESSION_COOKIE, { path: '/' })
        req.user = null
        return next()
      }
      const isOrgAdmin = !!current.is_org_admin
      req.user = {
        ...session,
        role: current.role,
        churchId: current.church_id,
        isOrgAdmin,
        approved: !!current.approved_at,
        // Só um org admin (ainda) pode ter uma igreja ativa diferente da sua.
        activeChurchId: isOrgAdmin ? session.activeChurchId || null : null,
      }
      req.churchId = req.user.activeChurchId || req.user.churchId || null
      next()
    } catch (err) {
      next(err)
    }
  }
}

export const loadUser = createLoadUser()

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
