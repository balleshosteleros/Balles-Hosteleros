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
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", userId)
      .eq("empresa_id", cookieEmpresa)
      .maybeSingle();
    if (linked) return cookieEmpresa;
  }
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", userId)
    .single();
  return (data?.empresa_id as string) ?? null;
}
