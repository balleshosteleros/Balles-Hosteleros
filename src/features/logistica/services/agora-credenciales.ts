import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/features/accesos/lib/crypto";
import { EMPRESA_WORKPLACE } from "@/features/logistica/services/agora-ventas-ingesta";

/**
 * Credenciales resueltas de Ágora para una empresa (PRP-059).
 * `fuente` indica de dónde salieron (para diagnóstico/logs).
 */
export interface AgoraCredenciales {
  url: string;
  token: string;
  workplaceId: number;
  fuente: "empresa" | "env-fallback";
}

/**
 * Fuente ÚNICA de credenciales de Ágora.
 *
 * 1. Si la empresa tiene el conector activo y configurado en BD, usa SUS claves
 *    (token descifrado). Es el camino definitivo multi-tenant.
 * 2. Si no, durante la transición cae a las envs globales AGORA_API_URL /
 *    AGORA_API_TOKEN + el mapa EMPRESA_WORKPLACE (solo Habana/Bacanal).
 *
 * Devuelve `null` si la empresa no tiene Ágora ni por BD ni por fallback
 * (→ el llamador la salta sin error).
 */
export async function getAgoraCredenciales(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  empresaId: string,
): Promise<AgoraCredenciales | null> {
  const { data: emp } = await supabase
    .from("empresas")
    .select("agora_activo, agora_api_url, agora_api_token_cifrado, agora_workplace_id")
    .eq("id", empresaId)
    .single();

  // 1. Config por empresa en BD (camino definitivo)
  if (
    emp?.agora_activo &&
    emp.agora_api_url &&
    emp.agora_api_token_cifrado &&
    emp.agora_workplace_id != null
  ) {
    let token: string;
    try {
      token = decrypt(emp.agora_api_token_cifrado as string);
    } catch {
      // Token corrupto o clave de cifrado ausente → no usamos credenciales a medias.
      return fallbackEnv(empresaId);
    }
    return {
      url: String(emp.agora_api_url).replace(/\/$/, ""),
      token,
      workplaceId: Number(emp.agora_workplace_id),
      fuente: "empresa",
    };
  }

  // 2. Fallback de transición a envs globales
  return fallbackEnv(empresaId);
}

/** Fallback a las variables de entorno globales (solo empresas del mapa legacy). */
function fallbackEnv(empresaId: string): AgoraCredenciales | null {
  const url = (process.env.AGORA_API_URL ?? "").replace(/\/$/, "");
  const token = process.env.AGORA_API_TOKEN;
  const workplaceId = EMPRESA_WORKPLACE[empresaId];
  if (!url || !token || workplaceId == null) return null;
  return { url, token, workplaceId, fuente: "env-fallback" };
}
