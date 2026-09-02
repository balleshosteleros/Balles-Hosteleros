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

import { createHash } from "node:crypto";
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
  extraerDatosTc1,
} from "@/features/rrhh/services/nominas/extraer-nominas";
import {
  procesarNominasConAdmin,
  BUCKET_NOMINAS,
  EXT_POR_MIME,
  type NominaLeida,
  type ResultadoProceso,
} from "@/features/rrhh/services/nominas/procesar-nominas";
import { mesAnterior, esPeriodoValido } from "@/features/rrhh/lib/nominas-periodos";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";

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

/**
 * Correo de la gestoría de una empresa, de una ÚNICA fuente lógica.
 *
 * Se toma el de Ajustes de empresa (`nominas_gestoria_email`) y, si ahí no hay
 * nada, el que ya está configurado para las altas de personal
 * (`reclutamiento_config.gestoria_email`): es la MISMA gestoría, así que no tiene
 * sentido pedir que se escriba dos veces ni que el envío falle por estar puesto
 * "en el otro sitio".
 */
export async function correoGestoriaEmpresa(
  admin: SupabaseClient,
  empresaId: string,
): Promise<{ to: string | null; cc: string | null }> {
  const { data: emp } = await admin
    .from("empresas")
    .select("datos_generales, nominas_gestoria_email, nominas_gestoria_email_cc")
    .eq("id", empresaId)
    .maybeSingle();

  // FUENTE ÚNICA: Ajustes → Configuración → «Correo gestoría»
  // (`empresas.datos_generales.correoGestoria`). Es el mismo que ya usan el
  // recordatorio de gestoría y el envío de modelos fiscales, así que el correo se
  // escribe UNA vez y vale para todo.
  const dg = (emp?.datos_generales ?? {}) as Record<string, unknown>;
  const deAjustes = typeof dg.correoGestoria === "string" ? dg.correoGestoria.trim() : "";

  // Respaldo: el campo propio de nóminas, por si alguna empresa lo tuviera puesto
  // ahí de antes. No es donde se edita hoy.
  const to = deAjustes || (emp?.nominas_gestoria_email as string | null)?.trim() || null;
  const cc = (emp?.nominas_gestoria_email_cc as string | null)?.trim() || null;
  return { to, cc };
}

/**
 * Mes cuyas nóminas se piden, según el día en que se avisa. Regla: SIEMPRE las
 * últimas nóminas cerradas, para que no haya lío.
 *   • Día 16–31 → el mes EN CURSO (ya se está cerrando).
 *   • Día 1–15  → el mes ANTERIOR (el actual acaba de empezar).
 * La usan tanto el cron como el botón «Enviar ahora», para que no discrepen.
 */
export function mesSolicitado(anio: string, mes: string, diaEnvio: number): string {
  if (diaEnvio >= 16) return `${anio}-${mes}`;
  const d = new Date(Date.UTC(Number(anio), Number(mes) - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Enlace público que abre la gestoría para subir las nóminas del mes. */
export function urlSubidaNominas(token: string): string {
  return `${getSiteUrl()}/gestoria/nominas/${encodeURIComponent(token)}`;
}

/**
 * Devuelve el enlace PERMANENTE de subida de nóminas de una empresa, creándolo
 * la primera vez. Siempre el mismo: no lleva el mes dentro y no caduca.
 *
 * A diferencia del anterior `crearTokenNominasGestoria`, NO regenera nada si ya
 * existe. Aquel generaba un token nuevo en cada aviso y pisaba el anterior, y de
 * ahí venía el fallo que dejó a HABANA con un enlace de julio en el correo de
 * agosto. Para rotarlo a propósito está `regenerarTokenNominasGestoria`.
 */
export async function obtenerOCrearTokenPermanente(
  admin: SupabaseClient,
  empresaId: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const { data } = await admin
      .from("nominas_gestoria_tokens")
      .select("token_plano")
      .eq("empresa_id", empresaId)
      .is("periodo", null)
      .maybeSingle();
    // `token_plano` se guarda en claro a propósito: es lo que permite reenviar
    // SIEMPRE el mismo enlace en cada recordatorio.
    if (data?.token_plano) return { ok: true, token: data.token_plano as string };

    return await regenerarTokenNominasGestoria(admin, empresaId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error obteniendo el enlace de nóminas" };
  }
}

/**
 * Genera un enlace permanente NUEVO para la empresa y descarta el anterior.
 * Es la vía de rotación: si el enlace se filtra o cambia la gestoría, se rota y
 * el viejo deja de valer al instante.
 */
export async function regenerarTokenNominasGestoria(
  admin: SupabaseClient,
  empresaId: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const token = generarToken();
    const tokenHash = hashToken(token);
    const { data: existente } = await admin
      .from("nominas_gestoria_tokens")
      .select("id")
      .eq("empresa_id", empresaId)
      .is("periodo", null)
      .maybeSingle();

    const fila = {
      empresa_id: empresaId,
      periodo: null,
      token_hash: tokenHash,
      token_plano: token,
      expira_en: null,
      cerrado_en: null,
      enviado_en: new Date().toISOString(),
      recordatorio_enviado_en: null,
    };
    const { error } = existente?.id
      ? await admin.from("nominas_gestoria_tokens").update(fila).eq("id", existente.id as string)
      : await admin.from("nominas_gestoria_tokens").insert(fila);
    if (error) return { ok: false, error: error.message };
    return { ok: true, token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error creando el enlace de nóminas" };
  }
}

/**
 * Resuelve el enlace de la gestoría. El enlace identifica SOLO a la empresa: el
 * mes lo elige la gestoría dentro y se valida en cada subida.
 *
 * `expira_en` y `cerrado_en` solo aplican a enlaces antiguos (los que llevaban
 * el mes dentro) y a la revocación manual desde Ajustes.
 */
export async function resolverTokenNominasGestoria(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; row: { id: string; empresa_id: string } }
  | { ok: false; reason: "not_found" | "expired" | "revocado" }
> {
  const tokenHash = hashToken(token);
  const { data } = await admin
    .from("nominas_gestoria_tokens")
    .select("id, empresa_id, periodo, token_hash, expira_en, cerrado_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (!compararToken(token, data.token_hash as string)) return { ok: false, reason: "not_found" };
  if (data.cerrado_en) return { ok: false, reason: "revocado" };
  // Enlace antiguo atado a un mes: caduca como siempre. Los permanentes tienen
  // `expira_en` a null y no entran aquí.
  const expira = data.expira_en as string | null;
  if (expira && new Date(expira).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, row: { id: data.id as string, empresa_id: data.empresa_id as string } };
}

/** Revoca el enlace de la empresa: deja de valer de inmediato. */
export async function cerrarTokenNominasGestoria(
  admin: SupabaseClient,
  tokenId: string,
): Promise<void> {
  await admin
    .from("nominas_gestoria_tokens")
    .update({ cerrado_en: new Date().toISOString() })
    .eq("id", tokenId)
    .is("cerrado_en", null);
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
  // El correo anuncia el MES del que se piden las nóminas; el enlace es el mismo siempre.
): Promise<{ ok: boolean; error?: string }> {
  const { data: emp } = await admin
    .from("empresas")
    .select("nombre, nominas_gestoria_activo, nominas_gestoria_email, nominas_gestoria_email_cc")
    .eq("id", empresaId)
    .maybeSingle();
  if (!emp) return { ok: false, error: "Empresa no encontrada" };
  if (emp.nominas_gestoria_activo === false) return { ok: false, error: "Envío a gestoría desactivado" };

  // Se lee AHORA, en el instante del envío: si se cambia el correo antes de que
  // salga, el aviso va al nuevo. No se guarda ni se cachea en ningún sitio.
  const { to, cc } = await correoGestoriaEmpresa(admin, empresaId);
  if (!to) return { ok: false, error: "Falta el correo de la gestoría" };
  const empresaNombre = (emp.nombre as string) ?? "la empresa";

  // SIEMPRE el mismo enlace: no se regenera en cada aviso (era lo que dejaba a
  // la gestoria con un enlace apuntando al mes equivocado).
  const tk = await obtenerOCrearTokenPermanente(admin, empresaId);
  if (!tk.ok) return { ok: false, error: tk.error };

  const boton = botonSubidaNominasHtml(tk.token);
  const enlace = urlSubidaNominas(tk.token);
  const mes = nombreMes(periodo);
  const subject = `Subida de nóminas de ${mes} · ${empresaNombre}`;
  const html = `
    <p>Hola,</p>
    <p>Ya podéis subir las <b>nóminas de ${mes}</b> de ${empresaNombre}.</p>
    <p>Pulsad el botón, <b>elegid ${mes}</b> en el desplegable y adjuntadlas. Podéis subir
    <b>un único PDF con todas las nóminas</b> (una por página) o varios archivos sueltos, y
    en <b>varias veces</b> si os viene mejor. Se leen y vuelcan automáticamente al sistema.</p>
    ${boton}
    <p style="color:#555;font-size:13px">Este enlace es el <b>mismo siempre</b> y no caduca:
    guardadlo. Dentro elegís el mes de las nóminas y, aparte, el de los seguros sociales.</p>
    <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
  const text = `Ya podéis subir las nóminas de ${mes} de ${empresaNombre}. Súbelas aquí: ${enlace}`;

  const res = await sendEmail({ to: cc ? `${to}, ${cc}` : to, subject, html, text, empresaId });
  if (!res.ok) return { ok: false, error: "No se pudo enviar el correo" };
  return { ok: true };
}

/**
 * RECORDATORIO: reclama las nóminas de un mes que no han llegado. Manda el
 * enlace permanente de la empresa. Si ese MES ya tiene nóminas o RRHH lo
 * confirmó, no se molesta a nadie.
 */
export async function recordarSolicitudNominasGestoria(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
): Promise<{ ok: boolean; error?: string; omitido?: "sin_token" | "ya_subido" }> {
  const { data: emp } = await admin
    .from("empresas")
    .select("nombre, nominas_gestoria_email, nominas_gestoria_email_cc")
    .eq("id", empresaId)
    .maybeSingle();
  // Igual que el aviso: correo leído en el momento de enviar el recordatorio.
  const { to, cc } = await correoGestoriaEmpresa(admin, empresaId);
  if (!to) return { ok: false, error: "Falta el correo de la gestoría" };
  const empresaNombre = (emp?.nombre as string) ?? "la empresa";

  // El enlace permanente de la empresa: el mismo de siempre.
  const { data: tk } = await admin
    .from("nominas_gestoria_tokens")
    .select("id, token_plano, cerrado_en")
    .eq("empresa_id", empresaId)
    .is("periodo", null)
    .maybeSingle();
  if (!tk) return { ok: true, omitido: "sin_token" };
  if (tk.cerrado_en) return { ok: true, omitido: "sin_token" };

  // "Ya subido" ya no lo dice el enlace (es permanente): lo dice el MES. Si ese
  // mes ya tiene nominas o RRHH lo confirmo, no hay nada que recordar.
  const yaEntregado = await mesCerradoParaNominas(admin, empresaId, periodo);
  if (yaEntregado) return { ok: true, omitido: "ya_subido" };
  const { count: yaHay } = await admin
    .from("rrhh_pagos_nominas")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo);
  if ((yaHay ?? 0) > 0) return { ok: true, omitido: "ya_subido" };

  const token = tk.token_plano as string | null;
  if (!token) return { ok: true, omitido: "sin_token" };

  const boton = botonSubidaNominasHtml(token);
  const enlace = urlSubidaNominas(token);
  const mes = nombreMes(periodo);
  const subject = `Recordatorio: faltan las nóminas de ${mes} · ${empresaNombre}`;
  const html = `
    <p>Hola,</p>
    <p>Os recordamos que todavía <b>no hemos recibido las nóminas de ${mes}</b> de ${empresaNombre}.</p>
    <p>Podéis subirlas con <b>el mismo enlace</b> de siempre, eligiendo <b>${mes}</b> en el desplegable:</p>
    ${boton}
    <p>Si ya las habéis enviado por otra vía, avisadnos y no hace falta que hagáis nada.</p>
    <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
  const text = `Recordatorio: faltan las nóminas de ${mes} de ${empresaNombre}. Súbelas aquí: ${enlace}`;

  const res = await sendEmail({ to: cc ? `${to}, ${cc}` : to, subject, html, text, empresaId });
  if (!res.ok) return { ok: false, error: "No se pudo enviar el recordatorio" };

  await admin
    .from("nominas_gestoria_tokens")
    .update({ recordatorio_enviado_en: new Date().toISOString() })
    .eq("id", tk.id as string);
  return { ok: true };
}

/**
 * ¿Este mes admite todavía nóminas? Dos motivos para decir que no:
 *
 *  1. RRHH ya CONFIRMÓ el mes: es inmutable y no se reabre por este camino.
 * NO se bloquea por que el mes ya tenga nóminas: la gestoría entrega en VARIAS
 * tandas (un PDF por empleado, o el lote partido por tamaño), que es justo lo que
 * el correo y la pantalla le prometen. El volcado ya es seguro para repetir:
 * deduplica por huella SHA-256 del archivo, numera cada documento con `orden`
 * para no pisar los anteriores y respeta los pagos con liquidación ya enviada
 * (ver `procesar-nominas.ts`). Quien cierra el mes es RRHH al confirmarlo.
 */
/**
 * Mes en curso EN LA ZONA DE LA EMPRESA ('AAAA-MM'). Nunca con la hora del
 * servidor: a fin de mes la diferencia horaria cambiaría el mes.
 */
export async function mesActualEmpresa(admin: SupabaseClient, empresaId: string): Promise<string> {
  const tz = await getZonaHorariaEmpresa(admin, empresaId);
  return hoyEnZona(tz).slice(0, 7);
}

/** Un mes tal y como lo ve la gestoría en el desplegable. */
export interface EstadoMesNominas {
  periodo: string;
  /** RRHH lo confirmó: inmutable, no admite subidas. */
  cerrado: boolean;
  /** Ya tiene nóminas, pero sigue abierto: puede añadir más tandas. */
  tieneNominas: boolean;
  /** RRHH lo devolvió para corregir. */
  rechazado: boolean;
}

/** Cuántos meses hacia atrás puede elegir la gestoría. */
export const MESES_ELEGIBLES_NOMINAS = 18;

/**
 * Los últimos meses ya terminados y en qué estado está cada uno. Alimenta el
 * desplegable del portal: sin esto la gestoría elegiría el mes a ciegas.
 */
export async function estadoMesesNominas(
  admin: SupabaseClient,
  empresaId: string,
  mesActual: string,
  n: number = MESES_ELEGIBLES_NOMINAS,
): Promise<EstadoMesNominas[]> {
  // Se empieza en el mes ANTERIOR al actual: un mes sin terminar no tiene nóminas.
  const periodos: string[] = [];
  let p = mesAnterior(mesActual);
  for (let i = 0; i < n; i++) {
    periodos.push(p);
    p = mesAnterior(p);
  }

  const [mesesRes, nominasRes] = await Promise.all([
    admin
      .from("rrhh_nominas_mes")
      .select("periodo, confirmado_en, rechazado_en")
      .eq("empresa_id", empresaId)
      .in("periodo", periodos),
    admin
      .from("rrhh_pagos_nominas")
      .select("periodo")
      .eq("empresa_id", empresaId)
      .in("periodo", periodos),
  ]);

  const porMes = new Map<string, { confirmado: boolean; rechazado: boolean }>();
  for (const m of mesesRes.data ?? []) {
    porMes.set(m.periodo as string, {
      confirmado: !!m.confirmado_en,
      rechazado: !!m.rechazado_en,
    });
  }
  const conNominas = new Set((nominasRes.data ?? []).map((r) => r.periodo as string));

  return periodos.map((periodo) => ({
    periodo,
    cerrado: porMes.get(periodo)?.confirmado ?? false,
    rechazado: porMes.get(periodo)?.rechazado ?? false,
    tieneNominas: conNominas.has(periodo),
  }));
}

/**
 * Valida el mes que manda la gestoría. Con enlace permanente el mes lo elige
 * ella, así que ESTA es la única barrera: el token ya no acota nada.
 */
export async function validarPeriodoSubida(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
  mesActual: string,
): Promise<{ ok: false; error: string; status: number } | null> {
  if (!periodo) return { ok: false, error: "Elige el mes al que corresponden.", status: 400 };
  if (!esPeriodoValido(periodo)) return { ok: false, error: "Mes no válido.", status: 400 };
  if (periodo >= mesActual) {
    return { ok: false, error: "Ese mes todavía no ha terminado.", status: 400 };
  }
  // Un enlace que no caduca no debe poder escribir en cualquier mes de la
  // historia: se acota a la misma ventana que ofrece el desplegable.
  let limite = mesAnterior(mesActual);
  for (let i = 1; i < MESES_ELEGIBLES_NOMINAS; i++) limite = mesAnterior(limite);
  if (periodo < limite) {
    return { ok: false, error: "Ese mes es demasiado antiguo. Avisa a la empresa.", status: 400 };
  }
  return await mesCerradoParaNominas(admin, empresaId, periodo);
}

async function mesCerradoParaNominas(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
): Promise<{ ok: false; error: string; status: number } | null> {
  const { data: mesRow } = await admin
    .from("rrhh_nominas_mes")
    .select("confirmado_en")
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo)
    .maybeSingle();
  if (mesRow?.confirmado_en) {
    return {
      ok: false,
      error: `Las nóminas de ${nombreMes(periodo)} ya están subidas y cerradas: no se pueden volver a subir.`,
      status: 409,
    };
  }

  return null;
}

/**
 * Núcleo de la subida de nóminas por la gestoría (llamado por la API pública).
 * Lee TODAS las nóminas del archivo con IA, las empareja con los empleados de la
 * empresa y las vuelca a `rrhh_pagos` (neto/SS/IRPF + PDF adjunto). Registra la
 * subida en el token y avisa a RRHH con el resumen si está activado.
 */
export async function procesarSubidaNominasGestoria(
  admin: SupabaseClient,
  row: { id: string; empresa_id: string },
  periodo: string,
  file: File,
): Promise<{ ok: true; resultado: ResultadoProceso } | { ok: false; error: string; status: number }> {
  if (!file || file.size === 0) return { ok: false, error: "Adjunta la nómina", status: 400 };
  if (file.size > MAX_NOMINAS_BYTES) {
    const mb = Math.round(MAX_NOMINAS_BYTES / (1024 * 1024));
    return {
      ok: false,
      error:
        `El archivo supera ${mb} MB, que es el máximo que la lectura automática procesa de forma fiable. ` +
        `Divide las nóminas en varios archivos y súbelos por separado.`,
      status: 400,
    };
  }
  const mime = resolverMimeNomina(file);
  if (!mime) return { ok: false, error: "Formato no admitido (usa PDF, JPG, PNG o WebP)", status: 400 };

  // Un mes solo admite UNA entrega de nóminas. Se comprueba ANTES de leer con IA:
  // no tiene sentido gastar la lectura de un archivo que no se va a guardar.
  const bloqueo = await mesCerradoParaNominas(admin, row.empresa_id, periodo);
  if (bloqueo) return bloqueo;

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

  // Nota: si el mes estaba DEVUELTO a la gestoría, `procesarNominasConAdmin` lo
  // devuelve a BORRADOR por su cuenta (es el punto común de las dos vías de subida).
  const resultado = await procesarNominasConAdmin(admin, row.empresa_id, nominas, periodo);

  // Registrar la subida en el token (trazabilidad + contador). El enlace NO se
  // cierra aquí: hacen falta LOS DOS documentos (nóminas + TC1), y el TC1 puede
  // llegar después. De cerrarlo ahora, no podrían adjuntarlo.
  await admin
    .from("nominas_gestoria_tokens")
    .update({
      ultima_subida_en: new Date().toISOString(),
      subidas_count: (await contarSubidas(admin, row.id)) + resultado.guardadas,
    })
    .eq("id", row.id);

  // ¿Están ya los dos? Entonces se cuadra y se cierra.
  if (resultado.guardadas > 0 && !resultado.rechazadoTodo) {
  }

  // Histórico del documento subido (auditoría por empresa/mes).
  await registrarSubidaHistorico(admin, {
    empresaId: row.empresa_id,
    periodo: periodo,
    origen: "gestoria",
    archivoNombre: file.name,
    archivoBytes: file.size,
    resultado,
  });

  await avisarRrhhNominasSubidas(admin, row.empresa_id, periodo, resultado);

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

/**
 * Guarda el TC1 (Recibo de Liquidación de Cotizaciones) que sube la gestoría por
 * el enlace público. Es un documento de EMPRESA —bases y cuotas de toda la
 * plantilla—, así que NO pasa por la lectura de nóminas ni se asigna a ningún
 * empleado: va a `rrhh_nominas_mes`, que es el registro del mes.
 */
export async function guardarTc1Gestoria(
  admin: SupabaseClient,
  row: { id: string; empresa_id: string },
  periodo: string,
  file: File,
  /**
   * Mes que se está COTIZANDO en este recibo, elegido por la gestoría. Con las
   * nóminas de agosto llega el TC1 de julio: la Seguridad Social se liquida a mes
   * vencido y así lo hacen siempre. Si no se indica, se asume esa misma regla (el
   * mes anterior al de la entrega).
   *
   * No cambia a qué mes SUMA el importe: eso lo sigue mandando `periodo`, que es
   * el mes de la entrega con la que llega el recibo.
   */
  periodoCotizacion?: string | null,
): Promise<{ ok: true; periodoCotizacion: string } | { ok: false; error: string; status: number }> {
  if (!file || file.size === 0) return { ok: false, error: "Adjunta el TC1", status: 400 };
  if (file.size > MAX_NOMINAS_BYTES) {
    const mb = Math.round(MAX_NOMINAS_BYTES / (1024 * 1024));
    return { ok: false, error: `El archivo supera ${mb} MB.`, status: 400 };
  }
  const ext = EXT_POR_MIME[file.type];
  if (!ext) return { ok: false, error: "Formato no admitido. Usa un PDF o una imagen.", status: 400 };

  // Mes cotizado: el que elige la gestoría. Sin elección válida, el anterior al de
  // la entrega, que es la regla de siempre (Seguridad Social a mes vencido).
  const mesCotizado = esPeriodoValido(periodoCotizacion)
    ? (periodoCotizacion as string)
    : mesAnterior(periodo);

  // El mes ya confirmado por RRHH es inmutable: tampoco se le cambia el TC1.
  const { data: mesRow } = await admin
    .from("rrhh_nominas_mes")
    .select("confirmado_en")
    .eq("empresa_id", row.empresa_id)
    .eq("periodo", periodo)
    .maybeSingle();
  if (mesRow?.confirmado_en) {
    return { ok: false, error: "Las nóminas de este mes ya están cerradas por la empresa.", status: 409 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // La huella va en el nombre del archivo: la gestoría manda a menudo DOS TC1 del
  // mismo mes (la liquidación ordinaria y la complementaria de vacaciones) y con
  // un nombre fijo el segundo pisaba al primero. Re-subir el MISMO documento cae
  // en el mismo path, así que tampoco se cuenta dos veces.
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const path = `${row.empresa_id}/${periodo}/TC1-${sha256.slice(0, 12)}.${ext}`;
  const up = await admin.storage
    .from(BUCKET_NOMINAS)
    .upload(path, buffer, { upsert: true, contentType: file.type });
  if (up.error) return { ok: false, error: up.error.message, status: 500 };

  // Se lee con IA el líquido total y el nº de trabajadores: son los datos que
  // permiten cuadrarlo con las nóminas. Si la IA no está disponible o no los lee,
  // el TC1 se guarda igual (sin comprobación automática).
  const datos = await extraerDatosTc1(buffer, file.type);

  const { error } = await admin.from("rrhh_nominas_tc1").upsert(
    {
      empresa_id: row.empresa_id,
      periodo: periodo,
      path,
      nombre: file.name,
      importe: datos.liquidoTotal,
      trabajadores: datos.trabajadores,
      // Mes cotizado: lo que ha DICHO la gestoría.
      periodo_cotizacion: mesCotizado,
      // Mes que declara el papel según la IA: sirve para contrastar lo elegido.
      periodo_documento: datos.periodo || null,
      subido_en: new Date().toISOString(),
    },
    { onConflict: "empresa_id,path" },
  );
  if (error) return { ok: false, error: error.message, status: 500 };

  // Si las nóminas ya estaban, con el TC1 se completa el envío: se cierra.
  return { ok: true, periodoCotizacion: mesCotizado };
}

/**
 * Margen admitido al cuadrar TC1 contra nóminas. CERO: tiene que ir EXACTO, ni un
 * céntimo de diferencia. Se deja como constante por si algún día hiciera falta
 * holgura, pero por defecto no se admite ninguna.
 */
const CUADRE_TOLERANCIA_EUR = 0;

/** Cuadre de UN mes cotizado: sus recibos contra las nóminas de ESE mes. */
export interface CuadreMesCotizado {
  /** Mes que se cotiza (AAAA-MM). */
  periodo: string;
  /** Cotizaciones (trabajador + empresa) de las nóminas de ese mes. */
  totalNominas: number;
  /** Suma de los líquidos de sus recibos, si se han podido leer. */
  totalTc1: number | null;
  diferencia: number | null;
  cuadra: boolean;
  /** Nóminas de ese mes que hay en el sistema. */
  numNominas: number;
  numTc1: number;
  tc1SinImporte: number;
  /**
   * No hay NINGUNA nómina de ese mes: no es que no cuadre, es que todavía no hay
   * contra qué comparar. Pasa al recibir el TC1 de un mes cuyas nóminas aún no se
   * han subido, que es lo normal si la entrega va con retraso.
   */
  sinNominas: boolean;
}

export interface CuadreTc1 {
  /** Total de cotizaciones sumado de las nóminas (trabajador + empresa). */
  totalNominas: number;
  /** SUMA de los líquidos de TODOS los TC1 del mes, si se han podido leer. */
  totalTc1: number | null;
  diferencia: number | null;
  cuadra: boolean;
  /** Nº de nóminas volcadas frente a los trabajadores que declara el TC1. */
  numNominas: number;
  trabajadoresTc1: number | null;
  /** Cuántos TC1 hay adjuntos al mes (ordinaria + complementarias). */
  numTc1: number;
  /** Alguno de los TC1 se guardó sin líquido legible: el cuadre no es fiable. */
  tc1SinImporte: number;
  /**
   * Desglose por MES COTIZADO. Es el cuadre que de verdad importa: cada recibo se
   * compara con las nóminas del mes que cotiza, no con las de la entrega.
   */
  porMesCotizado: CuadreMesCotizado[];
  /** Meses cotizados cuyos recibos están a la espera de sus nóminas. */
  mesesSinNominas: string[];
}

/**
 * Compara los TC1 con las nóminas del mes que COTIZAN. Son el MISMO dinero
 * expresado de dos formas: el TC1 agrupa por concepto de cotización, y las
 * nóminas lo reparten por trabajador, así que la suma de (SS trabajador + SS
 * empresa) debe coincidir con el líquido del recibo.
 *
 * OJO con el mes: la Seguridad Social se liquida a mes VENCIDO, así que en la
 * entrega de agosto llegan las nóminas de agosto y el TC1 de JULIO. Comparar ese
 * recibo con las nóminas de agosto da un descuadre falso: son meses distintos.
 * Por eso cada recibo se cuadra contra las nóminas de SU mes cotizado, y la
 * entrega puede llevar recibos de varios meses (una complementaria atrasada).
 */
export async function cuadrarTc1ConNominas(
  admin: SupabaseClient,
  empresaId: string,
  periodo: string,
): Promise<CuadreTc1> {
  // TODOS los TC1 de la entrega: la ordinaria y las complementarias son cargos
  // distintos que la empresa ingresa por separado.
  const { data: tc1s } = await admin
    .from("rrhh_nominas_tc1")
    .select("importe, trabajadores, periodo_cotizacion")
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo);

  const lista = tc1s ?? [];
  // Mes que cotiza cada recibo. Sin dato (histórico antiguo), el anterior al de
  // la entrega, que es la regla de siempre.
  const mesDe = (t: { periodo_cotizacion: string | null }): string =>
    (t.periodo_cotizacion as string | null) ?? mesAnterior(periodo);
  const mesesCotizados = [...new Set(lista.map(mesDe))].sort();

  // Cotizaciones de las nóminas de TODOS los meses implicados, de una vez.
  const { data: filasNominas } = await admin
    .from("rrhh_pagos_nominas")
    .select("periodo, ss_empleado, ss_empresa")
    .eq("empresa_id", empresaId)
    .in("periodo", mesesCotizados.length > 0 ? mesesCotizados : [periodo])
    .neq("revision_estado", "denegada");

  const ssPorMes = new Map<string, { total: number; n: number }>();
  for (const f of filasNominas ?? []) {
    const p = f.periodo as string;
    const acc = ssPorMes.get(p) ?? { total: 0, n: 0 };
    acc.total += Number(f.ss_empleado ?? 0) + Number(f.ss_empresa ?? 0);
    acc.n += 1;
    ssPorMes.set(p, acc);
  }

  const porMesCotizado: CuadreMesCotizado[] = mesesCotizados.map((mes) => {
    const recibos = lista.filter((t) => mesDe(t) === mes);
    const conImp = recibos.filter((t) => t.importe != null);
    const tc1Mes =
      conImp.length > 0
        ? Math.round(conImp.reduce((a, t) => a + Number(t.importe), 0) * 100) / 100
        : null;
    const acc = ssPorMes.get(mes) ?? { total: 0, n: 0 };
    const nominasMes = Math.round(acc.total * 100) / 100;
    const dif = tc1Mes != null ? Math.round((tc1Mes - nominasMes) * 100) / 100 : null;
    // Sin nóminas de ese mes no hay comparación posible: ni cuadra ni descuadra.
    const sinNominas = acc.n === 0;
    return {
      periodo: mes,
      totalNominas: nominasMes,
      totalTc1: tc1Mes,
      diferencia: sinNominas ? null : dif,
      cuadra:
        sinNominas ||
        dif == null ||
        recibos.length !== conImp.length ||
        Math.abs(dif) <= CUADRE_TOLERANCIA_EUR,
      numNominas: acc.n,
      numTc1: recibos.length,
      tc1SinImporte: recibos.length - conImp.length,
      sinNominas,
    };
  });

  const conImporte = lista.filter((t) => t.importe != null);
  const totalTc1 =
    conImporte.length > 0
      ? Math.round(conImporte.reduce((a, t) => a + Number(t.importe), 0) * 100) / 100
      : null;

  // Totales de cara a la pantalla: se refieren a los meses que SÍ tienen nóminas,
  // para no restar contra un cero que solo significa "aún no han llegado".
  const comparables = porMesCotizado.filter((m) => !m.sinNominas);
  const totalNominas =
    Math.round(comparables.reduce((a, m) => a + m.totalNominas, 0) * 100) / 100;
  const totalTc1Comparable = comparables.some((m) => m.totalTc1 != null)
    ? Math.round(comparables.reduce((a, m) => a + (m.totalTc1 ?? 0), 0) * 100) / 100
    : null;
  const diferencia =
    totalTc1Comparable != null
      ? Math.round((totalTc1Comparable - totalNominas) * 100) / 100
      : null;

  // Trabajadores: se suman los declarados por cada recibo. En un mes con
  // complementaria, la misma persona puede contar en los dos; es orientativo.
  const trabajadores = lista
    .map((t) => (t.trabajadores != null ? Number(t.trabajadores) : null))
    .filter((n): n is number => n != null);

  return {
    totalNominas,
    totalTc1,
    diferencia,
    // Cuadra solo si cuadran TODOS los meses comparables. Los que esperan sus
    // nóminas no cuentan como descuadre: no hay nada contra qué contrastar.
    cuadra: porMesCotizado.every((m) => m.cuadra),
    numNominas: comparables.reduce((a, m) => a + m.numNominas, 0),
    trabajadoresTc1: trabajadores.length > 0 ? trabajadores.reduce((a, n) => a + n, 0) : null,
    numTc1: lista.length,
    tc1SinImporte: lista.length - conImporte.length,
    porMesCotizado,
    mesesSinNominas: porMesCotizado.filter((m) => m.sinNominas).map((m) => m.periodo),
  };
}

