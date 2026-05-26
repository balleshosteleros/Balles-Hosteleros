/**
 * Envío automático de email al mover un inspector entre fases del pipeline.
 *
 * Llamado desde `moverInspectorFase` con la fase de destino. NUNCA bloquea
 * el cambio de columna: si el email falla (sin destinatario, plantilla
 * desactivada, SMTP caído) se loggea y devuelve un resultado sin error.
 *
 * Server-only. Usa el admin client porque corre desde una server action que
 * ya validó tenant antes del UPDATE.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import type { InspectorFase } from "./types";

type Resultado =
  | { sent: true; transport: string }
  | { sent: false; reason: string };

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ??
  "https://sistema.balleshosteleros.com";

function buildEnlaceBolsa(empresaSlug: string | null): string {
  if (!empresaSlug) return APP_URL;
  return `${APP_URL}/inspectores/bolsa/${empresaSlug}`;
}

function sustituir(
  texto: string,
  vars: Record<string, string>,
): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key) => {
    const val = vars[String(key).toLowerCase()];
    return val ?? full;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkifyUrls(html: string): string {
  return html.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    return `<a href="${url}" target="_blank" rel="noreferrer" style="color:#2563eb;text-decoration:underline">${url}</a>`;
  });
}

function bodyToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const linked = linkifyUrls(escaped);
  const html = linked.replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:600px;margin:0 auto;padding:24px">${html}</div>`;
}

export async function sendInspectorFaseEmail(
  empresaId: string,
  inspectorId: string,
  fase: InspectorFase,
): Promise<Resultado> {
  try {
    const admin = createAdminClient();

    // 1. Plantilla del tenant para esa fase, solo si está activa.
    const { data: tpl } = await admin
      .from("inspector_email_plantillas")
      .select("asunto, cuerpo, activa")
      .eq("empresa_id", empresaId)
      .eq("fase", fase)
      .maybeSingle();
    if (!tpl) return { sent: false, reason: "Sin plantilla configurada" };
    if (!tpl.activa) return { sent: false, reason: "Plantilla desactivada" };

    // 2. Inspector + empresa en paralelo.
    const [{ data: insp }, { data: emp }] = await Promise.all([
      admin
        .from("inspectores")
        .select("nombre, apellidos, email, telefono, ciudad")
        .eq("id", inspectorId)
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      admin
        .from("empresas")
        .select("nombre, slug")
        .eq("id", empresaId)
        .maybeSingle(),
    ]);

    if (!insp) return { sent: false, reason: "Inspector no encontrado" };
    if (!insp.email) return { sent: false, reason: "Inspector sin email" };

    const nombre = (insp.nombre as string) ?? "";
    const apellidos = (insp.apellidos as string | null) ?? "";
    const nombreCompleto = [nombre, apellidos].filter(Boolean).join(" ").trim();

    const vars: Record<string, string> = {
      nombre,
      apellidos,
      nombre_completo: nombreCompleto || nombre,
      empresa: (emp?.nombre as string | undefined) ?? "",
      ciudad: (insp.ciudad as string | null) ?? "",
      telefono: (insp.telefono as string | null) ?? "",
      email: (insp.email as string | null) ?? "",
      enlace_bolsa: buildEnlaceBolsa(
        (emp?.slug as string | undefined) ?? null,
      ),
    };

    const subject = sustituir(tpl.asunto as string, vars);
    const bodyText = sustituir(tpl.cuerpo as string, vars);
    const html = bodyToHtml(bodyText);

    const res = await sendEmail({
      to: insp.email as string,
      subject,
      html,
      text: bodyText,
      empresaId,
    });

    if (res.ok) return { sent: true, transport: res.transport };
    if (!res.configured) {
      return { sent: false, reason: "Sin transporte de email configurado" };
    }
    return { sent: false, reason: res.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[inspector-fase-email] error:", msg);
    return { sent: false, reason: msg };
  }
}
