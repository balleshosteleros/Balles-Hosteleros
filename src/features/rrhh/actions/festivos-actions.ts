"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";

export type AmbitoFestivo = "nacional" | "autonomico" | "local";
export type OrigenFestivo = "auto" | "manual";

export interface FestivoBD {
  id: string;
  fecha: string; // "YYYY-MM-DD"
  nombre: string;
  ambito: AmbitoFestivo;
  origen: OrigenFestivo;
}

/**
 * Comunidades y ciudades autónomas de España. El `value` guardado en
 * `empresas.config_operativa.comunidadAutonoma` debe coincidir (case-insensitive)
 * con las claves reconocidas por la función SQL `festivos_autonomicos`.
 */
export const COMUNIDADES_AUTONOMAS = [
  "Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria",
  "Castilla-La Mancha", "Castilla y León", "Cataluña", "Comunidad Valenciana",
  "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarra",
  "País Vasco", "Ceuta", "Melilla",
] as const;

export type ComunidadAutonoma = (typeof COMUNIDADES_AUTONOMAS)[number];

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Festivos de la empresa activa para un año. Si el año pedido aún no tiene
 * festivos generados (p. ej. se navega a un año futuro que el cron del 1-julio
 * todavía no ha creado), los genera al vuelo (lazy) y los devuelve. Así el
 * calendario nunca sale vacío.
 */
export async function getFestivos(anio: number): Promise<Res<FestivoBD[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const leer = async () =>
      supabase
        .from("festivos")
        .select("id, fecha, nombre, ambito, origen")
        .eq("empresa_id", empresaId)
        .eq("anio", anio)
        .order("fecha", { ascending: true });

    let { data, error } = await leer();
    if (error) throw error;

    // Generación perezosa: si no hay festivos para ese año, se crean.
    if (!data || data.length === 0) {
      await supabase.rpc("generar_festivos_empresa", {
        p_empresa: empresaId,
        p_anio: anio,
      });
      ({ data, error } = await leer());
      if (error) throw error;
    }

    return { ok: true, data: (data ?? []) as FestivoBD[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[festivos] getFestivos:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Regenera los festivos auto (nacionales + autonómicos) de la empresa activa
 * para un año, a partir de su comunidad autónoma actual. Conserva los locales
 * manuales. Se usa tras cambiar la comunidad autónoma en Ajustes.
 */
export async function regenerarFestivos(anio: number): Promise<Res<number>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const { data, error } = await supabase.rpc("generar_festivos_empresa", {
      p_empresa: empresaId,
      p_anio: anio,
    });
    if (error) throw error;

    revalidatePath("/rrhh/calendarios");
    return { ok: true, data: (data as number) ?? 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[festivos] regenerarFestivos:", msg);
    return { ok: false, error: msg };
  }
}

/** Añade un festivo LOCAL manual (uno de los 2 que fija cada municipio). */
export async function addFestivoLocal(input: {
  anio: number;
  fecha: string; // "YYYY-MM-DD"
  nombre: string;
}): Promise<Res<FestivoBD>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre del festivo es obligatorio" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
      return { ok: false, error: "Fecha inválida" };
    }

    const { data, error } = await supabase
      .from("festivos")
      .insert({
        empresa_id: empresaId,
        anio: input.anio,
        fecha: input.fecha,
        nombre,
        ambito: "local",
        origen: "manual",
      })
      .select("id, fecha, nombre, ambito, origen")
      .single();
    if (error) {
      // 23505 = ya existe un festivo ese día.
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, error: "Ya hay un festivo en esa fecha" };
      }
      throw error;
    }

    revalidatePath("/rrhh/calendarios");
    return { ok: true, data: data as FestivoBD };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[festivos] addFestivoLocal:", msg);
    return { ok: false, error: msg };
  }
}

/** Elimina un festivo local manual por id (solo los manuales deberían borrarse). */
export async function deleteFestivo(id: string): Promise<Res<true>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const { error } = await supabase
      .from("festivos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .eq("origen", "manual");
    if (error) throw error;

    revalidatePath("/rrhh/calendarios");
    return { ok: true, data: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[festivos] deleteFestivo:", msg);
    return { ok: false, error: msg };
  }
}
