/**
 * Envío de correos transaccionales del sistema.
 *
 * Estrategia (en cascada, primero el que esté disponible):
 *   1. SMTP propio de la empresa (tabla empresa_email_config). Cada cliente
 *      del SaaS configura su Gmail / Outlook / IONOS / etc desde Ajustes.
 *   2. Resend a nivel plataforma (RESEND_API_KEY + EMAIL_FROM en .env), si
 *      el dueño del software lo ha activado como fallback global.
 *   3. Si nada está configurado → { ok: false, configured: false } y el
 *      llamador puede caer al sandbox de Supabase.
 *
 * Esto es server-only: usa nodemailer y la service-role para leer la config.
 */

import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
  /**
   * Si se pasa, se intenta usar el SMTP configurado para esa empresa.
   * Si no, se intenta el Resend de plataforma directamente.
   */
  empresaId?: string | null
}

export type SendEmailResult =
  | { ok: true; transport: 'empresa-smtp' | 'resend'; id?: string }
  | { ok: false; configured: false } // ningún transport disponible
  | { ok: false; configured: true; error: string }

type EmpresaSmtp = {
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  smtp_password: string
  from_email: string
  from_name: string | null
  enabled: boolean
}

async function getEmpresaSmtp(empresaId: string): Promise<EmpresaSmtp | null> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return null
  }
  const { data } = await admin
    .from('empresa_email_config')
    .select('smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, enabled')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!data || !data.enabled) return null
  return data as EmpresaSmtp
}

async function sendViaSmtp(
  cfg: EmpresaSmtp,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: cfg.smtp_port,
      secure: cfg.smtp_secure, // true → 465 SSL; false → 587 STARTTLS
      auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
    })
    const from = cfg.from_name
      ? `"${cfg.from_name.replace(/"/g, '')}" <${cfg.from_email}>`
      : cfg.from_email
    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
    return { ok: true, transport: 'empresa-smtp', id: info.messageId }
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : 'Error SMTP desconocido',
    }
  }
}

async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return { ok: false, configured: false }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return {
        ok: false,
        configured: true,
        error: `Resend ${res.status}: ${body || res.statusText}`,
      }
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, transport: 'resend', id: json.id }
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : 'Error Resend desconocido',
    }
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // 1) SMTP por empresa
  if (input.empresaId) {
    const smtp = await getEmpresaSmtp(input.empresaId)
    if (smtp) return sendViaSmtp(smtp, input)
  }
  // 2) Resend de plataforma (fallback)
  return sendViaResend(input)
}

/**
 * Envío de prueba para validar la configuración SMTP de una empresa
 * sin consultar la BD (la config aún no está guardada).
 */
export async function testSmtpDirect(opts: {
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  smtp_password: string
  from_email: string
  from_name?: string | null
  to: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: opts.smtp_host,
      port: opts.smtp_port,
      secure: opts.smtp_secure,
      auth: { user: opts.smtp_user, pass: opts.smtp_password },
    })
    await transporter.verify()
    const from = opts.from_name
      ? `"${opts.from_name.replace(/"/g, '')}" <${opts.from_email}>`
      : opts.from_email
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: 'Prueba de configuración SMTP — Balles Hosteleros',
      text:
        'Si recibes este correo, la configuración SMTP de tu empresa funciona correctamente.\n\n' +
        'Ya puedes enviar recuperaciones de contraseña y notificaciones del sistema desde tu propio buzón.',
      html:
        '<p>Si recibes este correo, la configuración SMTP de tu empresa funciona correctamente.</p>' +
        '<p>Ya puedes enviar recuperaciones de contraseña y notificaciones del sistema desde tu propio buzón.</p>',
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error SMTP desconocido' }
  }
}
