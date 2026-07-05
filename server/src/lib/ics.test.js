import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIcs } from './ics.js'

test('buildIcs gera um VCALENDAR válido', () => {
  const ics = buildIcs(
    [{ id: 'abc', sunday: '2025-02-09', summary: 'Bar — Bar 1', description: 'Sede', location: 'Sede' }],
    { calName: 'Teste' },
  )
  assert.match(ics, /BEGIN:VCALENDAR/)
  assert.match(ics, /BEGIN:VTIMEZONE/)
  assert.match(ics, /TZID:Europe\/Lisbon/)
  assert.match(ics, /DTSTART;TZID=Europe\/Lisbon:20250209T103000/)
  assert.match(ics, /DTEND;TZID=Europe\/Lisbon:20250209T130000/)
  assert.match(ics, /END:VCALENDAR/)
})

test('buildIcs escapa caracteres especiais', () => {
  const ics = buildIcs([{ id: '1', sunday: '2025-02-09', summary: 'A; B, C', description: '', location: '' }])
  assert.match(ics, /SUMMARY:A\\; B\\, C/)
})
