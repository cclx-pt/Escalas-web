import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sundaysOf, monthLabel, shortDate, parseImportDate } from './dates.js'

test('sundaysOf devolve os domingos do mês', () => {
  // Fevereiro de 2025: domingos a 2, 9, 16, 23.
  assert.deepEqual(sundaysOf(2025, 2), ['2025-02-02', '2025-02-09', '2025-02-16', '2025-02-23'])
})

test('monthLabel em português', () => {
  assert.equal(monthLabel(2025, 2), 'Fevereiro 2025')
})

test('shortDate formata dd/MM', () => {
  assert.equal(shortDate('2025-02-09'), '09/02')
})

test('parseImportDate aceita vários formatos', () => {
  assert.equal(parseImportDate('2025-02-09', 2025, 2), '2025-02-09')
  assert.equal(parseImportDate('09/02/2025', 2025, 2), '2025-02-09')
  assert.equal(parseImportDate('9/2/25', 2025, 2), '2025-02-09')
  assert.equal(parseImportDate('09-02-2025', 2025, 2), '2025-02-09')
  assert.equal(parseImportDate('09.02.2025', 2025, 2), '2025-02-09')
  assert.equal(parseImportDate('09/02', 2025, 2), '2025-02-09')
  assert.equal(parseImportDate('9', 2025, 2), '2025-02-09')
})

test('parseImportDate rejeita datas inválidas', () => {
  assert.equal(parseImportDate('31/02/2025', 2025, 2), null)
  assert.equal(parseImportDate('abc', 2025, 2), null)
  assert.equal(parseImportDate('', 2025, 2), null)
  assert.equal(parseImportDate('2025/02/09', 2025, 2), null)
})
