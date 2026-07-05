/**
 * lib/router.jsx — mini-router baseado em hash (sem react-router).
 *
 * Rotas do tipo `#/months/:id`. Expõe:
 *  - useHashRoute(): caminho atual (string sem '#', começa por '/').
 *  - navigate(to): muda o hash.
 *  - matchPath(pattern, path): devolve os params ou null.
 *  - <Link to="/x">: âncora que navega sem recarregar.
 */
import { useSyncExternalStore, useCallback } from 'react'
import { cn } from './utils'

function currentPath() {
  const raw = window.location.hash.replace(/^#/, '')
  return raw || '/'
}

function subscribe(callback) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

export function useHashRoute() {
  return useSyncExternalStore(subscribe, currentPath, () => '/')
}

export function navigate(to) {
  const target = to.startsWith('#') ? to : `#${to}`
  if (window.location.hash === target) {
    // Força re-render mesmo que o hash seja igual.
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = target
  }
}

/** Compara um padrão `/a/:id` com um caminho; devolve { id } ou null. */
export function matchPath(pattern, path) {
  const pSeg = pattern.split('/').filter(Boolean)
  const aSeg = path.split('/').filter(Boolean)
  if (pSeg.length !== aSeg.length) return null
  const params = {}
  for (let i = 0; i < pSeg.length; i += 1) {
    if (pSeg[i].startsWith(':')) {
      params[pSeg[i].slice(1)] = decodeURIComponent(aSeg[i])
    } else if (pSeg[i] !== aSeg[i]) {
      return null
    }
  }
  return params
}

export function Link({ to, className, children, onClick, ...props }) {
  const handle = useCallback(
    (e) => {
      e.preventDefault()
      onClick?.(e)
      navigate(to)
    },
    [to, onClick],
  )
  return (
    <a href={`#${to}`} onClick={handle} className={cn(className)} {...props}>
      {children}
    </a>
  )
}
