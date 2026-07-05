/**
 * serverless.js — ponto de entrada da função serverless do Vercel.
 *
 * Carrega a app Express de forma preguiçosa e delega o pedido. Em caso de falha
 * de arranque (tipicamente variáveis de ambiente em falta), responde com o erro.
 */
let appPromise

function loadApp() {
  if (!appPromise) {
    appPromise = import('./src/app.js').then((m) => m.app)
  }
  return appPromise
}

export default async function handler(req, res) {
  try {
    const app = await loadApp()
    return app(req, res)
  } catch (err) {
    const detail = err?.message ?? String(err)
    console.error('[serverless] Falha ao iniciar a app:', detail)
    appPromise = undefined
    res.status(500).json({
      error: 'Servidor mal configurado. Verifique as variáveis de ambiente.',
      detail,
    })
  }
}
