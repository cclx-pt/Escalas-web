/**
 * hooks/useI18n.jsx — contexto de tradução.
 *
 * t(key, vars) devolve o texto do idioma atual, com override da BD por cima do
 * dicionário base, e substituição simples de `{var}`.
 */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { DICTIONARY, DEFAULT_LANGUAGE, LANGUAGES } from '../i18n'
import { translationsApi } from '../services/api'

const I18nContext = createContext(null)

const LANG_KEY = 'escalas-lang'

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem(LANG_KEY) || DEFAULT_LANGUAGE)
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  useEffect(() => {
    translationsApi
      .listPublic()
      .then((data) => setOverrides(data.overrides || {}))
      .catch(() => {})
  }, [])

  const setLang = useCallback((code) => setLangState(code), [])

  const t = useCallback(
    (key, vars) => {
      const base = DICTIONARY[lang] || DICTIONARY[DEFAULT_LANGUAGE]
      const override = overrides[lang]?.[key]
      let text = override || base[key] || DICTIONARY[DEFAULT_LANGUAGE][key] || key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
        }
      }
      return text
    },
    [lang, overrides],
  )

  const value = useMemo(
    () => ({ t, lang, setLang, languages: LANGUAGES }),
    [t, lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n deve ser usado dentro de <I18nProvider>')
  return ctx
}
