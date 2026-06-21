"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export interface NotifLiquidacionesConfig {
  activo: boolean;
  requiereAprobacion: boolean;
  pagadoActivo: boolean;
  textoLiquidar: string;
}

const TEXTO_DEFAULT = "Las liquidaciones se emiten siempre el primer miércoles del mes.";

const CONFIG_DEFAULT: NotifLiquidacionesConfig = {
  activo: true,
  requiereAprobacion: true,
  pagadoActivo: true,
  textoLiquidar: TEXTO_DEFAULT,
};

export async function getNotifLiquidacionesConfig(): Promise<NotifLiquidacionesConfig> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return CONFIG_DEFAULT;
    const { data, error } = await supabase
      .from("empresas")
      .select(
        "notif_liquidaciones_activo, notif_liquidaciones_requiere_aprobacion, notif_liquidaciones_pagado_activo, notif_liquidaciones_texto_liquidar",
      )
      .eq("id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return CONFIG_DEFAULT;
    return {
      activo: data.notif_liquidaciones_activo ?? true,
      requiereAprobacion: data.notif_liquidaciones_requiere_aprobacion ?? true,
      pagadoActivo: data.notif_liquidaciones_pagado_activo ?? true,
      textoLiquidar: data.notif_liquidaciones_texto_liquidar ?? TEXTO_DEFAULT,
    };
  } catch (err) {
    console.error("[notificaciones] getNotifLiquidacionesConfig:", err);
    return CONFIG_DEFAULT;
  }
}

export async function setNotifLiquidacionesConfig(
  cfg: Partial<NotifLiquidacionesConfig>,
): Promise<{ ok: boolean }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false };
    const payload: Record<string, unknown> = {};
    if (cfg.activo !== undefined) payload.notif_liquidaciones_activo = cfg.activo;
    if (cfg.requiereAprobacion !== undefined) payload.notif_liquidaciones_requiere_aprobacion = cfg.requiereAprobacion;
    if (cfg.pagadoActivo !== undefined) payload.notif_liquidaciones_pagado_activo = cfg.pagadoActivo;
    if (cfg.textoLiquidar !== undefined) {
      const t = cfg.textoLiquidar.trim();
      payload.notif_liquidaciones_texto_liquidar = t.length > 0 ? t : TEXTO_DEFAULT;
    }
    if (Object.keys(payload).length === 0) return { ok: true };
    const { error } = await supabase.from("empresas").update(payload).eq("id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[notificaciones] setNotifLiquidacionesConfig:", err);
    return { ok: false };
  }
}
