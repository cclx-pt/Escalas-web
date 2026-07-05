/**
 * services/authService.js — autenticação passwordless (OTP + cookie httpOnly).
 */
import { http } from './http'

export function requestCode(email) {
  return http.post('/auth/request-code', { email })
}

export function verifyCode(email, code) {
  return http.post('/auth/verify', { email, code })
}

export async function fetchMe() {
  try {
    const data = await http.get('/auth/me')
    return data.user ?? null
  } catch {
    return null
  }
}

export function logout() {
  return http.post('/auth/logout')
}

export function fetchContext() {
  return http.get('/auth/context')
}

export function register(payload) {
  return http.post('/auth/register', payload)
}

export function onboard(payload) {
  return http.post('/auth/onboard', payload)
}
