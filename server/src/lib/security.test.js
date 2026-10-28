import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.DATABASE_URL ||= 'postgres://test@localhost:1/test'
process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const { app } = await import('../app.js')
const { CSP_DIRECTIVES } = await import('./security.js')

/** 'a x; b y' -> { a: 'x', b: 'y' } (ignora a formatação de espaços). */
function parseCsp(value) {
  return Object.fromEntries(
    value
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...sources] = d.split(/\s+/)
        return [name, sources.join(' ')]
      }),
  )
}

const expectedCsp = Object.fromEntries(
  Object.entries(CSP_DIRECTIVES).map(([name, sources]) => [name, sources.join(' ')]),
)

test('a API envia CSP, HSTS, nosniff e anti-framing', async () => {
  const server = app.listen(0)
  try {
    const { port } = server.address()
    // Sem sessão: responde 401 sem tocar na BD, depois dos middlewares globais.
    const res = await fetch(`http://127.0.0.1:${port}/data/volunteers`)
    assert.equal(res.status, 401)
    assert.deepEqual(parseCsp(res.headers.get('content-security-policy')), expectedCsp)
    assert.match(res.headers.get('strict-transport-security'), /max-age=\d+/)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN')
    assert.equal(res.headers.get('x-powered-by'), null)
  } finally {
    server.close()
  }
})

test('vercel.json aplica a mesma CSP ao frontend estático', () => {
  const vercel = JSON.parse(
    fs.readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'),
  )
  const route = vercel.routes.find((r) => r.headers?.['Content-Security-Policy'])
  assert.ok(route, 'falta a rota de cabeçalhos em vercel.json')
  assert.equal(route.continue, true)
  assert.equal(route.src, '/(.*)')
  assert.deepEqual(parseCsp(route.headers['Content-Security-Policy']), expectedCsp)
  assert.equal(route.headers['X-Content-Type-Options'], 'nosniff')
})
