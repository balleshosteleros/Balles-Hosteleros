import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

const COOKIE_NAME = "bh_empresa_activa";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Empresa activa para el usuario autenticado: cookie del switcher si está
 * autorizada en user_empresas, si no la del profile como fallback.
 * Pensado para todo módulo cuyo scope deba seguir al selector de empresa.
 */
export async function getEmpresaActivaForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const store = await cookies();
  const cookieEmpresa = store.get(COOKIE_NAME)?.value;
  if (cookieEmpresa && UUID_RE.test(cookieEmpresa)) {
    const { data: linked } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("user_id", userId)
      .eq("empresa_id", cookieEmpresa)
      .maybeSingle();
    if (linked) return cookieEmpresa;
  }
  const { data } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("user_id", userId)
    .single();
  return (data?.empresa_id as string) ?? null;
}

/** Zona horaria por defecto cuando la empresa no tiene una configurada. */
export const ZONA_HORARIA_DEFAULT = "Europe/Madrid";

/**
 * Zona horaria (IANA) de una empresa, leída de Ajustes → Configuración regional
 * (`empresas.config_operativa.zonaHoraria`, p. ej. "Europe/Madrid",
 * "Atlantic/Canary"). Es un nombre de zona, NO un desfase fijo: al formatear un
 * instante con ella, el horario de verano/invierno se aplica solo según la FECHA
 * de ese instante. Así cada registro conserva para siempre la hora real que tuvo
 * cuando ocurrió, sin tocar nunca la BD (que guarda UTC). Fallback: Europe/Madrid.
 */
export async function getZonaHorariaEmpresa(
  supabase: SupabaseClient,
  empresaId: string | null,
): Promise<string> {
  if (!empresaId) return ZONA_HORARIA_DEFAULT;
  const { data } = await supabase
    .from("empresas")
    .select("config_operativa")
    .eq("id", empresaId)
    .maybeSingle();
  const cfg = (data?.config_operativa as Record<string, unknown> | null) ?? null;
  const tz = cfg && typeof cfg.zonaHoraria === "string" ? cfg.zonaHoraria.trim() : "";
  return tz || ZONA_HORARIA_DEFAULT;
}
