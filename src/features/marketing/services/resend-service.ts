/**
 * Envío de campañas de email vía Resend REST API.
 * Usa fetch directamente para no añadir dependencias.
 *
 * Endpoint: POST https://api.resend.com/emails (o /batch para masivos)
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 *
 * ENV requerido:
 *   RESEND_API_KEY               → re_... (panel → API Keys)
 *   RESEND_FROM_EMAIL (opcional) → remitente por defecto
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CampanaEmail } from "@/features/marketing/data/campanas";

const RESEND_URL = "https://api.resend.com";

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface ResendSendResult {
  success: boolean;
  batchId?: string;
  enviados?: number;
  error?: string;
}

/**
 * Obtiene la lista de emails del segmento objetivo.
 * Por ahora busca en `profiles`, `clientes` (si existe), limitado a 500.
 */
async function obtenerDestinatarios(empresaId: string, segmento: string): Promise<string[]> {
  const admin = createAdminClient();
  const emails = new Set<string>();

  // 1. Perfiles internos
  const { data: profiles } = await admin
    .from("usuarios")
    .select("email")
    .eq("empresa_id", empresaId)
    .limit(500);
  for (const p of profiles ?? []) if (p.email) emails.add(p.email as string);

  // 2. Clientes (si la tabla existe; ignorar error si no)
  try {
    const { data: clientes } = await admin
      .from("clientes")
      .select("email, segmento")
      .eq("empresa_id", empresaId)
      .limit(500);
    for (const c of clientes ?? []) {
      if (!c.email) continue;
      if (segmento === "todos" || c.segmento === segmento) emails.add(c.email as string);
    }
  } catch {
    // tabla clientes no existe aún — no bloquea
  }

  return Array.from(emails);
}

export async function sendEmailCampana(campana: CampanaEmail): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }

  const destinatarios = await obtenerDestinatarios(campana.empresaId, campana.segmento);
  if (destinatarios.length === 0) {
    return { success: false, error: "No hay destinatarios en el segmento seleccionado" };
  }

  const from = campana.remitenteEmail
    ? `${campana.remitenteNombre || "Balles Hosteleros"} <${campana.remitenteEmail}>`
    : process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  try {
    // Resend permite hasta 100 emails por batch; partimos si hace falta.
    const chunks: string[][] = [];
    for (let i = 0; i < destinatarios.length; i += 100) {
      chunks.push(destinatarios.slice(i, i + 100));
    }

    let enviados = 0;
    let lastBatchId: string | undefined;

    for (const chunk of chunks) {
      const emails = chunk.map((to) => ({
        from,
        to: [to],
        subject: campana.asunto,
        html: campana.cuerpoHtml || `<p>${campana.asunto}</p>`,
      }));

      const res = await fetch(`${RESEND_URL}/emails/batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emails),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.message ?? `HTTP ${res.status}`;
        return { success: false, error: `Resend: ${msg}`, enviados };
      }
      const data = (await res.json()) as { data?: { id: string }[] };
      enviados += data.data?.length ?? chunk.length;
      lastBatchId = data.data?.[0]?.id;
    }

    return { success: true, batchId: lastBatchId, enviados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: msg };
  }
}
