/**
 * auth/session.js — reemissão da sessão JWT (troca de igreja ativa).
 */
import { pool } from '../db/pool.js'
import { signSession, cookieOptions, SESSION_COOKIE } from './jwt.js'

/**
 * Reemite o cookie de sessão para `userId`, opcionalmente com uma igreja ativa.
 * Usado quando um org admin entra/sai de uma igreja.
 */
export async function reissueSession(res, userId, activeChurchId = null) {
  const { rows } = await pool.query(
    `SELECT id, church_id, name, email, role, is_org_admin, approved_at, language
     FROM users WHERE id = $1`,
    [userId],
  )
  const user = rows[0]
  if (!user) return null
  const token = signSession(user, { activeChurchId })
  res.cookie(SESSION_COOKIE, token, cookieOptions())
  return user
}
