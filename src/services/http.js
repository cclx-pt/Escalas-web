/**
 * services/http.js — wrapper de fetch com cookies de sessão (httpOnly).
 */
const STATUS_MESSAGES = {
  400: 'Pedido inválido.',
  401: 'Sessão não autorizada.',
  403: 'Sem permissão para esta ação.',
  404: 'Recurso não encontrado.',
  409: 'Conflito com o estado atual.',
  429: 'Demasiados pedidos. Tenta novamente dentro de momentos.',
  500: 'Erro interno do servidor.',
  502: 'O servidor está temporariamente indisponível.',
  503: 'Serviço indisponível. Tenta mais tarde.',
}

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message || STATUS_MESSAGES[status] || `Erro (${status}).`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request(method, url, body) {
  let res
  try {
    res = await fetch(url, {
      method,
      headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'include',
      body: body != null ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Sem ligação à rede.')
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data.error, data.code)
  }
  return data
}

export const http = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  put: (url, body) => request('PUT', url, body ?? {}),
  patch: (url, body) => request('PATCH', url, body ?? {}),
  del: (url) => request('DELETE', url),
}
