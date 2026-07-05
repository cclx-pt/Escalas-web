import { describe, it, expect } from 'vitest'
import { matchPath } from '../lib/router'

describe('matchPath', () => {
  it('corresponde a rotas simples', () => {
    expect(matchPath('/months', '/months')).toEqual({})
  })

  it('extrai parâmetros', () => {
    expect(matchPath('/months/:id', '/months/abc')).toEqual({ id: 'abc' })
  })

  it('não corresponde quando o comprimento difere', () => {
    expect(matchPath('/months/:id', '/months')).toBeNull()
  })

  it('não corresponde a segmentos literais diferentes', () => {
    expect(matchPath('/teams/:id', '/months/abc')).toBeNull()
  })

  it('descodifica parâmetros', () => {
    expect(matchPath('/x/:v', '/x/a%20b')).toEqual({ v: 'a b' })
  })
})
