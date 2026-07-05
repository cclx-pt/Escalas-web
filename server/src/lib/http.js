/**
 * lib/http.js — utilitários partilhados pelas rotas.
 */
import { z } from 'zod'

/** Erro de domínio com código HTTP associado. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** Envolve um handler async, traduzindo HttpError e ZodError em respostas JSON. */
export function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next)
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message })
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
      }
      next(err)
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Valida um UUID; lança 404 se inválido. */
export function assertUuid(id, label = 'Recurso') {
  if (!UUID_RE.test(id)) {
    throw new HttpError(404, `${label} não encontrado.`)
  }
  return id
}
