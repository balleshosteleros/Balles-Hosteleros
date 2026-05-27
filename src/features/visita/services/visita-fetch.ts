/**
 * Fetch público de la landing de visita.
 *
 * Resuelve la empresa por `carta_slug` (mismo slug que usa /carta/[slug])
 * y carga su `visita_config`. Server-only, usa service-role.
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type VisitaPublica = {
  empresa: {
    id: string;
    nombre: string;
    slug: string;
    logoUrl: string | null;
    heroUrl: string | null;
    colorPrimario: string | null;
    colorSecundario: string | null;
    descripcion: string | null;
  };
  config: {
    bienvenida_titulo: string;
    bienvenida_subtitulo: string;
    popup_titulo: string;
    popup_subtitulo: string;
    popup_boton_texto: string;
  };
};

function resolverPlaceholders(s: string, nombreEmpresa: string): string {
  return s.replaceAll("{nombre_empresa}", nombreEmpresa);
}

const DEFAULTS = {
  bienvenida_titulo: "Desbloquea la carta y nuestros secretos.",
  bienvenida_subtitulo:
    "La carta completa con fotos\nLos 3 platos secretos del chef\n10% en tu próxima visita",
  popup_titulo: "Un último paso para abrir la carta",
  popup_subtitulo:
    "Te mandamos los 3 platos secretos y un 10% para la próxima. Sin spam.",
  popup_boton_texto: "Ver carta + secretos",
};

export async function fetchVisitaPorSlug(
  slug: string,
): Promise<VisitaPublica | null> {
  try {
    const supabase = service();

    const { data: empresa } = await supabase
      .from("empresas")
      .select(
        "id, nombre, carta_slug, carta_publicada, carta_descripcion, logo_url, color, color_secundario, carta_hero_url",
      )
      .eq("carta_slug", slug)
      .eq("carta_publicada", true)
      .maybeSingle();

    if (!empresa) return null;

    const { data: cfg } = await supabase
      .from("visita_config")
      .select(
        "activado, hero_url, bienvenida_titulo, bienvenida_subtitulo, popup_titulo, popup_subtitulo, popup_boton_texto",
      )
      .eq("empresa_id", empresa.id)
      .maybeSingle();

    // Si la empresa no ha activado la landing, devolvemos null y la página
    // redirigirá a /carta/[slug] (la carta cruda).
    if (!cfg?.activado) return null;

    const nombre = (empresa.nombre as string) ?? "";

    return {
      empresa: {
        id: empresa.id as string,
        nombre,
        slug: empresa.carta_slug as string,
        logoUrl: (empresa.logo_url as string | null) ?? null,
        // Solo usamos hero específico de la landing. NUNCA caemos al
        // `carta_hero_url` porque suele ser el logo y queda raro como fondo.
        heroUrl: (cfg?.hero_url as string | null) ?? null,
        colorPrimario: (empresa.color as string | null) ?? null,
        colorSecundario: (empresa.color_secundario as string | null) ?? null,
        descripcion: (empresa.carta_descripcion as string | null) ?? null,
      },
      config: {
        bienvenida_titulo: resolverPlaceholders(
          (cfg?.bienvenida_titulo as string) ?? DEFAULTS.bienvenida_titulo,
          nombre,
        ),
        bienvenida_subtitulo: resolverPlaceholders(
          (cfg?.bienvenida_subtitulo as string) ?? DEFAULTS.bienvenida_subtitulo,
          nombre,
        ),
        popup_titulo: resolverPlaceholders(
          (cfg?.popup_titulo as string) ?? DEFAULTS.popup_titulo,
          nombre,
        ),
        popup_subtitulo: resolverPlaceholders(
          (cfg?.popup_subtitulo as string) ?? DEFAULTS.popup_subtitulo,
          nombre,
        ),
        popup_boton_texto:
          (cfg?.popup_boton_texto as string) ?? DEFAULTS.popup_boton_texto,
      },
    };
  } catch (err) {
    console.error("[visita-fetch] fatal:", err);
    return null;
  }
}
