"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmpresaReservasConfig,
  DiaSemanaKey,
  MetricaLimite,
  TurnoKey,
} from "@/features/sala/data/reservas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

const DIAS: DiaSemanaKey[] = ["lun","mar","mie","jue","vie","sab","dom"];
const METRICAS: MetricaLimite[] = ["cupo","maxpax"];
const TURNOS: TurnoKey[] = ["comida","cena"];

function rowToConfig(row: Record<string, unknown>): EmpresaReservasConfig {
  const out: Record<string, unknown> = {
    empresaId: row.empresa_id,
    generalCupoComida:   row.general_cupo_comida   ?? null,
    generalCupoCena:     row.general_cupo_cena     ?? null,
    generalMaxpaxComida: row.general_maxpax_comida ?? null,
    generalMaxpaxCena:   row.general_maxpax_cena   ?? null,
    antelacionMinHoras: (row.antelacion_min_horas as number) ?? 0,
    antelacionMaxDias:  (row.antelacion_max_dias as number)  ?? 90,
  };
  for (const d of DIAS) {
    for (const m of METRICAS) {
      for (const t of TURNOS) {
        const dbKey = `${d}_${m}_${t}`;
        const objKey = `${d}_${m}_${t}` as const;
        out[objKey] = (row[dbKey] as number | null) ?? null;
      }
    }
  }
  return out as unknown as EmpresaReservasConfig;
}

/**
 * Devuelve la config de la empresa actual. Si no existe la fila la crea con
 * valores por defecto (datos completos obligatorio: el resto se rellena en el
 * Sheet de configuración).
 */
export async function getReservasConfig() {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: null as EmpresaReservasConfig | null };
    const { data, error } = await supabase
      .from("empresa_reservas_config")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (data) return { ok: true, data: rowToConfig(data) };
    // crear fila base
    const { data: created, error: errC } = await supabase
      .from("empresa_reservas_config")
      .insert({ empresa_id: empresaId })
      .select("*")
      .single();
    if (errC) throw errC;
    return { ok: true, data: created ? rowToConfig(created) : null };
  } catch (err) {
    console.error("[reservas-config] get:", err);
    return { ok: false, data: null as EmpresaReservasConfig | null };
  }
}

/**
 * Acepta un objeto parcial con las mismas claves que `EmpresaReservasConfig`
 * (en camelCase) y mapea a snake_case para BD. Solo persiste las claves
 * presentes; null es válido (significa "sin valor en ese nivel").
 */
export async function upsertReservasConfig(updates: Partial<EmpresaReservasConfig>) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const db: Record<string, unknown> = { empresa_id: empresaId };
    if ("generalCupoComida"   in updates) db.general_cupo_comida   = updates.generalCupoComida;
    if ("generalCupoCena"     in updates) db.general_cupo_cena     = updates.generalCupoCena;
    if ("generalMaxpaxComida" in updates) db.general_maxpax_comida = updates.generalMaxpaxComida;
    if ("generalMaxpaxCena"   in updates) db.general_maxpax_cena   = updates.generalMaxpaxCena;
    if ("antelacionMinHoras"  in updates) db.antelacion_min_horas  = updates.antelacionMinHoras;
    if ("antelacionMaxDias"   in updates) db.antelacion_max_dias   = updates.antelacionMaxDias;
    for (const d of DIAS) {
      for (const m of METRICAS) {
        for (const t of TURNOS) {
          const k = `${d}_${m}_${t}` as const;
          if (k in updates) db[k] = (updates as Record<string, unknown>)[k];
        }
      }
    }
    const { error } = await supabase
      .from("empresa_reservas_config")
      .upsert(db, { onConflict: "empresa_id" });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-config] upsert:", msg);
    return { ok: false, error: msg };
  }
}
