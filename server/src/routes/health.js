/**
 * routes/health.js — liveness e estado dos componentes.
 */
import { Router } from 'express'
import { pool } from '../db/pool.js'

export const healthRouter = Router()

// GET /health — verifica a app e a ligação à base de dados.
healthRouter.get('/', async (_req, res) => {
  const result = { status: 'ok', db: 'unknown', time: new Date().toISOString() }
  try {
    await pool.query('SELECT 1')
    result.db = 'ok'
  } catch (err) {
    result.status = 'degraded'
    result.db = 'error'
    result.error = err.message
  }
  res.status(result.status === 'ok' ? 200 : 503).json(result)
})
