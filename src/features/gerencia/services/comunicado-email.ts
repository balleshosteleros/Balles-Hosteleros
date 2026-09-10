/**
 * Envío de un COMUNICADO por correo, con sus documentos adjuntos.
 *
 * Existe para que el comunicado salga igual lo publique una persona desde
 * Gerencia o lo publique solo el cron de los recurrentes. Antes el correo vivía
 * solo dentro del cron, así que un comunicado publicado a mano no llegaba por
 * email a nadie, y además el cron lo mandaba a la plantilla ENTERA aunque el
 * comunicado fuera para un departamento concreto.
 *
 * Los adjuntos viajan de dos formas a la vez, a propósito:
 *   · Como archivo adjunto de verdad, mientras quepan (los correos tienen un
 *     tope real de tamaño; un PDF de 40 MB rebota y el correo entero se pierde).
 *   · Como enlace al software, SIEMPRE. El enlace no caduca y el documento se
 *     abre desde la ficha del comunicado, así que aunque el archivo sea enorme
 *     el trabajador puede llegar a él.
 *
 * Server-only: usa la clave de servicio para resolver destinatarios. La RLS de
 * `usuarios` solo deja ver el propio perfil, así que con la sesión del usuario
 * un comunicado "a toda la empresa" se habría quedado en una sola persona.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  fetchEmpresaMarca,
  comunicadoHeaderInline,
  comunicadoHeaderHtml,
  comunicadoEmailHtml,
} from "@/lib/email/comunicado-header";
import { getSiteUrl } from "@/lib/site-url";
import { escapeHtml } from "@/lib/email/escape-html";
import { BUCKET_COMUNICADOS, type ComunicadoAdjunto } from "@/features/gerencia/data/comunicados-adjuntos";

/**
 * Tope de lo que se manda como archivo adjunto en un mismo correo.
 *
 * No es un capricho: los servidores de correo rechazan los envíos grandes y el
 * adjunto viaja codificado, ocupando ~1,37 veces su tamaño. Con 15 MB de
 * originales el correo sale sobrado por debajo del límite habitual. Lo que no
 * quepa NO se pierde: va como enlace.
 */
const MAX_ADJUNTOS_EMAIL_BYTES = 15 * 1024 * 1024;

interface ComunicadoFila {
  id: string;
  empresa_id: string;
  titulo: string;
  asunto: string | null;
  cuerpo: string | null;
  estado: string;
  toda_empresa: boolean;
  roles_destinatarios: string[] | null;
  departamentos_destinatarios: string[] | null;
  empleados_destinatarios: string[] | null;
  adjuntos: unknown;
}

export interface ResultadoEnvioComunicado {
  ok: boolean;
  enviados: number;
  destinatarios: number;
  error?: string;
}

/** Texto plano de respaldo para los clientes de correo que no pintan HTML. */
function aTextoPlano(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Un correo de migración o vacío no es una dirección a la que escribir. */
function esEmailUtil(e: string): boolean {
  return e.includes("@") && !e.endsWith("@sin-email.migracion");
}

/**
 * Correos de los destinatarios del comunicado.
 *
 * La lista base son los EMPLEADOS ACTIVOS de la empresa (es quien cobra y
 * trabaja allí). El departamento y el rol se leen de `usuarios`, que es donde
 * viven, cruzando por `user_id`; no se filtra `usuarios` por empresa porque
 * quien trabaja en dos empresas solo tiene una como principal y se quedaría
 * fuera de la suya secundaria.
 */
async function resolverEmails(
  supabase: ReturnType<typeof createAdminClient>,
  c: ComunicadoFila,
): Promise<string[]> {
  const { data: plantilla } = await supabase
    .from("empleados")
    .select("user_id, email_personal, email_empresa")
    .eq("empresa_id", c.empresa_id)
    .eq("estado", "Activo");

  const empleados = (plantilla ?? []) as Array<{
    user_id: string | null;
    email_personal: string | null;
    email_empresa: string | null;
  }>;

  const emailDe = (e: (typeof empleados)[number]) =>
    (e.email_empresa || e.email_personal || "").trim().toLowerCase();

  if (c.toda_empresa === true) {
    return Array.from(new Set(empleados.map(emailDe).filter(esEmailUtil)));
  }

  const elegidos = new Set<string>((c.empleados_destinatarios ?? []).filter(Boolean));

  const departamentos = (c.departamentos_destinatarios ?? []).filter(Boolean);
  const roles = (c.roles_destinatarios ?? []).filter(Boolean);
  const userIdsPlantilla = empleados
    .map((e) => e.user_id)
    .filter((id): id is string => !!id);

  if ((departamentos.length > 0 || roles.length > 0) && userIdsPlantilla.length > 0) {
    const { data: perfiles } = await supabase
      .from("usuarios")
      .select("user_id, departamento, rol_label")
      .in("user_id", userIdsPlantilla);

    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const deps = departamentos.map(norm);
    const rols = roles.map(norm);

    for (const p of (perfiles ?? []) as Array<{
      user_id: string;
      departamento: string | null;
      rol_label: string | null;
    }>) {
      const dep = norm(p.departamento);
      const rol = norm(p.rol_label);
      // El departamento también cuenta como "rol" porque en la pantalla de
      // Gerencia ambas listas se solapan (el rol se etiqueta con el área).
      if ((dep && deps.includes(dep)) || (rol && rols.includes(rol)) || (dep && rols.includes(dep))) {
        elegidos.add(p.user_id);
      }
    }
  }

  return Array.from(
    new Set(
      empleados
        .filter((e) => e.user_id && elegidos.has(e.user_id))
        .map(emailDe)
        .filter(esEmailUtil),
    ),
  );
}

/** Normaliza el JSONB `adjuntos` a una lista tipada. */
export function normalizarAdjuntos(raw: unknown): ComunicadoAdjunto[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const path = typeof r.path === "string" ? r.path : "";
    const name = typeof r.name === "string" ? r.name : "";
    if (!path || !name) return [];
    return [
      {
        path,
        name,
        size: typeof r.size === "number" ? r.size : 0,
        mime: typeof r.mime === "string" ? r.mime : null,
      },
    ];
  });
}

/** Bloque HTML con los documentos: enlace al software para cada uno. */
function bloqueAdjuntosHtml(adjuntos: ComunicadoAdjunto[], color: string): string {
  if (adjuntos.length === 0) return "";
  const base = getSiteUrl().replace(/\/$/, "");
  const filas = adjuntos
    .map((a) => {
      const url = `${base}/api/comunicados/doc?path=${encodeURIComponent(a.path)}`;
      return `<tr><td style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;">
        <a href="${url}" style="color:${color};text-decoration:none;font-weight:600;">${escapeHtml(a.name)}</a>
      </td></tr>`;
    })
    .join("");
  const titulo = adjuntos.length === 1 ? "Documento adjunto" : "Documentos adjuntos";
  return `<div style="margin-top:24px;padding-top:18px;border-top:1px solid #E5E7EB;">
    <p style="margin:0 0 8px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;">${titulo}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">${filas}</table>
  </div>`;
}

/**
 * Manda el comunicado por correo a sus destinatarios.
 *
 * No lanza: un fallo de correo nunca debe tumbar la publicación del comunicado,
 * que ya está guardada y avisada por la app.
 */
export async function enviarComunicadoPorEmail(
  comunicadoId: string,
): Promise<ResultadoEnvioComunicado> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("comunicados")
      .select(
        "id, empresa_id, titulo, asunto, cuerpo, estado, toda_empresa, roles_destinatarios, departamentos_destinatarios, empleados_destinatarios, adjuntos",
      )
      .eq("id", comunicadoId)
      .maybeSingle();
    if (error) throw error;
    const c = data as ComunicadoFila | null;
    if (!c) return { ok: false, enviados: 0, destinatarios: 0, error: "El comunicado ya no existe" };
    if (c.estado !== "publicado") {
      return { ok: false, enviados: 0, destinatarios: 0, error: "El comunicado no está publicado" };
    }

    const emails = await resolverEmails(supabase, c);
    if (emails.length === 0) {
      return { ok: false, enviados: 0, destinatarios: 0, error: "Ningún destinatario tiene correo" };
    }

    const marca = await fetchEmpresaMarca(c.empresa_id);
    const adjuntos = normalizarAdjuntos(c.adjuntos);

    // Los archivos se descargan UNA vez y se reutilizan en todos los correos.
    const ficheros: { filename: string; content: Buffer; contentType?: string }[] = [];
    let acumulado = 0;
    for (const a of adjuntos) {
      if (acumulado + (a.size || 0) > MAX_ADJUNTOS_EMAIL_BYTES) continue;
      const { data: blob, error: errDl } = await supabase.storage
        .from(BUCKET_COMUNICADOS)
        .download(a.path);
      if (errDl || !blob) {
        console.error("[comunicado-email] adjunto no descargado:", a.path, errDl?.message);
        continue;
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      acumulado += buffer.byteLength;
      ficheros.push({
        filename: a.name,
        content: buffer,
        contentType: a.mime ?? undefined,
      });
    }

    const cuerpo = c.cuerpo ?? "";
    const colorEnlace = marca?.color || "#111827";
    const cuerpoConAdjuntos = `${cuerpo}${bloqueAdjuntosHtml(adjuntos, colorEnlace)}`;

    let html: string;
    const attachments = [...ficheros];
    if (marca) {
      const inline = await comunicadoHeaderInline(marca, c.titulo);
      const cabecera = inline ? inline.html : comunicadoHeaderHtml(marca, c.titulo);
      html = comunicadoEmailHtml(cabecera, cuerpoConAdjuntos, marca.nombre);
      if (inline) attachments.push(inline.attachment);
    } else {
      html = comunicadoEmailHtml("", cuerpoConAdjuntos);
    }

    const asunto = c.asunto?.trim() || c.titulo;
    let enviados = 0;
    for (const to of emails) {
      const res = await sendEmail({
        to,
        subject: asunto,
        html,
        text: aTextoPlano(cuerpoConAdjuntos),
        fromName: marca?.nombre || undefined,
        empresaId: c.empresa_id,
        // El comunicado ya trae su propia cabecera: que no se añada la genérica.
        brandHeader: false,
        attachments,
      });
      if (res.ok) enviados++;
    }

    if (enviados > 0) {
      await supabase
        .from("comunicados")
        .update({ email_enviado_at: new Date().toISOString() })
        .eq("id", c.id);
    }

    return { ok: enviados > 0, enviados, destinatarios: emails.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicado-email] envío:", msg);
    return { ok: false, enviados: 0, destinatarios: 0, error: msg };
  }
}
