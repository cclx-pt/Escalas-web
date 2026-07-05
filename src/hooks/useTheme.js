/**
 * hooks/useTheme.js — alterna o tema claro/escuro via data-theme + localStorage.
 */
import { useCallback, useEffect, useState } from 'react'

const KEY = 'escalas-theme'

function initial() {
  const stored = localStorage.getItem(KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, isDark: theme === 'dark', toggle, setTheme }
}
