"use server";

/**
 * Config del envío automático de nóminas a la gestoría (Ajustes de Pagos).
 *
 * Vive en columnas de `empresas` (config general de empresa, igual que la de
 * liquidaciones). Incluye la acción «Enviar ahora» que dispara el correo del mes
 * en curso sin esperar al día configurado.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { enviarSolicitudNominasGestoria } from "@/features/rrhh/services/nominas/nominas-gestoria";

export interface NominasGestoriaConfig {
  activo: boolean;
  email: string;
  emailCc: string;
  diaEnvio: number; // 1-28
  notifRrhh: boolean;
  ultimoEnvio: string | null; // AAAA-MM ya enviado (informativo)
}

const CONFIG_DEFAULT: NominasGestoriaConfig = {
  activo: false,
  email: "",
  emailCc: "",
  diaEnvio: 25,
  notifRrhh: true,
  ultimoEnvio: null,
};

export async function getNominasGestoriaConfig(): Promise<NominasGestoriaConfig> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return CONFIG_DEFAULT;
    const { data, error } = await supabase
      .from("empresas")
      .select(
        "nominas_gestoria_activo, nominas_gestoria_email, nominas_gestoria_email_cc, nominas_gestoria_dia_envio, nominas_gestoria_notif_rrhh, nominas_gestoria_ultimo_envio",
      )
      .eq("id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return CONFIG_DEFAULT;
    return {
      activo: data.nominas_gestoria_activo ?? false,
      email: (data.nominas_gestoria_email as string | null) ?? "",
      emailCc: (data.nominas_gestoria_email_cc as string | null) ?? "",
      diaEnvio: (data.nominas_gestoria_dia_envio as number | null) ?? 25,
      notifRrhh: data.nominas_gestoria_notif_rrhh ?? true,
      ultimoEnvio: (data.nominas_gestoria_ultimo_envio as string | null) ?? null,
    };
  } catch (err) {
    console.error("[nominas-gestoria] getConfig:", err);
    return CONFIG_DEFAULT;
  }
}

export async function setNominasGestoriaConfig(
  cfg: Partial<NominasGestoriaConfig>,
): Promise<{ ok: boolean }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false };
    const payload: Record<string, unknown> = {};
    if (cfg.activo !== undefined) payload.nominas_gestoria_activo = cfg.activo;
    if (cfg.email !== undefined) payload.nominas_gestoria_email = cfg.email.trim() || null;
    if (cfg.emailCc !== undefined) payload.nominas_gestoria_email_cc = cfg.emailCc.trim() || null;
    if (cfg.diaEnvio !== undefined) {
      // Acotado a 1-28 para que el día exista en todos los meses.
      payload.nominas_gestoria_dia_envio = Math.max(1, Math.min(28, Math.round(cfg.diaEnvio)));
    }
    if (cfg.notifRrhh !== undefined) payload.nominas_gestoria_notif_rrhh = cfg.notifRrhh;
    if (Object.keys(payload).length === 0) return { ok: true };
    const { error } = await supabase.from("empresas").update(payload).eq("id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[nominas-gestoria] setConfig:", err);
    return { ok: false };
  }
}

/**
 * «Enviar ahora»: dispara el correo a la gestoría con el enlace del MES en curso
 * (zona horaria de la empresa), sin esperar al día configurado. No cambia
 * `ultimo_envio` (es un envío manual, no el automático del cron).
 */
export async function enviarNominasGestoriaAhora(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autorizado" };
    const admin = createAdminClient();
    const tz = await getZonaHorariaEmpresa(admin, empresaId);
    const periodo = hoyEnZona(tz).slice(0, 7); // "AAAA-MM"
    const res = await enviarSolicitudNominasGestoria(admin, empresaId, periodo);
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (err) {
    console.error("[nominas-gestoria] enviarAhora:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
