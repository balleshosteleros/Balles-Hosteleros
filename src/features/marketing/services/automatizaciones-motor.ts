/**
 * El motor: coge lo que está pendiente y avanza un paso cada vez.
 *
 * La ejecución no vive en memoria. Cada disparo es una fila con "por qué paso
 * voy" y "cuándo toca seguir": una espera de siete días es esa fecha puesta
 * siete días por delante, nada más. Así el proceso puede morirse, desplegarse
 * o dormir un fin de semana entero sin perder ninguna automatización a medias.
 *
 * Tres seguros antes de que salga un solo mensaje:
 *   1. La automatización tiene que estar Activa.
 *   2. En modo prueba se escribe el historial pero NO se envía nada.
 *   3. Un cliente que dijo que no a la publicidad no recibe nada, aunque la
 *      automatización lo pida.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { enviarMensaje } from "@/lib/mensajeria/enviar";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import type { ContextoDisparo } from "./automatizaciones-barrido";
import type { Paso, PasoEsperar } from "@/features/marketing/data/automatizaciones";

/** Cuántas ejecuciones avanza el cron en una pasada. */
const MAX_POR_TIRADA = 100;
/** Tras tres intentos fallidos, la ejecución se marca en error y deja de reintentarse. */
const MAX_INTENTOS = 3;

interface EjecucionRow {
  id: string;
  empresa_id: string;
  automatizacion_id: string;
  contexto: ContextoDisparo;
  paso_actual: number;
  historial: LineaHistorial[];
  intentos: number;
}

interface AutomRow {
  id: string;
  nombre: string;
  pasos: Paso[];
  estado: string;
  modo_prueba: boolean;
  ejecuciones_total: number;
}

interface LineaHistorial {
  paso: number;
  tipo: string;
  resultado: "enviado" | "simulado" | "saltado" | "cortado" | "error";
  detalle?: string;
  at: string;
}

// ─── Textos ──────────────────────────────────────────────────

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return `${Number(d)} de ${MESES[Number(m) - 1] ?? ""} de ${a}`;
}

/** Rellena los huecos del texto con los datos de este cliente. */
export function rellenar(texto: string, ctx: ContextoDisparo, restaurante: string): string {
  return texto
    .replaceAll("{nombre}", ctx.nombre || "cliente")
    .replaceAll("{restaurante}", restaurante)
    .replaceAll("{fecha}", fechaLarga(ctx.fecha))
    .replaceAll("{hora}", (ctx.hora ?? "").slice(0, 5))
    .replaceAll("{personas}", ctx.personas ? String(ctx.personas) : "");
}

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** El texto que escribió el usuario, convertido en un correo presentable. */
function comoHtml(texto: string): string {
  const parrafos = texto
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapar(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;color:#1f2937;max-width:560px">${parrafos}</div>`;
}

// ─── Condiciones ─────────────────────────────────────────────

/** ¿Se cumple el "seguir solo si"? Si no, la automatización para aquí. */
async function seCumple(
  db: SupabaseClient,
  empresaId: string,
  paso: Extract<Paso, { tipo: "solo_si" }>,
  ctx: ContextoDisparo,
): Promise<{ ok: boolean; motivo: string }> {
  switch (paso.condicion) {
    case "acepta_marketing": {
      const ok = ctx.aceptaEmail === true || ctx.aceptaWhatsapp === true || ctx.aceptaSms === true;
      return { ok, motivo: ok ? "acepta publicidad" : "el cliente no acepta publicidad" };
    }
    case "es_primera_visita": {
      const ok = (ctx.visitas ?? 0) <= 1;
      return { ok, motivo: ok ? "es su primera visita" : "ya había venido antes" };
    }
    case "visitas_min": {
      const minimo = paso.valor ?? 2;
      const ok = (ctx.visitas ?? 0) >= minimo;
      return { ok, motivo: ok ? `tiene ${ctx.visitas} visitas` : `solo tiene ${ctx.visitas ?? 0} visitas` };
    }
    case "no_ha_vuelto": {
      if (!ctx.clienteId) return { ok: true, motivo: "sin ficha de cliente que comprobar" };
      const desde = ctx.referenciaFecha ?? new Date().toISOString().slice(0, 10);
      const { count } = await db
        .from("reservas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("cliente_id", ctx.clienteId)
        .gt("fecha", desde)
        .not("estado", "in", "(CANCELADA,LIBERADA,NO_SHOW)");
      const ok = (count ?? 0) === 0;
      return { ok, motivo: ok ? "no ha vuelto" : "ya ha vuelto a reservar" };
    }
  }
}

// ─── Un paso ─────────────────────────────────────────────────

async function ejecutarPaso(
  db: SupabaseClient,
  empresaId: string,
  restaurante: string,
  paso: Paso,
  ctx: ContextoDisparo,
  modoPrueba: boolean,
): Promise<{ resultado: LineaHistorial["resultado"]; detalle: string }> {
  switch (paso.tipo) {
    case "email": {
      if (!ctx.email) return { resultado: "saltado", detalle: "el cliente no tiene correo" };
      if (ctx.aceptaEmail === false) return { resultado: "saltado", detalle: "no acepta correos comerciales" };
      const asunto = rellenar(paso.asunto, ctx, restaurante);
      if (modoPrueba) return { resultado: "simulado", detalle: `correo a ${ctx.email}: "${asunto}"` };
      const r = await sendEmail({
        to: ctx.email,
        subject: asunto,
        html: comoHtml(rellenar(paso.texto, ctx, restaurante)),
        empresaId,
      });
      return r.ok
        ? { resultado: "enviado", detalle: `correo a ${ctx.email}` }
        : { resultado: "error", detalle: "error" in r ? r.error : "no hay correo configurado" };
    }

    case "whatsapp":
    case "sms": {
      if (!ctx.telefono) return { resultado: "saltado", detalle: "el cliente no tiene teléfono" };
      const acepta = paso.tipo === "whatsapp" ? ctx.aceptaWhatsapp : ctx.aceptaSms;
      if (acepta === false) return { resultado: "saltado", detalle: "no acepta mensajes comerciales" };
      const texto = rellenar(paso.texto, ctx, restaurante);
      if (modoPrueba) return { resultado: "simulado", detalle: `${paso.tipo} a ${ctx.telefono}` };
      const r = await enviarMensaje({
        empresaId,
        tipo: "CAMPANA",
        telefono: ctx.telefono,
        plantillaWhatsapp: paso.tipo === "whatsapp" ? paso.plantilla : undefined,
        variables: paso.tipo === "whatsapp" ? [ctx.nombre] : undefined,
        textoSms: texto,
        actor: { origen: "AUTOMATICO" },
      });
      return r.ok
        ? { resultado: "enviado", detalle: `${r.canal.toLowerCase()} a ${ctx.telefono}` }
        : { resultado: "error", detalle: r.motivo };
    }

    case "aviso": {
      if (!paso.departamentoId) return { resultado: "saltado", detalle: "falta elegir el departamento" };
      const mensaje = rellenar(paso.texto, ctx, restaurante);
      if (modoPrueba) return { resultado: "simulado", detalle: "aviso al departamento" };
      const r = await emitirNotificacion({
        empresaId,
        tipo: "alerta",
        titulo: rellenar(paso.titulo, ctx, restaurante),
        mensaje,
        segmento: { tipo: "departamento", departamentoId: paso.departamentoId },
        accionUrl: "/marketing/automatizaciones",
        system: true,
      });
      return r.ok
        ? { resultado: "enviado", detalle: `aviso a ${r.destinatarios} personas` }
        : { resultado: "error", detalle: "no se pudo avisar al departamento" };
    }

    case "solo_si": {
      const { ok, motivo } = await seCumple(db, empresaId, paso, ctx);
      return ok ? { resultado: "saltado", detalle: motivo } : { resultado: "cortado", detalle: motivo };
    }

    case "esperar":
      // Las esperas no se "ejecutan": las resuelve el bucle fijando la fecha.
      return { resultado: "saltado", detalle: "" };
  }
}

function cuandoToca(paso: PasoEsperar): string {
  const d = new Date();
  if (paso.unidad === "minutos") d.setMinutes(d.getMinutes() + paso.cantidad);
  else if (paso.unidad === "horas") d.setHours(d.getHours() + paso.cantidad);
  else d.setDate(d.getDate() + paso.cantidad);
  return d.toISOString();
}

// ─── Una ejecución ───────────────────────────────────────────

async function avanzar(
  db: SupabaseClient,
  ejec: EjecucionRow,
  autom: AutomRow,
  restaurante: string,
): Promise<"hecha" | "pendiente" | "cortada" | "error"> {
  const historial: LineaHistorial[] = Array.isArray(ejec.historial) ? [...ejec.historial] : [];
  let paso = ejec.paso_actual;
  let huboError = false;

  while (paso < autom.pasos.length) {
    const actual = autom.pasos[paso];

    // Una espera corta la pasada: se apunta para cuándo y se sale. Al volver,
    // se entra ya por el paso siguiente, así que nunca espera dos veces.
    if (actual.tipo === "esperar") {
      await db
        .from("marketing_automatizacion_ejecuciones")
        .update({ paso_actual: paso + 1, ejecutar_en: cuandoToca(actual), historial })
        .eq("id", ejec.id);
      return "pendiente";
    }

    const { resultado, detalle } = await ejecutarPaso(
      db, ejec.empresa_id, restaurante, actual, ejec.contexto, autom.modo_prueba,
    );
    historial.push({ paso, tipo: actual.tipo, resultado, detalle, at: new Date().toISOString() });

    if (resultado === "cortado") {
      await db
        .from("marketing_automatizacion_ejecuciones")
        .update({ estado: "cortada", paso_actual: paso, historial })
        .eq("id", ejec.id);
      return "cortada";
    }
    if (resultado === "error") huboError = true;
    paso += 1;
  }

  // Un error por el camino (un correo que no salió) no anula lo demás: la
  // ejecución termina, pero queda marcada para que se vea en el historial.
  await db
    .from("marketing_automatizacion_ejecuciones")
    .update({
      estado: huboError ? "error" : "hecha",
      paso_actual: paso,
      historial,
      ultimo_error: huboError ? historial.filter((h) => h.resultado === "error").pop()?.detalle ?? null : null,
    })
    .eq("id", ejec.id);
  return huboError ? "error" : "hecha";
}

// ─── Entrada pública ─────────────────────────────────────────

export interface ResultadoTirada {
  procesadas: number;
  hechas: number;
  cortadas: number;
  errores: number;
}

/**
 * Avanza todas las ejecuciones que ya tocan. Nunca lanza: un fallo con un
 * cliente no puede dejar sin procesar a los demás.
 */
export async function procesarPendientes(db: SupabaseClient): Promise<ResultadoTirada> {
  const res: ResultadoTirada = { procesadas: 0, hechas: 0, cortadas: 0, errores: 0 };

  const { data: pendientes } = await db
    .from("marketing_automatizacion_ejecuciones")
    .select("id, empresa_id, automatizacion_id, contexto, paso_actual, historial, intentos")
    .eq("estado", "pendiente")
    .lte("ejecutar_en", new Date().toISOString())
    .lt("intentos", MAX_INTENTOS)
    .order("ejecutar_en", { ascending: true })
    .limit(MAX_POR_TIRADA);

  const filas = (pendientes ?? []) as unknown as EjecucionRow[];
  if (filas.length === 0) return res;

  // Las automatizaciones y los nombres de empresa se leen una vez por tirada.
  const automIds = Array.from(new Set(filas.map((f) => f.automatizacion_id)));
  const { data: automs } = await db
    .from("marketing_automatizaciones")
    .select("id, nombre, pasos, estado, modo_prueba, ejecuciones_total")
    .in("id", automIds);
  const porId = new Map<string, AutomRow>();
  for (const a of (automs ?? []) as unknown as AutomRow[]) porId.set(a.id, a);

  const empresaIds = Array.from(new Set(filas.map((f) => f.empresa_id)));
  const { data: empresas } = await db.from("empresas").select("id, nombre").in("id", empresaIds);
  const nombreEmpresa = new Map<string, string>();
  for (const e of empresas ?? []) nombreEmpresa.set(e.id as string, (e.nombre as string) ?? "el restaurante");

  for (const ejec of filas) {
    const autom = porId.get(ejec.automatizacion_id);

    // Apagada mientras había cola: lo pendiente se descarta, no se envía tarde.
    if (!autom || autom.estado !== "Activo") {
      await db
        .from("marketing_automatizacion_ejecuciones")
        .update({ estado: "cortada", ultimo_error: "la automatización se apagó" })
        .eq("id", ejec.id);
      res.cortadas += 1;
      continue;
    }

    res.procesadas += 1;
    try {
      const fin = await avanzar(db, ejec, autom, nombreEmpresa.get(ejec.empresa_id) ?? "el restaurante");
      if (fin === "hecha") res.hechas += 1;
      if (fin === "cortada") res.cortadas += 1;
      if (fin === "error") res.errores += 1;
      if (fin === "hecha" || fin === "error") {
        await db
          .from("marketing_automatizaciones")
          .update({ ejecuciones_total: autom.ejecuciones_total + 1, ultima_ejecucion: new Date().toISOString() })
          .eq("id", autom.id);
        autom.ejecuciones_total += 1;
      }
    } catch (err) {
      res.errores += 1;
      const detalle = err instanceof Error ? err.message : "fallo inesperado";
      console.error("[automatizaciones] ejecución", ejec.id, detalle);
      await db
        .from("marketing_automatizacion_ejecuciones")
        .update({ intentos: ejec.intentos + 1, ultimo_error: detalle })
        .eq("id", ejec.id);
    }
  }

  return res;
}
