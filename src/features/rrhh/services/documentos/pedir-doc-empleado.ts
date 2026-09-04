import "server-only";

/**
 * Petición POR CORREO de un documento a un empleado, con su enlace propio.
 *
 * UNO A UNO, siempre. Nada de un correo con todos en copia: el 4-sep-2026 salió
 * así la petición de los certificados bancarios y, al responder en cadena, cada
 * empleado acabó viendo el IBAN de los anteriores. A cada uno se le escribe solo
 * de lo suyo, sin mencionar a nadie más.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import {
  crearTokenDocEmpleado,
  DOCS_EMPLEADO,
  type TipoDocEmpleado,
} from "./empleado-doc-token";

/** Textos del correo por tipo de documento. */
const COPY: Record<TipoDocEmpleado, { asunto: string; que: string; comoSacarlo: string }> = {
  iban: {
    asunto: "Nos falta tu certificado bancario",
    que: "el <b>certificado de titularidad</b> de tu cuenta bancaria",
    comoSacarlo:
      "Es el documento que emite tu banco y que puedes descargar desde su app. Tiene que verse " +
      "<b>tu nombre como titular</b> y el <b>IBAN completo</b>. Vale una foto o un PDF, siempre " +
      "que se lea bien. No sirve el número escrito a mano ni una captura del saldo.",
  },
  dni_anverso: {
    asunto: "Nos falta tu DNI (cara delantera)",
    que: "la <b>cara delantera</b> de tu DNI o NIE",
    comoSacarlo: "Una foto nítida en la que se lean todos los datos.",
  },
  dni_reverso: {
    asunto: "Nos falta tu DNI (cara trasera)",
    que: "la <b>cara trasera</b> de tu DNI o NIE",
    comoSacarlo: "Una foto nítida en la que se lean todos los datos.",
  },
  ss: {
    asunto: "Nos falta tu documento de la Seguridad Social",
    que: "tu <b>documento de la Seguridad Social</b>",
    comoSacarlo: "Sirve la vida laboral o la tarjeta sanitaria, donde aparezca tu número de afiliación.",
  },
};

/** Botón del correo que lleva al enlace personal de subida. */
function botonHtml(url: string, recordatorio: boolean): string {
  const color = recordatorio ? "#dc2626" : "#16a34a";
  return `
    <div style="margin:22px 0">
      <a href="${url}"
         style="display:inline-block;background:${color};color:#fff;text-decoration:none;
                padding:13px 24px;border-radius:8px;font-weight:600;font-size:15px">
        Subir mi documento
      </a>
      <p style="color:#888;font-size:12px;margin-top:10px">
        Este enlace es solo tuyo. Lo que subas entra directamente en tu ficha y no lo ve ningún
        otro compañero.
      </p>
    </div>`;
}

/**
 * Crea el enlace personal y le escribe al empleado.
 *
 * `recordatorio: true` cambia el tono (ya se le pidió antes), no el circuito.
 */
export async function pedirDocumentoAEmpleado(
  admin: SupabaseClient,
  params: {
    empresaId: string;
    empleadoId: string;
    tipoDoc: TipoDocEmpleado;
    recordatorio?: boolean;
  },
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const { data: emp } = await admin
    .from("empleados")
    .select("nombre, apellidos, email_personal, email_empresa")
    .eq("id", params.empleadoId)
    .eq("empresa_id", params.empresaId)
    .maybeSingle();
  if (!emp) return { ok: false, error: "Empleado no encontrado" };

  // Personal primero: es el correo que el trabajador mira desde el móvil.
  const to =
    (emp.email_personal as string | null)?.trim() || (emp.email_empresa as string | null)?.trim();
  if (!to) return { ok: false, error: "El empleado no tiene correo" };

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", params.empresaId)
    .maybeSingle();
  const empresaNombre = (empresa?.nombre as string) ?? "la empresa";

  const tk = await crearTokenDocEmpleado(admin, {
    empresaId: params.empresaId,
    empleadoId: params.empleadoId,
    tipoDoc: params.tipoDoc,
  });
  if (!tk.ok) return { ok: false, error: tk.error };

  const copy = COPY[params.tipoDoc];
  const nombre = (emp.nombre as string | null)?.trim() || "Hola";
  const recordatorio = params.recordatorio === true;

  const html = `
    <p>${nombre},</p>
    <p>${
      recordatorio
        ? `Te escribimos otra vez porque todavía nos falta ${copy.que}.`
        : `Para terminar de completar tu ficha nos falta ${copy.que}.`
    }</p>
    <p>${copy.comoSacarlo}</p>
    <p>Ya no hace falta que lo mandes por correo: pulsa el botón y súbelo desde ahí.
    Se guarda solo, y con eso quedas al día.</p>
    ${botonHtml(tk.url, recordatorio)}
    <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;

  const text =
    `${nombre},\n\n` +
    `${recordatorio ? "Todavía nos falta" : "Para completar tu ficha nos falta"} ` +
    `${copy.que.replace(/<\/?b>/g, "")}. ` +
    `${copy.comoSacarlo.replace(/<\/?b>/g, "")}\n\n` +
    `Súbelo desde tu enlace personal: ${tk.url}\n\n` +
    `Enviado automáticamente desde el sistema de ${empresaNombre}.`;

  const res = await sendEmail({
    to,
    subject: `${recordatorio ? "Recordatorio: " : ""}${copy.asunto} · ${empresaNombre}`,
    html,
    text,
    empresaId: params.empresaId,
    fromName: empresaNombre,
  });
  if (!res.ok) {
    const motivo = "error" in res ? res.error : "el correo no está configurado";
    return { ok: false, error: `No se pudo enviar: ${motivo}` };
  }

  if (recordatorio) {
    await admin
      .from("empleado_doc_tokens")
      .update({ recordatorio_en: new Date().toISOString() })
      .eq("empleado_id", params.empleadoId)
      .eq("tipo_doc", params.tipoDoc);
  }

  return { ok: true, to };
}
