/**
 * lib/format.js — formatação de datas e rótulos (PT-PT).
 */
export const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const WEEKDAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** 'YYYY-MM-DD' -> 'dd/MM'. */
export function shortDate(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** 'YYYY-MM-DD' -> 'dd/MM/yyyy'. */
export function fullDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** 'YYYY-MM-DD' -> 'Domingo, 5 de Janeiro'. */
export function longDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS_PT[date.getUTCDay()]}, ${d} de ${MONTHS_PT[m - 1]}`
}

export function monthLabel(year, month) {
  return `${MONTHS_PT[month - 1]} ${year}`
}
