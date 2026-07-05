/**
 * auth/jwt.js — sessão JWT em cookie httpOnly.
 *
 * O token guarda a identidade e o papel do utilizador. Para org admins,
 * `activeChurchId` permite trocar de igreja sem estado no servidor
 * (o token é re-assinado ao entrar/sair de uma igreja).
 */
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export const SESSION_COOKIE = 'escalas_session'

export function signSession(user, { activeChurchId = null } = {}) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      churchId: user.church_id,
      isOrgAdmin: !!user.is_org_admin,
      approved: !!user.approved_at,
      language: user.language || 'pt-PT',
      // Só relevante para org admins que entram numa igreja específica.
      activeChurchId: activeChurchId || null,
    },
    config.jwt.secret,
    { expiresIn: `${config.jwt.sessionHours}h` },
  )
}

export function verifySession(token) {
  return jwt.verify(token, config.jwt.secret)
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.jwt.sessionHours * 60 * 60 * 1000,
    path: '/',
  }
}
