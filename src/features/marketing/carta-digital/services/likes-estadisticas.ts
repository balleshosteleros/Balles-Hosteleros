/**
 * Estadísticas de "me gusta" de la carta.
 *
 * Todo se calcula sobre `carta_item_likes` —los votos reales, con fecha y
 * dispositivo—. El número que ve el comensal incluye además `likes_base`, un
 * arranque visual que aquí NO se suma: un ranking que lo contara diría quién
 * empezó más alto, no qué gusta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PeriodoRanking = "semana" | "mes" | "trimestre" | "anio";

export interface FilaRanking {
  item_id: string;
  nombre: string;
  categoria: string;
  votos: number;
}

const DIAS: Record<PeriodoRanking, number> = {
  semana: 7,
  mes: 30,
  trimestre: 90,
  anio: 365,
};

export function desdeDe(periodo: PeriodoRanking): Date {
  return new Date(Date.now() - DIAS[periodo] * 86_400_000);
}

export async function rankingLikes(
  supabase: SupabaseClient,
  empresaId: string,
  periodo: PeriodoRanking,
): Promise<FilaRanking[]> {
  const { data, error } = await supabase.rpc("carta_ranking_likes", {
    p_empresa: empresaId,
    p_desde: desdeDe(periodo).toISOString(),
  });
  if (error) {
    console.error("[carta][rankingLikes]", error.message);
    return [];
  }
  return (data ?? []) as FilaRanking[];
}

/** Votos reales del periodo, para el titular del panel. */
export async function totalVotos(
  supabase: SupabaseClient,
  empresaId: string,
  periodo: PeriodoRanking,
): Promise<number> {
  const { data: items } = await supabase
    .from("carta_items")
    .select("id")
    .eq("empresa_id", empresaId);
  const ids = ((items ?? []) as { id: string }[]).map((i) => i.id);
  if (ids.length === 0) return 0;

  const { count } = await supabase
    .from("carta_item_likes")
    .select("id", { count: "exact", head: true })
    .in("item_id", ids)
    .gte("created_at", desdeDe(periodo).toISOString());
  return count ?? 0;
}
