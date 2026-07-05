/**
 * auth/otp.js — geração e verificação de códigos OTP (login passwordless).
 *
 * Códigos de 6 dígitos, guardados como HMAC-SHA256 (com pepper). Comparação
 * em tempo constante. Cada email só tem um código ativo de cada vez.
 */
import crypto from 'node:crypto'
import { config } from '../config.js'
import { pool } from '../db/pool.js'

/** Gera um código de 6 dígitos criptograficamente seguro. */
export function generateCode() {
  const n = crypto.randomInt(0, 1_000_000)
  return String(n).padStart(6, '0')
}

/** Faz o hash do código com pepper (HMAC-SHA256) para armazenamento. */
export function hashCode(code) {
  return crypto.createHmac('sha256', config.otp.pepper).update(code).digest('hex')
}

/** Comparação em tempo constante entre dois hashes hex. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Emite um novo código OTP. Invalida os códigos anteriores por consumir do
 * mesmo email. Devolve o código em claro (para enviar por email).
 */
export async function issueCode(email) {
  const code = generateCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60_000)

  await pool.query(
    `UPDATE otp_codes SET consumed_at = now()
     WHERE email = $1 AND consumed_at IS NULL`,
    [email],
  )

  await pool.query(
    `INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)`,
    [email, codeHash, expiresAt],
  )

  return code
}

/**
 * Verifica o código de um email. Devolve { ok, reason }.
 * Marca como consumido em caso de sucesso; incrementa tentativas em falha.
 */
export async function verifyCode(email, code) {
  // Código mestre de desenvolvimento (ignorado em produção).
  if (config.otp.devMasterCode && safeEqual(hashCode(code), hashCode(config.otp.devMasterCode))) {
    return { ok: true }
  }

  const { rows } = await pool.query(
    `SELECT id, code_hash, expires_at, attempts
     FROM otp_codes
     WHERE email = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [email],
  )

  const record = rows[0]
  if (!record) return { ok: false, reason: 'not_found' }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  if (record.attempts >= config.otp.maxAttempts) {
    await pool.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [record.id])
    return { ok: false, reason: 'too_many_attempts' }
  }

  const matches = safeEqual(hashCode(code), record.code_hash)
  if (!matches) {
    await pool.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [record.id])
    return { ok: false, reason: 'mismatch' }
  }

  await pool.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [record.id])
  return { ok: true }
}
