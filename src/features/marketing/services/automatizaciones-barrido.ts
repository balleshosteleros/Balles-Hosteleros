/**
 * El vigilante: mira qué ha pasado y crea las ejecuciones que falten.
 *
 * No se engancha a reservas ni a clientes. Cada pocos minutos pregunta a la
 * base de datos "¿qué ha cambiado?" y anota los disparos nuevos. Es más lento
 * que un enganche —minutos, no segundos— y a cambio ningún fallo aquí puede
 * tumbar una reserva, que es lo que de verdad no puede caerse.
 *
 * Repetir el barrido no duplica nada: cada disparo lleva una `dedupe_key`
 * única por automatización, y la BD rechaza el segundo intento. Por eso la
 * ventana mira dos días hacia atrás sin miedo: si el cron estuvo caído una
 * tarde, al volver recupera lo que se perdió.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Automatizacion, Disparador } from "@/features/marketing/data/automatizaciones";

/** Cuánto mira hacia atrás el barrido. Cubre un cron caído un día entero. */
const VENTANA_DIAS = 2;

/** Lo que el motor necesita saber del cliente sin volver a consultar. */
export interface ContextoDisparo {
  nombre: string;
  email: string | null;
  telefono: string | null;
  clienteId: string | null;
  reservaId?: string | null;
  fecha?: string | null;
  hora?: string | null;
  personas?: number | null;
  visitas?: number | null;
  aceptaEmail: boolean | null;
  aceptaSms: boolean | null;
  aceptaWhatsapp: boolean | null;
  /** Desde cuándo se mira si "no ha vuelto". */
  referenciaFecha?: string | null;
}

interface Disparo {
  entidadTipo: "reserva" | "cliente" | "resena";
  entidadId: string;
  dedupeKey: string;
  contexto: ContextoDisparo;
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function desdeISO(a: Automatizacion): string {
  const ventana = new Date();
  ventana.setDate(ventana.getDate() - VENTANA_DIAS);
  // Lo anterior a la activación NO cuenta: encender "bienvenida al cliente
  // nuevo" no puede escribir a los cuatro mil clientes del histórico.
  const activada = a.activadaAt ? new Date(a.activadaAt) : ventana;
  return (activada > ventana ? activada : ventana).toISOString();
}

function diasDesde(fechaISO: string, dias: number): string {
  const d = new Date(fechaISO);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

// ─── Permisos de marketing del cliente ───────────────────────

type PermisoRow = {
  id: string;
  acepta_marketing_email: boolean | null;
  acepta_marketing_sms: boolean | null;
  acepta_marketing_whatsapp: boolean | null;
  visitas: number | null;
};

async function permisosDeClientes(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, PermisoRow>> {
  const mapa = new Map<string, PermisoRow>();
  const limpios = Array.from(new Set(ids.filter(Boolean)));
  if (limpios.length === 0) return mapa;
  const { data } = await db
    .from("clientes_sala")
    .select("id, acepta_marketing_email, acepta_marketing_sms, acepta_marketing_whatsapp, visitas")
    .in("id", limpios);
  for (const row of (data ?? []) as PermisoRow[]) mapa.set(row.id, row);
  return mapa;
}

// ─── Disparadores sobre reservas ─────────────────────────────

async function disparosDeReservas(
  db: SupabaseClient,
  a: Automatizacion,
): Promise<Disparo[]> {
  const desde = desdeISO(a);
  let q = db
    .from("reservas")
    .select("id, cliente_id, cliente_nombre, cliente_email, cliente_telefono, fecha, hora, personas, estado, created_at")
    .eq("empresa_id", a.empresaId)
    .limit(300);

  if (a.disparador === "reserva_nueva") {
    q = q.gte("created_at", desde).not("estado", "in", "(CANCELADA,LIBERADA)");
  } else if (a.disparador === "visita_terminada") {
    // Ya ha pasado y el cliente se sentó. La reserva de madrugada lleva la
    // fecha de su día de negocio, así que "fecha anterior a hoy" basta.
    q = q.eq("estado", "SENTADA").gte("fecha", diasDesde(hoyISO(), VENTANA_DIAS)).lt("fecha", hoyISO());
  } else {
    q = q.eq("estado", "NO_SHOW").gte("fecha", diasDesde(hoyISO(), VENTANA_DIAS)).lte("fecha", hoyISO());
  }

  const { data } = await q;
  const filas = (data ?? []) as Record<string, unknown>[];
  if (filas.length === 0) return [];

  // Una reserva creada antes de activar la automatización no cuenta.
  const activada = a.activadaAt ? new Date(a.activadaAt).getTime() : 0;
  const validas = filas.filter((r) => new Date(r.created_at as string).getTime() >= activada);

  const permisos = await permisosDeClientes(db, validas.map((r) => (r.cliente_id as string) ?? ""));

  return validas.map((r) => {
    const p = r.cliente_id ? permisos.get(r.cliente_id as string) : undefined;
    return {
      entidadTipo: "reserva" as const,
      entidadId: r.id as string,
      dedupeKey: `reserva:${r.id as string}`,
      contexto: {
        nombre: ((r.cliente_nombre as string) ?? "").trim() || "cliente",
        email: (r.cliente_email as string) ?? null,
        telefono: (r.cliente_telefono as string) ?? null,
        clienteId: (r.cliente_id as string) ?? null,
        reservaId: r.id as string,
        fecha: (r.fecha as string) ?? null,
        hora: (r.hora as string) ?? null,
        personas: (r.personas as number) ?? null,
        visitas: p?.visitas ?? null,
        aceptaEmail: p?.acepta_marketing_email ?? null,
        aceptaSms: p?.acepta_marketing_sms ?? null,
        aceptaWhatsapp: p?.acepta_marketing_whatsapp ?? null,
        referenciaFecha: (r.fecha as string) ?? null,
      },
    };
  });
}

// ─── Disparadores sobre clientes ─────────────────────────────

const CAMPOS_CLIENTE =
  "id, nombre, apellidos, email, telefono, visitas, ultima_visita, fecha_nacimiento, created_at, acepta_marketing_email, acepta_marketing_sms, acepta_marketing_whatsapp";

function contextoCliente(c: Record<string, unknown>): ContextoDisparo {
  const nombre = `${(c.nombre as string) ?? ""}`.trim();
  return {
    nombre: nombre || "cliente",
    email: (c.email as string) ?? null,
    telefono: (c.telefono as string) ?? null,
    clienteId: c.id as string,
    visitas: (c.visitas as number) ?? null,
    aceptaEmail: (c.acepta_marketing_email as boolean) ?? null,
    aceptaSms: (c.acepta_marketing_sms as boolean) ?? null,
    aceptaWhatsapp: (c.acepta_marketing_whatsapp as boolean) ?? null,
    referenciaFecha: (c.ultima_visita as string) ?? null,
  };
}

async function disparosDeClientes(
  db: SupabaseClient,
  a: Automatizacion,
): Promise<Disparo[]> {
  if (a.disparador === "cliente_nuevo") {
    const { data } = await db
      .from("clientes_sala")
      .select(CAMPOS_CLIENTE)
      .eq("empresa_id", a.empresaId)
      .gte("created_at", desdeISO(a))
      .limit(300);
    return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
      entidadTipo: "cliente" as const,
      entidadId: c.id as string,
      dedupeKey: `cliente:${c.id as string}`,
      contexto: contextoCliente(c),
    }));
  }

  if (a.disparador === "cumpleanos") {
    const diasAntes = Number(a.disparadorConfig.dias_antes ?? 0);
    const objetivo = new Date();
    objetivo.setDate(objetivo.getDate() + diasAntes);
    const mmdd = `${String(objetivo.getMonth() + 1).padStart(2, "0")}-${String(objetivo.getDate()).padStart(2, "0")}`;
    // Postgres no indexa bien "mismo día y mes", pero la tabla de clientes de
    // un restaurante son miles de filas, no millones: se filtra en memoria.
    const { data } = await db
      .from("clientes_sala")
      .select(CAMPOS_CLIENTE)
      .eq("empresa_id", a.empresaId)
      .not("fecha_nacimiento", "is", null)
      .limit(5000);
    const anio = new Date().getFullYear();
    return ((data ?? []) as Record<string, unknown>[])
      .filter((c) => `${c.fecha_nacimiento as string}`.slice(5, 10) === mmdd)
      .map((c) => ({
        entidadTipo: "cliente" as const,
        entidadId: c.id as string,
        dedupeKey: `cumple:${c.id as string}:${anio}`,
        contexto: contextoCliente(c),
      }));
  }

  // cliente_dormido: cumple HOY los días sin venir. Se mira una ventana de
  // días para no perder a nadie si el cron falló, y la clave lleva la fecha de
  // su última visita: si vuelve y se duerme otra vez, cuenta como disparo nuevo.
  const dias = Number(a.disparadorConfig.dias ?? 90);
  const hasta = diasDesde(hoyISO(), dias);
  const desde = diasDesde(hoyISO(), dias + VENTANA_DIAS);
  const { data } = await db
    .from("clientes_sala")
    .select(CAMPOS_CLIENTE)
    .eq("empresa_id", a.empresaId)
    .gte("ultima_visita", desde)
    .lte("ultima_visita", hasta)
    .limit(300);
  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    entidadTipo: "cliente" as const,
    entidadId: c.id as string,
    dedupeKey: `dormido:${c.id as string}:${c.ultima_visita as string}`,
    contexto: contextoCliente(c),
  }));
}

// ─── Disparador sobre valoraciones ───────────────────────────

async function disparosDeValoraciones(
  db: SupabaseClient,
  a: Automatizacion,
): Promise<Disparo[]> {
  const notaMaxima = Number(a.disparadorConfig.nota_maxima ?? 3);
  const { data } = await db
    .from("resenas")
    .select("id, cliente_id, nombre_comensal, email, telefono, rating, comentario, created_at")
    .eq("empresa_id", a.empresaId)
    .lte("rating", notaMaxima)
    .not("rating", "is", null)
    .gte("created_at", desdeISO(a))
    .limit(200);

  const filas = (data ?? []) as Record<string, unknown>[];
  const permisos = await permisosDeClientes(db, filas.map((r) => (r.cliente_id as string) ?? ""));

  return filas.map((r) => {
    const p = r.cliente_id ? permisos.get(r.cliente_id as string) : undefined;
    return {
      entidadTipo: "resena" as const,
      entidadId: r.id as string,
      dedupeKey: `resena:${r.id as string}`,
      contexto: {
        nombre: ((r.nombre_comensal as string) ?? "").trim() || "un cliente",
        email: (r.email as string) ?? null,
        telefono: (r.telefono as string) ?? null,
        clienteId: (r.cliente_id as string) ?? null,
        visitas: p?.visitas ?? null,
        aceptaEmail: p?.acepta_marketing_email ?? null,
        aceptaSms: p?.acepta_marketing_sms ?? null,
        aceptaWhatsapp: p?.acepta_marketing_whatsapp ?? null,
        referenciaFecha: null,
      },
    };
  });
}

// ─── Entrada pública ─────────────────────────────────────────

const POR_ENTIDAD: Record<Disparador, "reserva" | "cliente" | "resena"> = {
  reserva_nueva: "reserva",
  visita_terminada: "reserva",
  no_show: "reserva",
  cliente_nuevo: "cliente",
  cumpleanos: "cliente",
  cliente_dormido: "cliente",
  valoracion_recibida: "resena",
};

/**
 * Anota los disparos nuevos de UNA automatización. Devuelve cuántos entraron
 * (los repetidos los descarta la base de datos, no hace falta comprobarlos).
 */
export async function barrerAutomatizacion(
  db: SupabaseClient,
  a: Automatizacion,
): Promise<number> {
  const entidad = POR_ENTIDAD[a.disparador];
  let disparos: Disparo[] = [];
  try {
    if (entidad === "reserva") disparos = await disparosDeReservas(db, a);
    else if (entidad === "cliente") disparos = await disparosDeClientes(db, a);
    else disparos = await disparosDeValoraciones(db, a);
  } catch (err) {
    console.error("[automatizaciones] barrido", a.id, err);
    return 0;
  }

  if (disparos.length === 0) return 0;

  const filas = disparos.map((d) => ({
    empresa_id: a.empresaId,
    automatizacion_id: a.id,
    entidad_tipo: d.entidadTipo,
    entidad_id: d.entidadId,
    contexto: d.contexto,
    dedupe_key: d.dedupeKey,
    estado: "pendiente",
    ejecutar_en: new Date().toISOString(),
  }));

  const { data, error } = await db
    .from("marketing_automatizacion_ejecuciones")
    .upsert(filas, { onConflict: "automatizacion_id,dedupe_key", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[automatizaciones] alta de disparos", a.id, error.message);
    return 0;
  }
  return (data ?? []).length;
}
