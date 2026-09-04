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
    /** De dónde vino el token: decide si se piden las tres valoraciones. */
    origen: "carta" | "reserva";
  };
  /**
   * Qué se le pregunta a este cliente. Cada empresa decide lo que valora en
   * Reservas → Configuración → Comunicaciones: HABANA, por ejemplo, no
   * pregunta por la cocina. La nota general se pide siempre y por eso no está.
   */
  campos: {
    cocina: boolean;
    servicio: boolean;
    ambiente: boolean;
  };
};

export async function fetchResenaPagina(
  token: string,
): Promise<ResenaPagina | null> {
  try {
    const supabase = service();

    // El token puede venir de dos sitios: del QR de la carta (`visita_leads`)
    // o del correo de valoración que se manda tras una reserva. Se prueba
    // primero el lead por ser el flujo más antiguo.
    const { data: leadRow } = await supabase
      .from("visita_leads")
      .select("id, empresa_id, nombre")
      .eq("resena_token", token)
      .maybeSingle();

    let lead: {
      id: string;
      empresa_id: string;
      nombre: string | null;
      origen: "carta" | "reserva";
    } | null = leadRow
      ? {
          id: leadRow.id as string,
          empresa_id: leadRow.empresa_id as string,
          nombre: (leadRow.nombre as string | null) ?? null,
          origen: "carta",
        }
      : null;

    if (!lead) {
      const { data: reserva } = await supabase
        .from("reservas")
        .select("id, empresa_id, cliente_nombre")
        .eq("valoracion_token", token)
        .maybeSingle();
      if (reserva) {
        lead = {
          id: reserva.id as string,
          empresa_id: reserva.empresa_id as string,
          nombre: (reserva.cliente_nombre as string | null) ?? null,
          origen: "reserva",
        };
      }
    }

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

    // Qué preguntas enseña la encuesta. Solo aplica a la valoración de una
    // reserva: el QR de la carta pide únicamente la nota general.
    const { data: cfgReservas } = await supabase
      .from("empresa_reservas_config")
      .select(
        "valoracion_pide_cocina, valoracion_pide_servicio, valoracion_pide_ambiente",
      )
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
        id: lead.id,
        nombre: lead.nombre ?? "",
        yaRespondio: (count ?? 0) > 0,
        origen: lead.origen,
      },
      // Sin fila de configuración se preguntan las tres, que es como funcionaba
      // antes de poder elegir.
      campos: {
        cocina: cfgReservas?.valoracion_pide_cocina ?? true,
        servicio: cfgReservas?.valoracion_pide_servicio ?? true,
        ambiente: cfgReservas?.valoracion_pide_ambiente ?? true,
      },
    };
  } catch (err) {
    console.error("[resena-fetch] fatal:", err);
    return null;
  }
}
