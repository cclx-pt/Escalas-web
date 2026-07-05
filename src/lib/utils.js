import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina classes condicionais (clsx) e resolve conflitos do Tailwind
 * (tailwind-merge). Usado por todos os componentes de UI.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
