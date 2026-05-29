/**
 * Envío de correos transaccionales del sistema.
 *
 * Transporte (2026-05-29): SMTP único global vía nodemailer. Las credenciales
 * viven en variables de entorno (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS),
 * nunca en BD ni en código. El cliente (la empresa hostelera) no configura nada
 * técnico: solo rellena `empresas.email_contacto`, que se usa como Reply-To para
 * que las respuestas del destinatario lleguen a su buzón real.
 *
 * Si faltan las env vars SMTP → { ok: false, configured: false } y el llamador
 * degrada con elegancia (nunca rompe el flujo de negocio).
 *
 * Server-only: usa nodemailer y la service-role para resolver el Reply-To.
 */

import "server-only";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * Si se pasa, leemos `empresas.email_contacto` y lo usamos como Reply-To
   * para que las respuestas del destinatario lleguen al cliente, no al SaaS.
   */
  empresaId?: string | null;
  /** Override manual del Reply-To. Tiene prioridad sobre `empresaId`. */
  replyTo?: string | null;
};

export type SendEmailResult =
  | { ok: true; transport: "smtp"; id?: string }
  | { ok: false; configured: false }
  | { ok: false; configured: true; error: string };

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

/**
 * Lee la configuración SMTP de las env vars. Devuelve null si falta cualquiera
 * de las obligatorias (host/user/pass): señal de "transporte no configurado".
 */
function resolverSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  // 465 → SSL implícito (secure=true); 587/25 → STARTTLS (secure=false).
  const port = Number(process.env.SMTP_PORT) || 465;
  // Override explícito con SMTP_SECURE=true|false si el proveedor lo requiere.
  const secure =
    process.env.SMTP_SECURE != null
      ? process.env.SMTP_SECURE === "true"
      : port === 465;
  // From: usa EMAIL_FROM si está definido; si no, el propio buzón autenticado.
  const from = process.env.EMAIL_FROM?.trim() || user;

  return { host, port, secure, user, pass, from };
}

async function resolverReplyTo(empresaId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("empresas")
      .select("email_contacto")
      .eq("id", empresaId)
      .maybeSingle();
    const email = (data?.email_contacto as string | null) ?? null;
    return email && email.trim() ? email.trim() : null;
  } catch {
    return null;
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = resolverSmtpConfig();
  if (!cfg) return { ok: false, configured: false };

  let replyTo: string | null = input.replyTo ?? null;
  if (!replyTo && input.empresaId) {
    replyTo = await resolverReplyTo(input.empresaId);
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const info = await transporter.sendMail({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: replyTo ?? undefined,
    });
    return { ok: true, transport: "smtp", id: info.messageId };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : "Error SMTP desconocido",
    };
  }
}
