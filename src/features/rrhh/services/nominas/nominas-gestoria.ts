import "server-only";

/**
 * Envío automático a la gestoría → subida de nóminas por enlace → volcado por IA.
 *
 * Lo usan: el cron de envío mensual (crea el token y manda el correo), la acción
 * «Enviar ahora» de Ajustes de Pagos y la API pública de subida (resuelve el
 * token, lee las nóminas con IA y las vuelca a `rrhh_pagos`).
 *
 * El enlace es por EMPRESA + MES y MULTI-USO (la gestoría puede subir un PDF con
 * todas las nóminas o varios archivos, en varias tandas). Mismo patrón hash-only
 * que `gestoria_contrato_tokens`: solo se persiste el HMAC del token.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarToken, hashToken, compararToken } from "@/features/rrhh/services/firmas/crypto";
import { sendEmail } from "@/lib/email/send";
import { getSiteUrl } from "@/features/rrhh/services/gestoria/gestoria-contrato";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import {
  extraerNominasDeArchivo,
  resolverMimeNomina,
  GeminiKeyMissingError,
  MAX_NOMINAS_BYTES,
} from "@/features/rrhh/services/nominas/extraer-nominas";
import {
  procesarNominasConAdmin,
  type NominaLeida,
  type ResultadoProceso,
} from "@/features/rrhh/services/nominas/procesar-nominas";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** 'AAAA-MM' → 'junio de 2026' (para textos del correo y la pantalla). */
export function nombreMes(periodo: string): string {
  const [y, m] = periodo.split("-");
  const mes = MESES[Number(m) - 1] ?? "";
  return `${mes} de ${y}`.trim();
}

/** Enlace público que abre la gestoría para subir las nóminas del mes. */
export function urlSubidaNominas(token: string): string {
  return `${getSiteUrl()}/gestoria/nominas/${encodeURIComponent(token)}`;
}

/**
 * Crea (o regenera) el token de subida de nóminas de una empresa para un mes y
 * devuelve el token en claro (para el correo). Un único enlace vigente por
 * empresa+mes (upsert por la restricción única). Caduca al final del mes
 * siguiente para dar margen a la gestoría.
 */
export async function crearTokenNominasGestoria(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const token = generarToken();
    const tokenHash = hashToken(token);
    // Vigencia amplia: hasta el final del mes SIGUIENTE al periodo.
    const [y, m] = periodo.split("-").map(Number);
    const expira = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59)).toISOString();

    const { error } = await admin
      .from("nominas_gestoria_tokens")
      .upsert(
        { empresa_id: empresaId, periodo, token_hash: tokenHash, expira_en: expira, enviado_en: new Date().toISOString() },
        { onConflict: "empresa_id,periodo" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error creando token de nóminas" };
  }
}

/** Resuelve un token de subida de nóminas (multi-uso: NO se marca consumido). */
export async function resolverTokenNominasGestoria(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; row: { id: string; empresa_id: string; periodo: string } }
  | { ok: false; reason: "not_found" | "expired" }
> {
  const tokenHash = hashToken(token);
  const { data } = await admin
    .from("nominas_gestoria_tokens")
    .select("id, empresa_id, periodo, token_hash, expira_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (!compararToken(token, data.token_hash as string)) return { ok: false, reason: "not_found" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: { id: data.id as string, empresa_id: data.empresa_id as string, periodo: data.periodo as string },
  };
}

/** Botón HTML «Subir nóminas» para el correo a la gestoría. */
function botonSubidaNominasHtml(token: string): string {
  const url = urlSubidaNominas(token);
  return `
    <div style="margin:20px 0">
      <a href="${url}"
         style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px">
        Subir nóminas del mes
      </a>
      <p style="color:#888;font-size:12px;margin-top:8px">
        Adjunta un único PDF con todas las nóminas (una por página) o varios archivos.
        Se leen y vuelcan automáticamente al sistema.
      </p>
    </div>`;
}

/**
 * Envía a la gestoría el correo con el enlace de subida de nóminas del `periodo`.
 * Crea/regenera el token. Best-effort. Devuelve `ok:false` con motivo si falta
 * config (sin email o desactivado) o falla el envío.
 */
export async function enviarSolicitudNominasGestoria(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: emp } = await admin
    .from("empresas")
    .select("nombre, nominas_gestoria_activo, nominas_gestoria_email, nominas_gestoria_email_cc")
    .eq("id", empresaId)
    .maybeSingle();
  if (!emp) return { ok: false, error: "Empresa no encontrada" };
  if (emp.nominas_gestoria_activo === false) return { ok: false, error: "Envío a gestoría desactivado" };

  const to = (emp.nominas_gestoria_email as string | null)?.trim();
  if (!to) return { ok: false, error: "Falta el correo de la gestoría" };
  const cc = (emp.nominas_gestoria_email_cc as string | null)?.trim() || undefined;
  const empresaNombre = (emp.nombre as string) ?? "la empresa";

  const tk = await crearTokenNominasGestoria(admin, empresaId, periodo);
  if (!tk.ok) return { ok: false, error: tk.error };

  const boton = botonSubidaNominasHtml(tk.token);
  const enlace = urlSubidaNominas(tk.token);
  const mes = nombreMes(periodo);
  const subject = `Subida de nóminas de ${mes} · ${empresaNombre}`;
  const html = `
    <p>Hola,</p>
    <p>Ya podéis subir las <b>nóminas de ${mes}</b> de ${empresaNombre}.</p>
    <p>Pulsad el botón para adjuntarlas. Podéis subir <b>un único PDF con todas las nóminas</b>
    (una por página) o varios archivos sueltos. Se leen y vuelcan automáticamente al sistema.</p>
    ${boton}
    <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
  const text = `Ya podéis subir las nóminas de ${mes} de ${empresaNombre}. Súbelas aquí: ${enlace}`;

  const res = await sendEmail({ to: cc ? `${to}, ${cc}` : to, subject, html, text, empresaId });
  if (!res.ok) return { ok: false, error: "No se pudo enviar el correo" };
  return { ok: true };
}

/**
 * Núcleo de la subida de nóminas por la gestoría (llamado por la API pública).
 * Lee TODAS las nóminas del archivo con IA, las empareja con los empleados de la
 * empresa y las vuelca a `rrhh_pagos` (neto/SS/IRPF + PDF adjunto). Registra la
 * subida en el token y avisa a RRHH con el resumen si está activado.
 */
export async function procesarSubidaNominasGestoria(
  admin: SupabaseClient,
  row: { id: string; empresa_id: string; periodo: string },
  file: File,
): Promise<{ ok: true; resultado: ResultadoProceso } | { ok: false; error: string; status: number }> {
  if (!file || file.size === 0) return { ok: false, error: "Adjunta la nómina", status: 400 };
  if (file.size > MAX_NOMINAS_BYTES) return { ok: false, error: "El archivo supera 25 MB", status: 400 };
  const mime = resolverMimeNomina(file);
  if (!mime) return { ok: false, error: "Formato no admitido (usa PDF, JPG, PNG o WebP)", status: 400 };

  const buffer = Buffer.from(await file.arrayBuffer());

  let nominas: NominaLeida[];
  try {
    nominas = await extraerNominasDeArchivo(buffer, mime);
  } catch (e) {
    if (e instanceof GeminiKeyMissingError) {
      return { ok: false, error: "El sistema no puede leer nóminas ahora mismo. Avisa a la empresa.", status: 503 };
    }
    console.error("[nominas-gestoria] extraer:", e);
    return { ok: false, error: "No se pudo leer el archivo", status: 500 };
  }
  if (nominas.length === 0) {
    return { ok: false, error: "No se pudo leer ninguna nómina del archivo", status: 422 };
  }

  const resultado = await procesarNominasConAdmin(admin, row.empresa_id, nominas, row.periodo);

  // Registrar la subida en el token (trazabilidad + contador).
  await admin
    .from("nominas_gestoria_tokens")
    .update({
      ultima_subida_en: new Date().toISOString(),
      subidas_count: (await contarSubidas(admin, row.id)) + resultado.guardadas,
    })
    .eq("id", row.id);

  // Histórico del documento subido (auditoría por empresa/mes).
  await registrarSubidaHistorico(admin, {
    empresaId: row.empresa_id,
    periodo: row.periodo,
    origen: "gestoria",
    archivoNombre: file.name,
    archivoBytes: file.size,
    resultado,
  });

  await avisarRrhhNominasSubidas(admin, row.empresa_id, row.periodo, resultado);

  return { ok: true, resultado };
}

/**
 * Guarda en `nominas_gestoria_subidas` el resultado de un volcado (un archivo
 * subido). Best-effort: nunca rompe la subida. Sirve para las dos entradas
 * (enlace público de la gestoría y subida manual autenticada).
 */
export async function registrarSubidaHistorico(
  admin: SupabaseClient,
  params: {
    empresaId: string;
    periodo: string;
    origen: "gestoria" | "manual";
    archivoNombre?: string | null;
    archivoBytes?: number | null;
    creadoPor?: string | null;
    resultado: ResultadoProceso;
  },
): Promise<void> {
  try {
    const r = params.resultado;
    await admin.from("nominas_gestoria_subidas").insert({
      empresa_id: params.empresaId,
      periodo: params.periodo,
      origen: params.origen,
      archivo_nombre: params.archivoNombre ?? null,
      archivo_bytes: params.archivoBytes ?? null,
      leidas: r.leidas,
      guardadas: r.guardadas,
      ya_existian: r.yaExistian,
      sin_empleado: r.sinEmpleado.length,
      mes_incorrecto: r.mesIncorrecto.length,
      detalle: {
        sinEmpleado: r.sinEmpleado,
        mesIncorrecto: r.mesIncorrecto,
        conIncidencia: r.conIncidencia,
      },
      creado_por: params.creadoPor ?? null,
    });
  } catch (e) {
    console.error("[nominas-gestoria] registrarSubidaHistorico:", e);
  }
}

/** Contador actual de subidas del token (para acumular sin condiciones de carrera graves). */
async function contarSubidas(admin: SupabaseClient, tokenId: string): Promise<number> {
  const { data } = await admin
    .from("nominas_gestoria_tokens")
    .select("subidas_count")
    .eq("id", tokenId)
    .maybeSingle();
  return (data?.subidas_count as number) ?? 0;
}

/**
 * Aviso in-app a RRHH (área administrativa) con el resumen del volcado: cuántas
 * se guardaron, cuántas ya estaban y cuántas no cuadraron con ningún empleado.
 */
async function avisarRrhhNominasSubidas(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
  r: ResultadoProceso,
): Promise<void> {
  try {
    const { data: emp } = await admin
      .from("empresas")
      .select("nominas_gestoria_notif_rrhh")
      .eq("id", empresaId)
      .maybeSingle();
    if (emp?.nominas_gestoria_notif_rrhh === false) return;

    const mes = nombreMes(periodo);

    // Detalle de los errores (mismo para ambos casos).
    const detalles: string[] = [];
    if (r.mesIncorrecto.length > 0) {
      const lista = r.mesIncorrecto
        .slice(0, 5)
        .map((x) => `${x.etiqueta} (leída como ${nombreMes(x.periodoLeido)})`)
        .join(", ");
      detalles.push(`De otro mes: ${lista}${r.mesIncorrecto.length > 5 ? "…" : ""}.`);
    }
    if (r.sinEmpleado.length > 0) {
      const lista = r.sinEmpleado.slice(0, 6).join(", ");
      detalles.push(`No dados de alta en el sistema: ${lista}${r.sinEmpleado.length > 6 ? "…" : ""}.`);
    }
    const detalleSin = detalles.length > 0 ? ` ${detalles.join(" ")}` : "";

    // El archivo se rechazó ENTERO (tenía errores): no se volcó nada.
    if (r.rechazadoTodo) {
      await emitirNotificacion({
        empresaId,
        system: true,
        tipo: "nominas_gestoria_subidas",
        titulo: `Archivo de nóminas de ${mes} rechazado`,
        mensaje: `La gestoría subió un archivo con errores: NO se ha volcado ninguna nómina. Debe corregirlo y volver a subirlo.${detalleSin}`,
        segmento: { tipo: "area", area: "ADMINISTRATIVA" },
        refTabla: "empresas",
        refId: empresaId,
        accionUrl: "/rrhh/pagos",
        dedupeKey: `nominas_gestoria_rechazado:${empresaId}:${periodo}:${r.mesIncorrecto.length}:${r.sinEmpleado.length}`,
      });
      return;
    }

    const partes: string[] = [`${r.guardadas} volcada${r.guardadas === 1 ? "" : "s"}`];
    if (r.yaExistian > 0) partes.push(`${r.yaExistian} ya estaba${r.yaExistian === 1 ? "" : "n"}`);
    if (r.conIncidencia > 0) partes.push(`${r.conIncidencia} con incidencia`);

    await emitirNotificacion({
      empresaId,
      system: true,
      tipo: "nominas_gestoria_subidas",
      titulo: `La gestoría subió nóminas de ${mes}`,
      mensaje: `${partes.join(" · ")}.${detalleSin}`,
      segmento: { tipo: "area", area: "ADMINISTRATIVA" },
      refTabla: "empresas",
      refId: empresaId,
      accionUrl: "/rrhh/pagos",
      dedupeKey: `nominas_gestoria_subidas:${empresaId}:${periodo}:${r.guardadas}:${r.sinEmpleado.length}:${r.mesIncorrecto.length}`,
    });
  } catch (e) {
    console.error("[nominas-gestoria] avisarRrhh:", e);
  }
}
