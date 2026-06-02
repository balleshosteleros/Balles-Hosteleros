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
    antelacionMinMinutos: (row.antelacion_min_minutos as number) ?? 0,
    antelacionMaxDias:    (row.antelacion_max_dias as number)    ?? 90,
    generalInicioComida:  (row.general_inicio_comida as string | null) ?? null,
    generalFinComida:     (row.general_fin_comida    as string | null) ?? null,
    generalInicioCena:    (row.general_inicio_cena   as string | null) ?? null,
    generalFinCena:       (row.general_fin_cena      as string | null) ?? null,
    generalCerradoComida: Boolean(row.general_cerrado_comida ?? false),
    generalCerradoCena:   Boolean(row.general_cerrado_cena   ?? false),
  };
  for (const d of DIAS) {
    for (const m of METRICAS) {
      for (const t of TURNOS) {
        const dbKey = `${d}_${m}_${t}`;
        const objKey = `${d}_${m}_${t}` as const;
        out[objKey] = (row[dbKey] as number | null) ?? null;
      }
    }
    for (const t of TURNOS) {
      out[`${d}_inicio_${t}`]  = (row[`${d}_inicio_${t}`]  as string | null) ?? null;
      out[`${d}_fin_${t}`]     = (row[`${d}_fin_${t}`]     as string | null) ?? null;
      out[`${d}_cerrado_${t}`] = (row[`${d}_cerrado_${t}`] as boolean | null) ?? null;
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
    if ("antelacionMinMinutos" in updates) db.antelacion_min_minutos = updates.antelacionMinMinutos;
    if ("antelacionMaxDias"    in updates) db.antelacion_max_dias    = updates.antelacionMaxDias;
    if ("generalInicioComida"  in updates) db.general_inicio_comida  = updates.generalInicioComida;
    if ("generalFinComida"     in updates) db.general_fin_comida     = updates.generalFinComida;
    if ("generalInicioCena"    in updates) db.general_inicio_cena    = updates.generalInicioCena;
    if ("generalFinCena"       in updates) db.general_fin_cena       = updates.generalFinCena;
    if ("generalCerradoComida" in updates) db.general_cerrado_comida = updates.generalCerradoComida;
    if ("generalCerradoCena"   in updates) db.general_cerrado_cena   = updates.generalCerradoCena;
    for (const d of DIAS) {
      for (const m of METRICAS) {
        for (const t of TURNOS) {
          const k = `${d}_${m}_${t}` as const;
          if (k in updates) db[k] = (updates as Record<string, unknown>)[k];
        }
      }
      for (const t of TURNOS) {
        const kIni = `${d}_inicio_${t}` as const;
        const kFin = `${d}_fin_${t}` as const;
        const kCer = `${d}_cerrado_${t}` as const;
        if (kIni in updates) db[kIni] = (updates as Record<string, unknown>)[kIni];
        if (kFin in updates) db[kFin] = (updates as Record<string, unknown>)[kFin];
        if (kCer in updates) db[kCer] = (updates as Record<string, unknown>)[kCer];
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
