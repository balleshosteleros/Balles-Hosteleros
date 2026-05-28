"use server";

import { getMarketingContext } from "@/features/marketing/lib/supabase-context";
import type { CanalCampana, EstadoCampana } from "@/features/marketing/data/campanas";

export interface CampanaAtribucionRow {
  campanaId: string;
  empresaId: string;
  nombre: string;
  canal: CanalCampana;
  estado: EstadoCampana;
  ultimaEjecucion: string | null;
  demoMode: boolean;
  origen: string | null;
  enviados: number;
  abiertos: number;
  reservasGeneradas: number;
}

type Row = Record<string, unknown>;

function mapRow(row: Row): CampanaAtribucionRow {
  return {
    campanaId: row.campana_id as string,
    empresaId: row.empresa_id as string,
    nombre: row.nombre as string,
    canal: row.canal as CanalCampana,
    estado: row.estado as EstadoCampana,
    ultimaEjecucion: (row.ultima_ejecucion as string | null) ?? null,
    demoMode: (row.demo_mode as boolean) ?? true,
    origen: (row.origen as string | null) ?? null,
    enviados: Number(row.enviados ?? 0),
    abiertos: Number(row.abiertos ?? 0),
    reservasGeneradas: Number(row.reservas_generadas ?? 0),
  };
}

export async function listarCampanasConAtribucionAction(canal?: CanalCampana) {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false as const, data: [] as CampanaAtribucionRow[], error: "Sin empresa" };
    let query = supabase
      .from("v_campanas_atribucion")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("ultima_ejecucion", { ascending: false, nullsFirst: false });
    if (canal) query = query.eq("canal", canal);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true as const, data: (data ?? []).map(mapRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false as const, data: [] as CampanaAtribucionRow[], error: msg };
  }
}
