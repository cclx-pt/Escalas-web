/**
 * routes/calendar.js — calendário pessoal do voluntário e feed iCal.
 *
 * O feed `/data/calendar/feed/:token.ics` é público (autenticado por token
 * secreto), para poder ser subscrito em apps de calendário.
 */
import crypto from 'node:crypto'
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { buildIcs } from '../lib/ics.js'

export const calendarRouter = Router()

/** Assignments de um utilizador (opcionalmente só de meses publicados). */
async function userAssignments(userId, { onlyPublished = false, year, month } = {}) {
  const params = [userId]
  const where = ['s.user_id = $1']
  if (onlyPublished) where.push(`m.status = 'final'`)
  if (year) {
    params.push(year)
    where.push(`m.year = $${params.length}`)
  }
  if (month) {
    params.push(month)
    where.push(`m.month = $${params.length}`)
  }
  const { rows } = await pool.query(
    `SELECT s.id, s.sunday, s.is_manual,
            p.name AS position_name, t.name AS team_name, t.color,
            c.name AS church_name
     FROM assignments s
     JOIN positions p ON p.id = s.position_id
     JOIN teams t ON t.id = p.team_id
     JOIN months m ON m.id = s.month_id
     JOIN churches c ON c.id = m.church_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.sunday`,
    params,
  )
  return rows.map((r) => ({
    id: r.id,
    sunday: toIso(r.sunday),
    isManual: r.is_manual,
    position: r.position_name,
    team: r.team_name,
    color: r.color,
    church: r.church_name,
  }))
}

// GET /data/calendar — calendário pessoal (próximos + do mês pedido).
calendarRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : undefined
    const month = req.query.month ? Number(req.query.month) : undefined
    const all = await userAssignments(req.user.sub, { year, month })
    const today = new Date().toISOString().slice(0, 10)
    const upcoming = (await userAssignments(req.user.sub, {}))
      .filter((a) => a.sunday >= today)
      .slice(0, 10)
    res.json({ assignments: all, upcoming })
  }),
)

// GET /data/calendar/token — obtém/gera o token do feed iCal.
calendarRouter.get(
  '/token',
  requireAuth,
  asyncHandler(async (req, res) => {
    let { rows } = await pool.query('SELECT calendar_token FROM users WHERE id = $1', [req.user.sub])
    let token = rows[0]?.calendar_token
    if (!token) {
      token = crypto.randomBytes(24).toString('hex')
      await pool.query('UPDATE users SET calendar_token = $2 WHERE id = $1', [req.user.sub, token])
    }
    res.json({ token, url: `/data/calendar/feed/${token}.ics` })
  }),
)

// GET /data/calendar/feed/:token.ics — feed público autenticado por token.
calendarRouter.get(
  '/feed/:token.ics',
  asyncHandler(async (req, res) => {
    const token = req.params.token
    const { rows } = await pool.query('SELECT id, name FROM users WHERE calendar_token = $1', [token])
    const user = rows[0]
    if (!user) throw new HttpError(404, 'Feed não encontrado.')

    const assignments = await userAssignments(user.id, { onlyPublished: true })
    const events = assignments.map((a) => ({
      id: a.id,
      sunday: a.sunday,
      summary: `${a.team} — ${a.position}`,
      description: `Escala de ${a.church}${a.isManual ? ' (alteração manual)' : ''}`,
      location: a.church,
    }))
    const ics = buildIcs(events, { calName: `Escalas — ${user.name}` })

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=600')
    res.setHeader('Content-Disposition', 'inline; filename="escalas.ics"')
    res.send(ics)
  }),
)

function toIso(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}
