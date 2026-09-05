import { createClient } from "@supabase/supabase-js";

/**
 * Dominio público propio de una empresa, para construir enlaces que se reparten
 * fuera (QR de mesa, botón de Instagram, cartel de empleo).
 *
 * POR QUÉ EXISTE:
 * Los constructores de enlaces (`buildReservaUrl`, `buildEmpleoUrl`, la URL del
 * QR de la carta) usaban `NEXT_PUBLIC_APP_URL`, que es el dominio del SOFTWARE.
 * Eso hacía que un cliente del restaurante viera `sistema.balleshosteleros.com`
 * —la empresa gestora— en un enlace que debería ser del restaurante, y obligaba
 * a arrastrar el slug de la empresa en la ruta (`/carta/bacanal`) porque el
 * dominio del software no puede adivinar de qué local se trata.
 *
 * Con el dominio propio, el slug sobra: `bacanalmadrid.com/carta` ya identifica
 * al local. El rewrite que lo resuelve vive en `next.config.ts` (`portalesSinSlug`).
 *
 * SIN dominio propio verificado se devuelve `null` y el llamador cae al dominio
 * del software con slug, que sigue funcionando. Un local recién dado de alta,
 * antes de conectar su dominio, no se queda sin enlaces.
 */
export async function dominioPublicoDeEmpresa(
  empresaId: string,
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await db
      .from("paginas_web_dominios")
      .select("hostname")
      .eq("empresa_id", empresaId)
      .eq("estado", "VERIFICADO")
      .eq("ssl_activo", true);

    if (!data?.length) return null;

    // Se prefiere el dominio SIN `www.`: es el que se imprime en un QR y el que
    // se dicta por teléfono. Y nunca un subdominio del software: el objetivo de
    // todo esto es que la marca de la gestora no aparezca en enlaces del cliente.
    const propios = data
      .map((d) => String(d.hostname ?? "").trim().toLowerCase())
      .filter(Boolean)
      .filter((h) => !h.endsWith(".balleshosteleros.com"));

    if (!propios.length) return null;

    const sinWww = propios.find((h) => !h.startsWith("www."));
    return `https://${sinWww ?? propios[0]}`;
  } catch (err) {
    console.error("[dominio-empresa] dominioPublicoDeEmpresa:", err);
    return null;
  }
}
