"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/supabase/get-context";

/**
 * Interruptores de las notificaciones automáticas (Ajustes → Herramientas →
 * Notificaciones). Sin fila en `notificaciones_config` = notificación activa,
 * así lo nuevo nace encendido sin sembrar filas por empresa.
 */

/** Mapa tipo → activo. Solo trae los que están APAGADOS; el resto se asume on. */
export async function getNotifInterruptores(): Promise<Record<string, boolean>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return {};
    const { data, error } = await supabase
      .from("notificaciones_config")
      .select("tipo, activo")
      .eq("empresa_id", empresaId);
    if (error) throw error;
    const out: Record<string, boolean> = {};
    for (const r of data ?? []) out[r.tipo as string] = r.activo as boolean;
    return out;
  } catch (err) {
    console.error("[notificaciones] getNotifInterruptores:", err);
    return {};
  }
}

export async function setNotifInterruptor(
  tipo: string,
  activo: boolean,
): Promise<{ ok: boolean }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false };
    const { error } = await supabase.from("notificaciones_config").upsert(
      {
        empresa_id: empresaId,
        tipo,
        activo,
        updated_at: new Date().toISOString(),
        updated_by: userId ?? null,
      },
      { onConflict: "empresa_id,tipo" },
    );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[notificaciones] setNotifInterruptor:", err);
    return { ok: false };
  }
}

/**
 * ¿Está activa esta notificación para esta empresa?
 *
 * La consultan los emisores (incluidos crons sin sesión), por eso usa cliente
 * service. Ante cualquier error devuelve `true`: es preferible que un aviso
 * salga a que un fallo de lectura silencie el sistema entero.
 */
export async function notifActiva(tipo: string, empresaId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("notificaciones_config")
      .select("activo")
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .maybeSingle();
    if (error) throw error;
    return data ? (data.activo as boolean) : true;
  } catch (err) {
    console.error("[notificaciones] notifActiva:", err);
    return true;
  }
}
