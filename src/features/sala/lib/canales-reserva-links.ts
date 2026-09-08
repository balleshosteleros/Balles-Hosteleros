import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReservaUrl } from "@/features/sala/data/reserva-links";

/**
 * Canales de reserva que TODA empresa tiene desde el primer día.
 *
 * Son los sitios donde el restaurante pone un botón "Reservar" que apunta a su
 * portal: la ficha de Google Business, el perfil de Instagram y la página de
 * Facebook. No son integraciones —no hay claves ni webhooks—, solo enlaces con
 * su atribución.
 *
 * ⚠️ La palabra clave ES el origen que se graba en `reservas.origen`
 * (`crear-reserva-publica.ts`), así que estas tres tienen que coincidir con las
 * de `features/sala/data/origenes.ts`, donde ya tienen etiqueta y color. Si se
 * inventa otra, la analítica parte el canal en dos columnas.
 *
 * ⚠️ `GOOGLE` NO es Reserve with Google. Es el enlace de la ficha de Google
 * Business, que funciona hoy sin partnership. Lo que distinguirá al RWG nativo
 * cuando llegue es `external_origen`, no un origen distinto.
 */
export const CANALES_RESERVA_FIJOS = [
  { palabraClave: "GOOGLE", nombre: "Google" },
  { palabraClave: "INSTAGRAM", nombre: "Instagram" },
  { palabraClave: "FACEBOOK", nombre: "Facebook" },
] as const;

/**
 * Garantiza que la empresa tenga sus enlaces de canal, creando los que falten.
 *
 * POR QUÉ EXISTE: los enlaces de BACANAL y HABANA se crearon a mano, así que un
 * local nuevo nacía sin ellos y había que acordarse de darlos de alta uno a uno.
 * Con esto, abrir un restaurante no exige recordar nada: entra en la pantalla y
 * sus enlaces ya están. Mismo patrón que `ensureWebLink()` del portal de empleo.
 *
 * No pisa nada de lo que ya haya: si el enlace existe se respeta tal cual,
 * incluido si el restaurante lo desactivó a propósito.
 *
 * Silencioso a propósito: es una red de seguridad, no una operación que el
 * usuario haya pedido. Si falla, la pantalla debe seguir abriendo con lo que
 * hubiera, no romperse.
 */
export async function ensureCanalesReservaLinks(
  supabase: SupabaseClient,
  empresaId: string,
  empresaSlug: string | null,
  dominioPropio: string | null = null,
): Promise<void> {
  if (!empresaSlug) return;

  try {
    const { data: existentes, error } = await supabase
      .from("reserva_links")
      .select("palabra_clave")
      .eq("empresa_id", empresaId)
      .in(
        "palabra_clave",
        CANALES_RESERVA_FIJOS.map((c) => c.palabraClave),
      );
    if (error) return;

    const yaEstan = new Set((existentes ?? []).map((r) => r.palabra_clave as string));
    const faltan = CANALES_RESERVA_FIJOS.filter((c) => !yaEstan.has(c.palabraClave));
    if (faltan.length === 0) return;

    await supabase.from("reserva_links").insert(
      faltan.map((c) => ({
        empresa_id: empresaId,
        palabra_clave: c.palabraClave,
        url_generada: buildReservaUrl(empresaSlug, c.palabraClave, dominioPropio),
        nombre: c.nombre,
        activo: true,
        vende_tickets: false,
      })),
    );
  } catch {
    // Ver comentario de arriba: nunca tumbar la pantalla por esto.
  }
}
