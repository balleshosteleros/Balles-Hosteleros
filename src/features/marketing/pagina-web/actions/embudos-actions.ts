"use server";

/**
 * Embudos (PRP-088): una secuencia de páginas encadenadas, cada una con un solo
 * objetivo. Se listan aparte de las páginas sueltas porque lo que importa de un
 * embudo es el ORDEN de sus pasos, no la lista alfabética.
 */
import { getAppContext } from "@/lib/supabase/get-context";
import { friendlyError } from "@/shared/lib/friendly-errors";
import type { PaginaWebEstado } from "../types";

export interface PasoDeEmbudo {
  id: string;
  nombre: string;
  slug_interno: string;
  estado: PaginaWebEstado;
  orden: number;
  /** De dónde se copió, si es una copia fiel de otra web. */
  replica_origen_url: string | null;
  /** Cuánta gente ha llegado a este paso (sin contar robots). */
  visitas: number;
  /** Visitas de los últimos 30 días. */
  visitas30: number;
}

export interface EmbudoConPasos {
  id: string;
  nombre: string;
  origen_url: string | null;
  pasos: PasoDeEmbudo[];
}

/**
 * Visitas por página, ya sumadas. `paginas_web_visitas` guarda una fila por
 * página, día y tipo de aparato: aquí solo interesa el total de cada paso.
 */
async function visitasPorPagina(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  paginaIds: string[],
): Promise<Map<string, { total: number; ultimos30: number }>> {
  const mapa = new Map<string, { total: number; ultimos30: number }>();
  if (paginaIds.length === 0) return mapa;

  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("paginas_web_visitas")
    .select("pagina_id, fecha, total")
    .eq("empresa_id", empresaId)
    .in("pagina_id", paginaIds);

  if (error) {
    console.error("[pagina-web][visitasPorPagina]", error.message);
    return mapa;
  }

  for (const fila of data ?? []) {
    const v = fila as { pagina_id: string; fecha: string; total: number };
    const actual = mapa.get(v.pagina_id) ?? { total: 0, ultimos30: 0 };
    actual.total += Number(v.total ?? 0);
    if (v.fecha >= hace30) actual.ultimos30 += Number(v.total ?? 0);
    mapa.set(v.pagina_id, actual);
  }
  return mapa;
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function listarEmbudos(): Promise<ActionResult<EmbudoConPasos[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: embudos, error } = await supabase
      .from("paginas_web_embudos")
      .select("id, nombre, origen_url")
      .eq("empresa_id", empresaId)
      .order("created_at");

    if (error) {
      console.error("[pagina-web][listarEmbudos]", error.message);
      return { ok: false, error: "No se pudieron cargar los embudos." };
    }
    if (!embudos?.length) return { ok: true, data: [] };

    // Sin `html_replica`: cada copia pesa cientos de KB y aquí solo se pinta el
    // nombre de cada paso.
    const { data: pasos, error: errPasos } = await supabase
      .from("paginas_web")
      .select("id, nombre, slug_interno, estado, embudo_id, embudo_orden, replica_origen_url")
      .eq("empresa_id", empresaId)
      .not("embudo_id", "is", null)
      .order("embudo_orden");

    if (errPasos) {
      console.error("[pagina-web][listarEmbudos] pasos:", errPasos.message);
      return { ok: false, error: "No se pudieron cargar los pasos." };
    }

    const visitas = await visitasPorPagina(
      supabase,
      empresaId,
      (pasos ?? []).map((f) => (f as { id: string }).id),
    );

    const porEmbudo = new Map<string, PasoDeEmbudo[]>();
    for (const fila of pasos ?? []) {
      const p = fila as {
        id: string;
        nombre: string;
        slug_interno: string;
        estado: PaginaWebEstado;
        embudo_id: string;
        embudo_orden: number | null;
        replica_origen_url: string | null;
      };
      const lista = porEmbudo.get(p.embudo_id) ?? [];
      lista.push({
        id: p.id,
        nombre: p.nombre,
        slug_interno: p.slug_interno,
        estado: p.estado,
        orden: p.embudo_orden ?? 0,
        replica_origen_url: p.replica_origen_url,
        visitas: visitas.get(p.id)?.total ?? 0,
        visitas30: visitas.get(p.id)?.ultimos30 ?? 0,
      });
      porEmbudo.set(p.embudo_id, lista);
    }

    return {
      ok: true,
      data: (embudos as { id: string; nombre: string; origen_url: string | null }[]).map((e) => ({
        ...e,
        pasos: porEmbudo.get(e.id) ?? [],
      })),
    };
  } catch (err) {
    console.error("[pagina-web][listarEmbudos] fatal:", err);
    return { ok: false, error: friendlyError(err, "listarEmbudos") };
  }
}


/** Un embudo concreto, con sus pasos y sus visitas. Para la pantalla del embudo. */
export async function obtenerEmbudo(id: string): Promise<ActionResult<EmbudoConPasos | null>> {
  const res = await listarEmbudos();
  if (!res.ok) return res;
  return { ok: true, data: res.data.find((e) => e.id === id) ?? null };
}
