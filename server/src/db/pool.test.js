import { test } from 'node:test'
import assert from 'node:assert/strict'

// Fuso a leste de UTC no verão: era aqui que as datas recuavam um dia.
process.env.TZ = 'Europe/Lisbon'
process.env.DATABASE_URL ||= 'postgres://test@localhost:1/test'
process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const pg = (await import('pg')).default
const { DATE_OID } = await import('./pool.js')

test('colunas DATE chegam como YYYY-MM-DD, sem mudar de dia', () => {
  const parse = pg.types.getTypeParser(DATE_OID, 'text')
  assert.equal(parse('2026-07-05'), '2026-07-05')
  assert.equal(parse('2026-01-04'), '2026-01-04')
})
