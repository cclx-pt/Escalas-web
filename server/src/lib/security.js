/**
 * lib/security.js — cabeçalhos de segurança HTTP (helmet).
 *
 * A mesma CSP está replicada em vercel.json, porque no Vercel o frontend
 * estático não passa pelo Express; security.test.js garante que coincidem.
 */
import helmet from 'helmet'

export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  // Radix/shadcn usam atributos style inline; Barlow vem do Google Fonts.
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
}

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES },
    // Os PDFs/feeds iCal são descarregados por outras apps; não precisam de CORP restrito.
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
}
