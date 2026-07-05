/**
 * auth/email.js — envio de emails via nodemailer.
 *
 * Sem SMTP configurado, corre em "modo consola" (imprime o conteúdo),
 * útil em desenvolvimento. Expõe helpers para código OTP e notificações.
 */
import nodemailer from 'nodemailer'
import { config } from '../config.js'

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  if (!config.smtp.host) return null

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
  return transporter
}

const shell = (title, inner) => `
  <div style="font-family:Barlow,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
    <h2 style="color:#111827">${title}</h2>
    ${inner}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="color:#9ca3af;font-size:12px">Escalas CCLX — gestão de escalas de cooperadores.</p>
  </div>`

/** Envia um email genérico. Devolve { mocked } consoante haja SMTP. */
export async function sendEmail({ to, subject, text, html }) {
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Para: ${to}\n[email:mock] Assunto: ${subject}\n[email:mock] ${text}\n`)
    return { mocked: true }
  }
  await tx.sendMail({ from: config.smtp.from, to, subject, text, html })
  return { mocked: false }
}

/** Envia o código OTP de acesso. */
export async function sendOtpEmail(email, code) {
  const subject = 'O seu código de acesso — Escalas CCLX'
  const text = `O seu código de acesso é ${code}. Expira em ${config.otp.ttlMinutes} minutos.`
  const html = shell(
    'Escalas CCLX',
    `<p>Use o seguinte código para entrar na gestão de escalas:</p>
     <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111827">${code}</p>
     <p style="color:#6b7280">Expira em ${config.otp.ttlMinutes} minutos. Se não pediu este código, ignore este email.</p>`,
  )

  if (config.otp.logCodes) {
    console.log(`[email:otp-log] Código OTP para ${email}: ${code}`)
  }
  return sendEmail({ to: email, subject, text, html })
}
