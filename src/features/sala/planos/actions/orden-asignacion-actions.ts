"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  COMENSALES_MAX,
  COMENSALES_MIN,
} from "@/features/sala/data/capacidad-grupos";

/**
 * Orden de preferencia para la asignación automática de reservas.
 *
 * Para cada (plano, número de comensales) el responsable decide qué se ocupa
 * antes. Cada posición puede ser una mesa suelta O una combinación de mesas:
 * `asignacion-mesa.ts` recorre la lista en orden y se queda con la primera
 * opción que esté ENTERA libre.
 *
 * Si un tamaño de grupo no tiene orden definido, el motor usa su criterio por
 * defecto (mesa suelta antes que combinación, y dentro de cada grupo por
 * código de mesa ascendente).
 */


/** Una posición del orden: o mesa suelta, o combinación. Nunca las dos. */
export interface DestinoOrden {
  mesaId: string | null;
  combinacionId: string | null;
}

export interface OrdenAsignacionFila extends DestinoOrden {
  posicion: number;
}

/** Orden completo del plano, indexado por número de comensales. */
export type OrdenPorComensales = Record<number, DestinoOrden[]>;

/**
 * Carga de una sola vez el orden de TODOS los tamaños de grupo del plano.
 * La pantalla los muestra juntos, así que una query evita 20 idas y venidas.
 */
export async function listOrdenCompleto(planoId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plano_orden_asignacion")
      .select("comensales, mesa_id, combinacion_id, posicion")
      .eq("plano_id", planoId)
      .order("comensales", { ascending: true })
      .order("posicion", { ascending: true });
    if (error) throw error;

    const porComensales: OrdenPorComensales = {};
    for (const r of data ?? []) {
      const n = r.comensales as number;
      (porComensales[n] ??= []).push({
        mesaId: (r.mesa_id as string | null) ?? null,
        combinacionId: (r.combinacion_id as string | null) ?? null,
      });
    }
    return { ok: true, data: porComensales };
  } catch (err) {
    console.error("[orden-asignacion] listCompleto:", err);
    return { ok: false, data: {} as OrdenPorComensales };
  }
}

export async function listOrdenAsignacion(planoId: string, comensales: number) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plano_orden_asignacion")
      .select("mesa_id, combinacion_id, posicion")
      .eq("plano_id", planoId)
      .eq("comensales", comensales)
      .order("posicion", { ascending: true });
    if (error) throw error;
    const filas: OrdenAsignacionFila[] = (data ?? []).map((r) => ({
      mesaId: (r.mesa_id as string | null) ?? null,
      combinacionId: (r.combinacion_id as string | null) ?? null,
      posicion: r.posicion as number,
    }));
    return { ok: true, data: filas };
  } catch (err) {
    console.error("[orden-asignacion] list:", err);
    return { ok: false, data: [] as OrdenAsignacionFila[] };
  }
}

/**
 * Reemplaza por completo el orden de un (plano, comensales).
 *
 * Se borra y se reinserta en vez de hacer diff: la lista es corta y así el
 * resultado siempre coincide con lo que el usuario ve, sin posiciones
 * huérfanas de mesas que se hayan quitado.
 *
 * Una lista vacía equivale a "sin preferencia": el motor vuelve al orden por
 * defecto para ese tamaño de grupo.
 */
export async function guardarOrdenAsignacion(input: {
  planoId: string;
  comensales: number;
  destinos: DestinoOrden[];
}) {
  try {
    if (!input.planoId) return { ok: false, error: "Plano obligatorio" };
    if (
      !Number.isInteger(input.comensales) ||
      input.comensales < COMENSALES_MIN ||
      input.comensales > COMENSALES_MAX
    ) {
      return {
        ok: false,
        error: `El número de comensales debe estar entre ${COMENSALES_MIN} y ${COMENSALES_MAX}`,
      };
    }

    // Cada posición apunta a una cosa y solo una (lo exige el CHECK de la BD).
    for (const d of input.destinos) {
      const tieneMesa = Boolean(d.mesaId);
      const tieneCombi = Boolean(d.combinacionId);
      if (tieneMesa === tieneCombi) {
        return { ok: false, error: "Cada posición debe ser una mesa o una combinación" };
      }
    }

    // Repetir un destino rompería el índice único.
    const claves = input.destinos.map((d) => d.mesaId ?? `c:${d.combinacionId}`);
    if (new Set(claves).size !== claves.length) {
      return { ok: false, error: "Hay posiciones repetidas en el orden" };
    }

    const supabase = await createClient();

    const { error: errDel } = await supabase
      .from("plano_orden_asignacion")
      .delete()
      .eq("plano_id", input.planoId)
      .eq("comensales", input.comensales);
    if (errDel) throw errDel;

    if (input.destinos.length > 0) {
      const filas = input.destinos.map((d, i) => ({
        plano_id: input.planoId,
        comensales: input.comensales,
        mesa_id: d.mesaId,
        combinacion_id: d.combinacionId,
        posicion: i + 1,
      }));
      const { error: errIns } = await supabase
        .from("plano_orden_asignacion")
        .insert(filas);
      if (errIns) throw errIns;
    }

    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[orden-asignacion] guardar:", msg);
    return { ok: false, error: msg };
  }
}

/** Borra la preferencia de un tamaño de grupo: vuelve al orden por defecto. */
export async function limpiarOrdenAsignacion(planoId: string, comensales: number) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("plano_orden_asignacion")
      .delete()
      .eq("plano_id", planoId)
      .eq("comensales", comensales);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[orden-asignacion] limpiar:", msg);
    return { ok: false, error: msg };
  }
}
