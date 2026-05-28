import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedMerchant {
  empresaId: string;
  slug: string;
}

/**
 * Resuelve un place_id de Google → empresa Balles.
 * Devuelve null si no hay match (Platform Policy: responder vacío, NO 404).
 */
export async function resolveEmpresaByPlaceId(
  admin: SupabaseClient,
  placeId: string,
): Promise<ResolvedMerchant | null> {
  if (!placeId) return null;
  const { data } = await admin
    .from("empresas")
    .select("id, slug")
    .eq("google_place_id", placeId)
    .maybeSingle();
  if (!data) return null;
  return { empresaId: data.id as string, slug: data.slug as string };
}
