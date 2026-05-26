/**
 * Envío de correos transaccionales del sistema.
 *
 * Diseño simplificado (2026-05-26): TODOS los correos salen desde la
 * plataforma (Resend) con un único `from` configurado en .env. El cliente
 * (la empresa hostelera) no configura SMTP, contraseñas ni nada técnico —
 * solo rellena UN dato: `empresas.email_contacto`, que se usa como
 * `Reply-To` para que las respuestas le lleguen a su buzón real.
 */

import "server-only";
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
  | { ok: true; transport: "resend"; id?: string }
  | { ok: false; configured: false }
  | { ok: false; configured: true; error: string };

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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, configured: false };

  let replyTo: string | null = input.replyTo ?? null;
  if (!replyTo && input.empresaId) {
    replyTo = await resolverReplyTo(input.empresaId);
  }

  try {
    const body: Record<string, unknown> = {
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    };
    if (replyTo) body.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        configured: true,
        error: `Resend ${res.status}: ${text || res.statusText}`,
      };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, transport: "resend", id: json.id };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : "Error Resend desconocido",
    };
  }
}
