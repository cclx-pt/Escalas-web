/**
 * app.js — construção da app Express (sem listen).
 *
 * Ordem: trust proxy -> CORS -> JSON -> cookies -> loadUser -> rotas -> SPA -> erros.
 * As rotas públicas (health, feed iCal, traduções públicas) ficam fora do grupo
 * protegido; o restante /data exige sessão e conta aprovada.
 */
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { config } from './config.js'
import { loadUser, requireAuth, requireApproved } from './middleware/auth.js'

import { healthRouter } from './routes/health.js'
import { authRouter } from './auth/routes.js'
import { orgsRouter } from './routes/orgs.js'
import { churchesRouter } from './routes/churches.js'
import { volunteersRouter } from './routes/volunteers.js'
import { teamsRouter } from './routes/teams.js'
import { monthsRouter } from './routes/months.js'
import { availabilityRouter } from './routes/availability.js'
import { scheduleRouter } from './routes/schedule.js'
import { reportsRouter } from './routes/reports.js'
import { statsRouter } from './routes/stats.js'
import { publishRouter } from './routes/publish.js'
import { calendarRouter } from './routes/calendar.js'
import { translationsRouter } from './routes/translations.js'
import { adminRequestsRouter } from './routes/adminRequests.js'
import { dataImportRouter } from './routes/dataImport.js'

const here = path.dirname(fileURLToPath(import.meta.url))

export const app = express()

if (config.isProd) {
  app.set('trust proxy', 1)
}

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(loadUser)

// ── Rotas públicas ──────────────────────────────────────────────────────────
app.use('/health', healthRouter)
app.use('/auth', authRouter)
// Estas têm endpoints públicos próprios (traduções públicas, feed iCal por token).
app.use('/data/translations', translationsRouter)
app.use('/data/calendar', calendarRouter)

// ── Grupo protegido (/data) ─────────────────────────────────────────────────
const dataGuarded = express.Router()
dataGuarded.use(requireAuth, requireApproved)
dataGuarded.use('/orgs', orgsRouter)
dataGuarded.use('/churches', churchesRouter)
dataGuarded.use('/volunteers', volunteersRouter)
dataGuarded.use('/teams', teamsRouter)
dataGuarded.use('/months', monthsRouter)
dataGuarded.use('/availability', availabilityRouter)
dataGuarded.use('/schedule', scheduleRouter)
dataGuarded.use('/reports', reportsRouter)
dataGuarded.use('/stats', statsRouter)
dataGuarded.use('/publish', publishRouter)
dataGuarded.use('/admin-requests', adminRequestsRouter)
dataGuarded.use('/import', dataImportRouter)
app.use('/data', dataGuarded)

// ── Frontend SPA (build) ────────────────────────────────────────────────────
const clientDist = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(here, '../../dist')

if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist))
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/data') ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/health')
    ) {
      return next()
    }
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// ── Tratamento central de erros ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] erro:', err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
})
