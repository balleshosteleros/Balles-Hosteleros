import { createClient } from "@supabase/supabase-js";

/**
 * Datos estructurados (JSON-LD de schema.org) de la web pública de un local.
 *
 * POR QUÉ EXISTE: sin esto Google no sabe leer de la web el teléfono, la
 * dirección ni el tipo de cocina, y en las búsquedas locales acaban por delante
 * los directorios (Tripadvisor, RestaurantGuru…) que sí los declaran. Es la
 * pieza que más pesa en el posicionamiento de un negocio con local físico y era
 * lo único importante que faltaba: título, descripción, canonical, sitemap y
 * velocidad ya estaban bien (auditado 08-09-2026).
 *
 * ⚠️ SOLO se declara lo que existe de verdad en la ficha de la empresa. Un dato
 * inventado o desactualizado aquí es peor que no ponerlo: Google lo contrasta
 * con la ficha de Google Business y una discordancia resta confianza. Por eso
 * `horarioGeneral` no se publica mientras esté vacío, y `priceRange` tampoco:
 * ninguno de los dos está relleno hoy.
 */

/** Tipos de establecimiento que schema.org distingue y usamos. */
const TIPOS_SCHEMA: Record<string, string> = {
  restaurante: "Restaurant",
  bar: "BarOrPub",
  cafeteria: "CafeOrCoffeeShop",
  cocteleria: "BarOrPub",
};

interface DatosGenerales {
  nombreComercial?: string;
  direccionLocal?: string;
  codigoPostal?: string;
  ciudad?: string;
  provincia?: string;
  pais?: string;
  telefonoPrincipal?: string;
  tipoEstablecimiento?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

function perfilRed(valor: string | undefined, base: string): string | null {
  const v = valor?.trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const usuario = v.replace(/^@/, "");
  // TikTok lleva la arroba pegada al usuario (`/@usuario`); Instagram y
  // Facebook usan una barra. Sin esto salía `/@/usuario`, que es un 404.
  return base.endsWith("@") ? `${base}${usuario}` : `${base}/${usuario}`;
}

/**
 * Construye el JSON-LD del local. Devuelve `null` si faltan los datos mínimos
 * (nombre y dirección): un schema a medias no aporta y puede confundir.
 */
export async function schemaNegocioDeEmpresa(
  empresaId: string,
  urlCanonica: string,
  imagenUrl: string | null,
  descripcion: string | null,
): Promise<Record<string, unknown> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await db
      .from("empresas")
      .select("nombre, datos_generales")
      .eq("id", empresaId)
      .maybeSingle();
    if (!data) return null;

    const dg = (data.datos_generales as DatosGenerales | null) ?? {};
    const nombre = dg.nombreComercial?.trim() || (data.nombre as string) || "";
    const calle = dg.direccionLocal?.trim();
    if (!nombre || !calle) return null;

    const tipo =
      TIPOS_SCHEMA[
        (dg.tipoEstablecimiento ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
      ] ?? "Restaurant";

    const redes = [
      perfilRed(dg.instagram, "https://www.instagram.com"),
      perfilRed(dg.facebook, "https://www.facebook.com"),
      perfilRed(dg.tiktok, "https://www.tiktok.com/@"),
    ].filter(Boolean);

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": tipo,
      name: nombre,
      url: urlCanonica,
      address: {
        "@type": "PostalAddress",
        streetAddress: calle,
        addressLocality: dg.ciudad?.trim() || undefined,
        postalCode: dg.codigoPostal?.trim() || undefined,
        addressRegion: dg.provincia?.trim() || undefined,
        addressCountry: dg.pais?.trim() || "España",
      },
    };

    // El teléfono se declara en formato internacional: es como lo espera
    // schema.org y como lo marca el móvil al pulsarlo.
    const tel = dg.telefonoPrincipal?.replace(/\s+/g, "");
    if (tel) schema.telephone = tel.startsWith("+") ? tel : `+34${tel}`;
    if (imagenUrl) schema.image = imagenUrl;
    if (descripcion) schema.description = descripcion;
    if (redes.length > 0) schema.sameAs = redes;
    // `acceptsReservations` solo si es cierto: el portal de reservas es propio
    // y está publicado en la misma web.
    schema.acceptsReservations = true;

    return schema;
  } catch (err) {
    console.error("[schema-negocio] schemaNegocioDeEmpresa:", err);
    return null;
  }
}
