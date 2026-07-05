/**
 * lib/dates.js — utilitários de datas (domingos do mês, rótulos PT).
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

/** Rótulo "Fevereiro 2025". */
export function monthLabel(year, month) {
  return `${MONTHS_PT[month - 1]} ${year}`
}

/** Devolve os domingos do mês como strings 'YYYY-MM-DD' (UTC-safe). */
export function sundaysOf(year, month) {
  const result = []
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(Date.UTC(year, month - 1, day))
    if (d.getUTCDay() === 0) {
      result.push(d.toISOString().slice(0, 10))
    }
  }
  return result
}

/** Formata 'YYYY-MM-DD' como 'dd/MM'. */
export function shortDate(iso) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
