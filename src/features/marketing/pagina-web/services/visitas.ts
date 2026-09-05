import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { clasificarDispositivo } from "@/features/marketing/qr/services/resolver";

/**
 * Registro de visitas de las páginas públicas. Mismo planteamiento que los
 * escaneos de QR: server-only con service-role, porque quien visita la web es
 * un cliente anónimo sin cuenta en el sistema.
 *
 * No se guarda IP ni identificador de persona: interesa "cuánta gente entró en
 * la carta el sábado", no quién entró.
 */

/** Peticiones que no son una persona mirando la web. Contarlas inflaría la
 *  gráfica: un buscador que pasa cada hora no es un cliente. */
const ROBOTS = /bot|crawler|spider|crawling|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|uptime|lighthouse|headless|curl|wget|python-requests|axios|postman|vercel-screenshot|node-fetch/i;

export function esRobot(userAgent: string | null): boolean {
  const ua = (userAgent ?? "").trim();
  // Sin user-agent no hay navegador detrás: son sondas y scripts.
  if (!ua) return true;
  return ROBOTS.test(ua);
}

/**
 * Suma la visita. Nunca lanza: si la estadística falla, la web tiene que
 * cargar igual. Contar es secundario; enseñar la página es el servicio.
 */
export async function registrarVisita(
  paginaId: string,
  userAgent: string | null,
): Promise<void> {
  if (esRobot(userAgent)) return;

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("paginas_web_registrar_visita", {
      p_pagina_id: paginaId,
      p_dispositivo: clasificarDispositivo(userAgent),
    });
    if (error) console.error("[web][registrarVisita]", error.message);
  } catch (err) {
    console.error("[web][registrarVisita] fatal:", err);
  }
}
