/**
 * lib/ics.js — geração de iCalendar (RFC 5545) para as escalas.
 *
 * Cada escalação vira um evento de domingo, 10:30–13:00 Europe/Lisbon,
 * com bloco VTIMEZONE completo (regras WET/WEST).
 */

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Lisbon',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0100',
  'TZNAME:WEST',
  'DTSTART:19700329T010000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0000',
  'TZNAME:WET',
  'DTSTART:19701025T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Dobra linhas a 75 octetos, conforme a norma. */
function fold(line) {
  if (line.length <= 75) return line
  const chunks = []
  let rest = line
  chunks.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    chunks.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) chunks.push(' ' + rest)
  return chunks.join('\r\n')
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/**
 * @param {Array<{id, sunday, summary, description, location}>} events
 * @param {{ calName?: string }} options
 */
export function buildIcs(events, { calName = 'Escalas CCLX' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Escalas CCLX//PT//',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
    'X-WR-TIMEZONE:Europe/Lisbon',
    ...VTIMEZONE,
  ]

  const dtstamp = stamp()
  for (const ev of events) {
    const ymd = ev.sunday.replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:assignment-${ev.id}@escalas.cclx.pt`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/Lisbon:${ymd}T103000`,
      `DTEND;TZID=Europe/Lisbon:${ymd}T130000`,
      fold(`SUMMARY:${escapeText(ev.summary)}`),
      fold(`DESCRIPTION:${escapeText(ev.description || '')}`),
      fold(`LOCATION:${escapeText(ev.location || '')}`),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
