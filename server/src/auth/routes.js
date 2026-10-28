/**
 * auth/routes.js — autenticação passwordless (OTP + JWT) e onboarding.
 *
 * Fluxo: POST /request-code (envia código) -> POST /verify (abre sessão em
 * cookie httpOnly). Inclui também o pedido de acesso (/register) e a criação
 * de igreja + admin (/onboard), conforme a configuração.
 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { config } from '../config.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { slugify } from '../lib/slug.js'
import { issueCode, verifyCode } from './otp.js'
import { sendEmail, sendOtpEmail, accessRequestEmail } from './email.js'
import { signSession, cookieOptions, SESSION_COOKIE } from './jwt.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const emailSchema = z.object({
  email: z
    .string()
    .email('Email inválido.')
    .transform((v) => v.toLowerCase().trim()),
})

const verifySchema = emailSchema.extend({
  code: z.string().regex(/^\d{6}$/, 'Código inválido.'),
})

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

async function findActiveUser(email) {
  const { rows } = await pool.query(
    `SELECT id, church_id, name, email, role, is_active, is_org_admin, approved_at, language
     FROM users WHERE email = $1 AND is_active = TRUE`,
    [email],
  )
  return rows[0] ?? null
}

/** Constrói o payload do utilizador autenticado (com nome da igreja efetiva). */
async function buildMe(session) {
  const activeChurchId = session.activeChurchId || session.churchId
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_org_admin, u.approved_at, u.language,
            u.church_id AS home_church_id, hc.name AS home_church_name,
            ac.id AS active_church_id, ac.name AS active_church_name,
            ac.organization_id AS active_org_id, o.name AS active_org_name
     FROM users u
     LEFT JOIN churches hc ON hc.id = u.church_id
     LEFT JOIN churches ac ON ac.id = $2
     LEFT JOIN organizations o ON o.id = ac.organization_id
     WHERE u.id = $1`,
    [session.sub, activeChurchId],
  )
  const u = rows[0]
  if (!u) return null
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isOrgAdmin: u.is_org_admin,
    approved: !!u.approved_at,
    language: u.language,
    homeChurchId: u.home_church_id,
    homeChurchName: u.home_church_name,
    activeChurchId: u.active_church_id || u.home_church_id,
    activeChurchName: u.active_church_name || u.home_church_name,
    activeOrgId: u.active_org_id,
    activeOrgName: u.active_org_name,
  }
}

// POST /auth/request-code — gera e envia o código OTP (resposta genérica).
authRouter.post(
  '/request-code',
  limiter,
  asyncHandler(async (req, res) => {
    const { email } = emailSchema.parse(req.body)
    const user = await findActiveUser(email)
    if (user) {
      const code = await issueCode(email)
      if (code) {
        await sendOtpEmail(email, code).catch((err) =>
          console.error('[auth] falha ao enviar OTP:', err?.message ?? err),
        )
      } else {
        console.warn(`[auth] limite de códigos atingido para ${email}`)
      }
    }
    // Resposta sempre igual (anti-enumeração), mesmo quando o limite é atingido.
    res.json({ ok: true, message: 'Se o email estiver autorizado, enviámos um código.' })
  }),
)

// POST /auth/verify — valida o código e abre sessão.
authRouter.post(
  '/verify',
  limiter,
  asyncHandler(async (req, res) => {
    const { email, code } = verifySchema.parse(req.body)
    const result = await verifyCode(email, code)
    if (!result.ok) {
      throw new HttpError(401, 'Código inválido ou expirado.')
    }
    const user = await findActiveUser(email)
    if (!user) {
      throw new HttpError(403, 'Utilizador não autorizado.')
    }
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id])
    const token = signSession(user)
    res.cookie(SESSION_COOKIE, token, cookieOptions())
    res.json({ user: await buildMe({ sub: user.id, churchId: user.church_id }) })
  }),
)

// GET /auth/me — devolve o utilizador autenticado.
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await buildMe(req.user)
    if (!me) throw new HttpError(401, 'Sessão inválida.')
    res.json({ user: me })
  }),
)

// POST /auth/logout — termina a sessão.
authRouter.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.json({ ok: true })
})

// GET /auth/context — dados públicos para os formulários de registo/onboarding.
authRouter.get(
  '/context',
  asyncHandler(async (_req, res) => {
    const orgs = await pool.query(
      `SELECT o.id, o.name,
              COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name)
                       ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL), '[]') AS churches
       FROM organizations o
       LEFT JOIN churches c ON c.organization_id = o.id
       GROUP BY o.id ORDER BY o.name`,
    )
    res.json({
      organizations: orgs.rows,
      allowPublicRegistration: config.allowPublicRegistration,
    })
  }),
)

// POST /auth/register — pedido de acesso a uma igreja (cria utilizador pendente).
const registerSchema = z.object({
  name: z.string().trim().min(1, 'O nome é obrigatório.'),
  email: z
    .string()
    .email('Email inválido.')
    .transform((v) => v.toLowerCase().trim()),
  churchId: z.string().uuid('Igreja inválida.'),
})

authRouter.post(
  '/register',
  limiter,
  asyncHandler(async (req, res) => {
    const { name, email, churchId } = registerSchema.parse(req.body)

    const church = await pool.query('SELECT id, name FROM churches WHERE id = $1', [churchId])
    if (!church.rows[0]) throw new HttpError(404, 'Igreja não encontrada.')

    const existing = await pool.query('SELECT id, approved_at FROM users WHERE email = $1', [email])
    if (existing.rows[0]) {
      throw new HttpError(409, 'Já existe uma conta ou pedido com este email.')
    }

    await pool.query(
      `INSERT INTO users (church_id, name, email, role, is_active, approved_at)
       VALUES ($1, $2, $3, 'volunteer', TRUE, NULL)`,
      [churchId, name, email],
    )

    // Notifica os admins da igreja.
    const admins = await pool.query(
      `SELECT email FROM users
       WHERE church_id = $1 AND role = 'admin' AND is_active = TRUE AND approved_at IS NOT NULL`,
      [churchId],
    )
    for (const a of admins.rows) {
      await sendEmail({
        to: a.email,
        ...accessRequestEmail({ name, email, churchName: church.rows[0].name }),
      }).catch(() => {})
    }

    res.status(201).json({ ok: true, message: 'Pedido enviado. Aguarde aprovação de um administrador.' })
  }),
)

// POST /auth/onboard — cria igreja + admin (auto-registo), se permitido.
const onboardSchema = z.object({
  organizationName: z.string().trim().min(1, 'O nome da organização é obrigatório.'),
  churchName: z.string().trim().min(1, 'O nome da igreja é obrigatório.'),
  adminName: z.string().trim().min(1, 'O nome do administrador é obrigatório.'),
  adminEmail: z
    .string()
    .email('Email inválido.')
    .transform((v) => v.toLowerCase().trim()),
})

authRouter.post(
  '/onboard',
  limiter,
  asyncHandler(async (req, res) => {
    if (!config.allowPublicRegistration) {
      throw new HttpError(403, 'O registo público está desativado.')
    }
    const data = onboardSchema.parse(req.body)

    const dup = await pool.query('SELECT id FROM users WHERE email = $1', [data.adminEmail])
    if (dup.rows[0]) throw new HttpError(409, 'Já existe uma conta com este email.')

    await pool.withTransaction(async (client) => {
      const org = await client.query(
        `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id`,
        [data.organizationName, `${slugify(data.organizationName)}-${Date.now().toString(36)}`],
      )
      const church = await client.query(
        `INSERT INTO churches (organization_id, name, slug) VALUES ($1, $2, $3) RETURNING id`,
        [org.rows[0].id, data.churchName, `${slugify(data.churchName)}-${Date.now().toString(36)}`],
      )
      await client.query(
        `INSERT INTO users (church_id, name, email, role, is_active, is_org_admin, approved_at)
         VALUES ($1, $2, $3, 'admin', TRUE, TRUE, now())`,
        [church.rows[0].id, data.adminName, data.adminEmail],
      )
    })

    res.status(201).json({ ok: true, message: 'Igreja criada. Entre com o email do administrador.' })
  }),
)
