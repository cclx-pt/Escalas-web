/**
 * config.js — configuração central do backend.
 *
 * Lê variáveis de ambiente (via dotenv em dev) e expõe um objeto `config`
 * tipado por convenção. Falha cedo e com clareza quando faltam variáveis
 * obrigatórias, para evitar erros crípticos mais tarde.
 */
import dotenv from 'dotenv'

dotenv.config()

const isProd = process.env.NODE_ENV === 'production'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória em falta: ${name}`)
  }
  return value
}

const smtpPort = Number(process.env.SMTP_PORT ?? 587)

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  allowPublicRegistration: process.env.ALLOW_PUBLIC_REGISTRATION === 'true',

  db: {
    connectionString: required('DATABASE_URL'),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    poolSize: Number(process.env.DB_POOL_SIZE ?? 10),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    sessionHours: Number(process.env.SESSION_HOURS ?? 8),
  },

  otp: {
    pepper: required('OTP_PEPPER'),
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 15),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    devMasterCode: isProd ? '' : process.env.DEV_MASTER_OTP || '',
    logCodes: process.env.OTP_LOG_CODES === 'true',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: smtpPort,
    // A porta 465 é SMTPS (TLS implícito).
    secure: smtpPort === 465 ? true : process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Escalas CCLX <escalas@cclx.pt>',
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@cclx.pt',
    adminName: process.env.SEED_ADMIN_NAME || 'Administrador CCLX',
    orgName: process.env.SEED_ORG_NAME || 'CCLX',
    churchName: process.env.SEED_CHURCH_NAME || 'Sede',
  },
}
