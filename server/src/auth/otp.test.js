/**
 * Testes de integração dos limites OTP (precisam de PostgreSQL).
 * Correr com: TEST_DATABASE_URL=postgres://… npm test
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dbUrl = process.env.TEST_DATABASE_URL
const skip = dbUrl ? false : 'defina TEST_DATABASE_URL para correr'

if (dbUrl) {
  process.env.DATABASE_URL = dbUrl
  process.env.DB_SSL ||= 'false'
}
process.env.DATABASE_URL ||= 'postgres://test@localhost:1/test'
process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'
// Garante que o código mestre de dev (de um .env local) não interfere.
process.env.DEV_MASTER_OTP = ''

const { issueCode, verifyCode } = await import('./otp.js')
const { pool } = await import('../db/pool.js')
const { config } = await import('../config.js')

const run = `${process.pid}-${Date.now()}`
const emailFor = (label) => `otp-${label}-${run}@test.local`

if (dbUrl) {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
  await pool.query(schema)
}

after(async () => {
  if (dbUrl)
    await pool.query(`DELETE FROM otp_codes WHERE email LIKE $1`, [`otp-%-${run}@test.local`])
  await pool.end()
})

/** Um código de 6 dígitos garantidamente diferente do correto. */
const wrong = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')

test('código correto abre sessão uma única vez', { skip }, async () => {
  const email = emailFor('ok')
  const code = await issueCode(email)
  assert.deepEqual(await verifyCode(email, code), { ok: true })
  assert.equal((await verifyCode(email, code)).ok, false)
})

test('limite de códigos emitidos por email na janela', { skip }, async () => {
  const email = emailFor('codes')
  for (let i = 0; i < config.otp.maxCodesPerWindow; i += 1) {
    assert.ok(await issueCode(email), `o pedido ${i + 1} devia ser aceite`)
  }
  assert.equal(await issueCode(email), null)
})

test('pedir um código novo não repõe as tentativas falhadas', { skip }, async () => {
  const email = emailFor('failures')
  let code
  let failures = 0
  // Esgota as falhas permitidas distribuindo-as por vários códigos.
  while (failures < config.otp.maxFailuresPerWindow) {
    code = await issueCode(email)
    assert.ok(code, 'o limite de códigos não devia ser atingido antes do de falhas')
    for (
      let i = 0;
      i < config.otp.maxAttempts && failures < config.otp.maxFailuresPerWindow;
      i += 1
    ) {
      assert.equal((await verifyCode(email, wrong(code))).reason, 'mismatch')
      failures += 1
    }
  }
  // Um código acabado de pedir (com 0 tentativas próprias) também é recusado,
  // mesmo sendo o certo, até a janela passar.
  code = await issueCode(email)
  assert.ok(code)
  assert.deepEqual(await verifyCode(email, code), { ok: false, reason: 'too_many_attempts' })
})

test('tentativas em paralelo não ultrapassam o limite', { skip }, async () => {
  const email = emailFor('parallel')
  const code = await issueCode(email)
  const results = await Promise.all(
    Array.from({ length: 20 }, () => verifyCode(email, wrong(code))),
  )
  const mismatches = results.filter((r) => r.reason === 'mismatch').length
  assert.equal(mismatches, config.otp.maxAttempts)
})
