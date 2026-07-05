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

/** Converte (ano, mês, dia) em 'YYYY-MM-DD', validando o round-trip. Null se inválido. */
export function toIsoDate(year, month, day) {
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null
  }
  return d.toISOString().slice(0, 10)
}

/**
 * Faz o parse de uma data de importação para 'YYYY-MM-DD'. Aceita:
 *  - 'YYYY-MM-DD'
 *  - 'DD/MM/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY' (ano com 2 ou 4 dígitos)
 *  - 'DD/MM' (assume o ano dado)
 *  - 'DD' (assume o mês e ano dados)
 * Devolve null se não reconhecer o formato ou a data for inválida.
 */
export function parseImportDate(token, year, month) {
  const t = String(token).trim()
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]))
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    let y = Number(m[3])
    if (y < 100) y += 2000
    return toIsoDate(y, Number(m[2]), Number(m[1]))
  }
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})$/)
  if (m) return toIsoDate(year, Number(m[2]), Number(m[1]))
  m = t.match(/^(\d{1,2})$/)
  if (m) return toIsoDate(year, month, Number(m[1]))
  return null
}
