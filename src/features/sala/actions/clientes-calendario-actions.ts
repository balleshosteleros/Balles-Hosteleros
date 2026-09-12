"use server";

/**
 * El calendario de CUMPLEAÑOS de la pantalla de CLIENTES.
 *
 * Se agrupan por día y mes (`MM-DD`), sin año, y se devuelven los 365 días de
 * una vez: la fecha de nacimiento de una persona no cambia al pasar de mes, así
 * que pedirlo otra vez en cada flecha sería trabajo tirado.
 *
 * Aislamiento por empresa: filtro explícito por `empresa_id` de la empresa
 * ACTIVA. La RLS acota a las empresas DEL usuario, no a la activa, así que sin
 * este filtro se mezclarían los locales.
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
