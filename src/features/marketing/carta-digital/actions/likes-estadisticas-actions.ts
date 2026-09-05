"use server";

/**
 * Estadísticas de "me gusta" para el panel de Carta digital.
 *
 * Va por server action y no desde el cliente porque el ranking se calcula con
 * una función de base de datos que solo pueden llamar usuarios autenticados:
 * la carta pública no debe poder leer estos totales.
 */
import { getAppContext } from "@/lib/supabase/get-context";
import {
  rankingLikes,
  totalVotos,
  type FilaRanking,
  type PeriodoRanking,
} from "../services/likes-estadisticas";

export async function obtenerRankingLikes(
  periodo: PeriodoRanking,
): Promise<{ filas: FilaRanking[]; total: number }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { filas: [], total: 0 };

    const [filas, total] = await Promise.all([
      rankingLikes(supabase as never, empresaId, periodo),
      totalVotos(supabase as never, empresaId, periodo),
    ]);
    return { filas, total };
  } catch (err) {
    console.error("[carta][obtenerRankingLikes] fatal:", err);
    return { filas: [], total: 0 };
  }
}
