import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from './html.js'

process.env.DATABASE_URL ||= 'postgres://test@localhost:1/test'
process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const { accessRequestEmail } = await import('../auth/email.js')

test('escapeHtml neutraliza os caracteres especiais de HTML', () => {
  assert.equal(
    escapeHtml(`<a href="x" onclick='y'>&</a>`),
    '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
  )
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(42), '42')
})

test('pedido de acesso: o nome vindo do registo público não injeta HTML', () => {
  const mail = accessRequestEmail({
    name: '<a href="https://phish.example">Clique aqui</a>',
    email: 'x@test.local',
    churchName: 'Sede',
  })
  assert.ok(!mail.html.includes('<a href'), mail.html)
  assert.ok(mail.html.includes('&lt;a href=&quot;https://phish.example&quot;&gt;'))
  // O texto simples mantém o nome tal como foi escrito.
  assert.ok(mail.text.startsWith('<a href="https://phish.example">Clique aqui</a> (x@test.local)'))
})
