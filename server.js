/**
 * server.js — arranque combinado local / standalone (raiz do repositório).
 *
 * Corre o backend Express (API + frontend de `dist/`) como UMA app Node
 * (`npm start`). No Vercel NÃO é usado (lá corre via server/serverless.js).
 *
 * Se o arranque falhar — tipicamente por faltar uma variável de ambiente —
 * sobe um servidor de diagnóstico que devolve a causa em JSON (sem expor
 * segredos, apenas os NOMES das variáveis em falta).
 */
const REQUIRED_ENV = ['JWT_SECRET', 'OTP_PEPPER', 'DATABASE_URL']

try {
  await import('./server/src/index.js')
} catch (err) {
  const { createServer } = await import('node:http')
  const port = Number(process.env.PORT) || 4000
  const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k])
  console.error('[server] FALHA NO ARRANQUE:', err)
  if (missingEnv.length) {
    console.error('[server] Variáveis de ambiente em falta:', missingEnv.join(', '))
  }
  createServer((_req, res) => {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    res.end(
      JSON.stringify({
        error: 'startup_failed',
        message: String(err?.message || err),
        missingEnv,
        nodeEnv: process.env.NODE_ENV ?? null,
      }),
    )
  }).listen(port, '0.0.0.0', () => {
    console.error(`[server] modo diagnóstico a ouvir em 0.0.0.0:${port}`)
  })
}
