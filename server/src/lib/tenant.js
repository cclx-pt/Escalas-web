/**
 * lib/tenant.js — resolução da igreja efetiva do pedido.
 */
import { HttpError } from './http.js'

/** Devolve a igreja efetiva (ativa do org admin, ou a do utilizador). */
export function effectiveChurchId(req) {
  const id = req.churchId
  if (!id) {
    throw new HttpError(400, 'Nenhuma igreja ativa. Selecione uma igreja primeiro.')
  }
  return id
}
