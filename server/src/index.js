/**
 * index.js — arranque local/standalone (chama app.listen).
 *
 * No Vercel não é usado — lá corre como função serverless (serverless.js).
 */
import { app } from './app.js'
import { config } from './config.js'
import { pool } from './db/pool.js'

const server = app.listen(config.port, () => {
  console.log(`[server] Escalas CCLX backend a correr na porta ${config.port}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    console.log(`[server] Recebido ${signal} — a encerrar…`)
    server.close(() => {
      pool.end().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
