import { describe, it, expect } from 'vitest'
import { shortDate, fullDate, longDate, monthLabel } from '../lib/format'

describe('format', () => {
  it('shortDate -> dd/MM', () => {
    expect(shortDate('2025-02-09')).toBe('09/02')
  })

  it('fullDate -> dd/MM/yyyy', () => {
    expect(fullDate('2025-02-09')).toBe('09/02/2025')
  })

  it('monthLabel em PT', () => {
    expect(monthLabel(2025, 2)).toBe('Fevereiro 2025')
  })

  it('longDate inclui o dia da semana', () => {
    // 2025-02-09 é um domingo.
    expect(longDate('2025-02-09')).toContain('Domingo')
  })

  it('lida com valores vazios', () => {
    expect(shortDate('')).toBe('')
    expect(fullDate(undefined)).toBe('')
  })
})
