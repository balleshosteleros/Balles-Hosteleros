/**
 * Lectura pública para la página /r/[token] (página de reseña).
 * Resuelve el lead + empresa por token, server-only con service-role.
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type ResenaPagina = {
  empresa: {
    id: string;
    nombre: string;
    logoUrl: string | null;
    colorPrimario: string | null;
    redirigir5EstrellasGoogle: boolean;
    googleReviewUrl: string | null;
  };
  lead: {
    id: string;
    nombre: string;
    yaRespondio: boolean;
  };
};

export async function fetchResenaPagina(
  token: string,
): Promise<ResenaPagina | null> {
  try {
    const supabase = service();

    const { data: lead } = await supabase
      .from("visita_leads")
      .select("id, empresa_id, nombre")
      .eq("resena_token", token)
      .maybeSingle();
    if (!lead) return null;

    const { data: empresa } = await supabase
      .from("empresas")
      .select("id, nombre, logo_url, color")
      .eq("id", lead.empresa_id)
      .maybeSingle();
    if (!empresa) return null;

    const { data: cfg } = await supabase
      .from("visita_config")
      .select("redirigir_5estrellas_google, google_review_url")
      .eq("empresa_id", empresa.id)
      .maybeSingle();

    // ¿Ya respondió? Buscamos reseñas con external_id = token (lo guardamos
    // así al insertar la reseña pública para evitar duplicados).
    const { count } = await supabase
      .from("resenas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa.id)
      .eq("external_id", token);

    return {
      empresa: {
        id: empresa.id as string,
        nombre: (empresa.nombre as string) ?? "",
        logoUrl: (empresa.logo_url as string | null) ?? null,
        colorPrimario: (empresa.color as string | null) ?? null,
        redirigir5EstrellasGoogle: Boolean(cfg?.redirigir_5estrellas_google),
        googleReviewUrl: (cfg?.google_review_url as string | null) ?? null,
      },
      lead: {
        id: lead.id as string,
        nombre: (lead.nombre as string) ?? "",
        yaRespondio: (count ?? 0) > 0,
      },
    };
  } catch (err) {
    console.error("[resena-fetch] fatal:", err);
    return null;
  }
}
