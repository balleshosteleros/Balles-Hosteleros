"use server";

/**
 * Los dos calendarios de la pantalla de CLIENTES: cumpleaños y visitas.
 *
 * Van juntos porque son la misma idea vista dos veces —un mes pintado como
 * mapa de calor, los días fuertes más oscuros— pero la fuente de cada uno es
 * distinta y por eso se resuelven aparte:
 *
 *  - CUMPLEAÑOS: se agrupan por día y mes (`MM-DD`), sin año. Se devuelven de
 *    una vez los 365 días, porque la fecha de nacimiento de una persona no
 *    cambia al pasar de mes: cargarlo una sola vez evita una consulta cada vez
 *    que se pulsa la flecha.
 *
 *  - VISITAS: se piden por mes, porque son decenas de miles de filas de
 *    historia (2021 en adelante) y traerlas todas para pintar treinta días
 *    sería tirar la base entera al navegador.
 *
 * Aislamiento por empresa: filtro explícito por `empresa_id` de la empresa
 * ACTIVA en las tres consultas. La RLS acota a las empresas DEL usuario, no a
 * la activa, así que sin este filtro se mezclarían los locales.
 */

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { leerTodas } from "@/shared/lib/supabase-paginado";
import { friendlyError } from "@/shared/lib/friendly-errors";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Una persona que cumple años ese día. */
export interface CumpleanosCliente {
  id: string;
  nombre: string;
  telefono: string;
  /** Año de nacimiento, para poder decir la edad que cumple. Null si no consta. */
  anio: number | null;
}

export interface CalendarioCumpleanosResult {
  ok: boolean;
  /** Clave `MM-DD` → quiénes cumplen ese día. */
  dias: Record<string, CumpleanosCliente[]>;
  /** Cuántas fichas tienen fecha de nacimiento. */
  total: number;
  /** Cuántas fichas hay en total, para poder decir de cuántas se sabe. */
  totalClientes: number;
  error?: string;
}

/** Lo que pasó un día concreto. */
export interface DiaVisitas {
  /** Reservas cumplidas ese día. */
  visitas: number;
  /** Personas distintas (una misma ficha con dos reservas cuenta una vez). */
  clientes: number;
  /** Comensales sumados. */
  personas: number;
}

export interface CalendarioVisitasResult {
  ok: boolean;
  /** Clave `AAAA-MM-DD` → lo que pasó ese día. */
  dias: Record<string, DiaVisitas>;
  error?: string;
}

async function contexto() {
  const supabase = await createClient();
  const user = await getUsuarioActual();
  if (!user) return { supabase, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, empresaId };
}

/**
 * NO cuentan como visita: la persona no llegó a sentarse.
 *
 * Se compara en minúsculas y por el principio porque conviven dos formas de
 * escribir el estado: la del sistema (`CANCELADA`, `NO_SHOW`) y la que llegó
 * de CoverManager en texto libre ("Cancelado por el cliente", "Cancelado por
 * el restaurante", "No show"). Todo lo demás —Sentada, Liberada, Confirmada
 * sin cerrar al acabar el servicio— es alguien que vino y comió.
 */
function noAsistio(estado: string | null): boolean {
  const e = (estado ?? "").trim().toLowerCase();
  return e.startsWith("cancelad") || e === "no show" || e === "no_show";
}

/** Nombre completo, o el hueco vacío si la ficha no tiene nombre. */
function nombreCompleto(nombre: unknown, apellidos: unknown): string {
  return [nombre, apellidos]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

/**
 * Cumpleaños de toda la clientela, agrupados por día del año.
 *
 * El 29 de febrero se queda en su día real: quien nació en bisiesto sale en
 * el 29, y en los años que no lo tienen ese día no se pinta. Adelantarlo al 28
 * falsearía el dato en la única pantalla donde se consulta.
 */
export async function calendarioCumpleanos(): Promise<CalendarioCumpleanosResult> {
  const vacio: CalendarioCumpleanosResult = {
    ok: false,
    dias: {},
    total: 0,
    totalClientes: 0,
  };
  try {
    const { supabase, empresaId } = await contexto();
    if (!empresaId) return vacio;

    // Por tandas: hay miles de fichas y Supabase corta en 1.000 sin avisar, lo
    // que dejaría medio calendario en blanco sin ningún error a la vista.
    const filas = await leerTodas<{
      id: string;
      nombre: string | null;
      apellidos: string | null;
      telefono: string | null;
      fecha_nacimiento: string | null;
    }>(() =>
      supabase
        .from("clientes_sala")
        .select("id, nombre, apellidos, telefono, fecha_nacimiento")
        .eq("empresa_id", empresaId)
        .not("fecha_nacimiento", "is", null),
    );

    const { count } = await supabase
      .from("clientes_sala")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    const dias: Record<string, CumpleanosCliente[]> = {};
    for (const f of filas) {
      const fecha = (f.fecha_nacimiento ?? "").slice(0, 10);
      if (fecha.length !== 10) continue;
      const clave = fecha.slice(5); // MM-DD
      const anio = Number(fecha.slice(0, 4));
      (dias[clave] ??= []).push({
        id: f.id,
        nombre: nombreCompleto(f.nombre, f.apellidos),
        telefono: f.telefono ?? "",
        anio: Number.isFinite(anio) && anio > 1900 ? anio : null,
      });
    }
    // Dentro de cada día, por nombre: la lista se lee, no se recorre buscando.
    for (const lista of Object.values(dias)) {
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }

    return {
      ok: true,
      dias,
      total: filas.length,
      totalClientes: count ?? filas.length,
    };
  } catch (err) {
    console.error("[clientes] calendarioCumpleanos:", err);
    return { ...vacio, error: friendlyError(err, "calendarioCumpleanos") };
  }
}

/**
 * Visitas de un tramo de días (normalmente el mes que se está mirando).
 *
 * FUENTE, y por qué son dos: la historia completa está repartida. Las reservas
 * de este sistema viven en `reservas`, y el histórico que llegó de CoverManager
 * está en `cliente_visitas`. La mayor parte de ese histórico se importó también
 * como reserva (y quedó enlazada por `reserva_id`), así que sumar las dos
 * tablas a pelo contaría dos veces cada día de 2022 a 2026. Por eso se leen las
 * reservas con cliente y, de `cliente_visitas`, SOLO las que no apuntan a
 * ninguna reserva: son las de 2021 y anteriores, que si no desaparecerían del
 * calendario.
 *
 * Se cuenta la reserva del cliente, no la de nadie: una reserva sin ficha
 * asociada no dice a quién vimos, que es justo lo que este calendario mide.
 */
export async function calendarioVisitas(
  desde: string,
  hasta: string,
): Promise<CalendarioVisitasResult> {
  const vacio: CalendarioVisitasResult = { ok: false, dias: {} };
  try {
    const { supabase, empresaId } = await contexto();
    if (!empresaId) return vacio;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return vacio;
    }

    const [reservas, visitasSueltas] = await Promise.all([
      leerTodas<{
        fecha: string;
        estado: string | null;
        personas: number | null;
        cliente_id: string;
      }>(() =>
        supabase
          .from("reservas")
          .select("fecha, estado, personas, cliente_id")
          .eq("empresa_id", empresaId)
          .not("cliente_id", "is", null)
          .gte("fecha", desde)
          .lte("fecha", hasta),
      ),
      leerTodas<{
        fecha: string;
        estado: string | null;
        personas: number | null;
        cliente_id: string;
      }>(() =>
        supabase
          .from("cliente_visitas")
          .select("fecha, estado, personas, cliente_id")
          .eq("empresa_id", empresaId)
          .is("reserva_id", null)
          .gte("fecha", desde)
          .lte("fecha", hasta),
      ),
    ]);

    // Personas distintas por día: un cliente que reserva dos veces el mismo día
    // (comida y cena) es una persona vista, no dos.
    const porDia = new Map<
      string,
      { visitas: number; personas: number; clientes: Set<string> }
    >();

    for (const fila of [...reservas, ...visitasSueltas]) {
      if (noAsistio(fila.estado)) continue;
      const dia = (fila.fecha ?? "").slice(0, 10);
      if (dia.length !== 10) continue;
      let acc = porDia.get(dia);
      if (!acc) {
        acc = { visitas: 0, personas: 0, clientes: new Set() };
        porDia.set(dia, acc);
      }
      acc.visitas += 1;
      acc.personas += fila.personas ?? 0;
      acc.clientes.add(fila.cliente_id);
    }

    const dias: Record<string, DiaVisitas> = {};
    for (const [dia, acc] of porDia) {
      dias[dia] = {
        visitas: acc.visitas,
        personas: acc.personas,
        clientes: acc.clientes.size,
      };
    }

    return { ok: true, dias };
  } catch (err) {
    console.error("[clientes] calendarioVisitas:", err);
    return { ...vacio, error: friendlyError(err, "calendarioVisitas") };
  }
}

/** Quiénes vinieron un día concreto, para el detalle al pulsar el día. */
export interface VisitanteDia {
  clienteId: string;
  nombre: string;
  telefono: string;
  personas: number;
  /** Cuántas reservas suyas hubo ese día (comida y cena cuentan dos). */
  reservas: number;
}

export async function visitantesDelDia(
  dia: string,
): Promise<{ ok: boolean; data: VisitanteDia[]; error?: string }> {
  try {
    const { supabase, empresaId } = await contexto();
    if (!empresaId) return { ok: false, data: [] };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, data: [] };

    // Mismo criterio y mismas dos fuentes que `calendarioVisitas`: si el
    // detalle contase de otra forma, el número del día y la lista al abrirlo
    // no cuadrarían.
    const [reservas, visitasSueltas] = await Promise.all([
      leerTodas<{ estado: string | null; personas: number | null; cliente_id: string }>(
        () =>
          supabase
            .from("reservas")
            .select("estado, personas, cliente_id")
            .eq("empresa_id", empresaId)
            .not("cliente_id", "is", null)
            .eq("fecha", dia),
      ),
      leerTodas<{ estado: string | null; personas: number | null; cliente_id: string }>(
        () =>
          supabase
            .from("cliente_visitas")
            .select("estado, personas, cliente_id")
            .eq("empresa_id", empresaId)
            .is("reserva_id", null)
            .eq("fecha", dia),
      ),
    ]);

    const porCliente = new Map<string, { personas: number; reservas: number }>();
    for (const fila of [...reservas, ...visitasSueltas]) {
      if (noAsistio(fila.estado)) continue;
      const acc = porCliente.get(fila.cliente_id) ?? { personas: 0, reservas: 0 };
      acc.personas += fila.personas ?? 0;
      acc.reservas += 1;
      porCliente.set(fila.cliente_id, acc);
    }
    if (porCliente.size === 0) return { ok: true, data: [] };

    const ids = [...porCliente.keys()];
    const fichas = await leerTodas<{
      id: string;
      nombre: string | null;
      apellidos: string | null;
      telefono: string | null;
    }>(() =>
      supabase
        .from("clientes_sala")
        .select("id, nombre, apellidos, telefono")
        .eq("empresa_id", empresaId)
        .in("id", ids),
    );
    const porId = new Map(fichas.map((f) => [f.id, f]));

    const data: VisitanteDia[] = ids.map((id) => {
      const f = porId.get(id);
      const acc = porCliente.get(id)!;
      return {
        clienteId: id,
        nombre: nombreCompleto(f?.nombre, f?.apellidos),
        telefono: f?.telefono ?? "",
        personas: acc.personas,
        reservas: acc.reservas,
      };
    });
    data.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return { ok: true, data };
  } catch (err) {
    console.error("[clientes] visitantesDelDia:", err);
    return { ok: false, data: [], error: friendlyError(err, "visitantesDelDia") };
  }
}
