import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { clasificarDispositivo } from "@/features/marketing/qr/services/resolver";

/**
 * Analítica de las páginas públicas: clics de los botones, tiempo de la visita
 * y de dónde llega la gente.
 *
 * Server-only con service-role, igual que el conteo de visitas: quien navega la
 * web es un cliente anónimo sin cuenta en el sistema.
 *
 * NO se guarda cookie, IP ni identificador de navegador. Todo son contadores
 * agregados por día, así que la medida no necesita consentimiento y sale sobre
 * el 100% del tráfico, no solo sobre quien acepta el banner.
 */

/** Familias de origen que se distinguen. Cualquier otro dominio cae en "otra
 *  web": el listado tiene que caber en pantalla y decir algo, no enumerar
 *  cientos de referidos con una visita cada uno. */
const FUENTES: Array<{ patron: RegExp; origen: string }> = [
  { patron: /google\./i, origen: "google" },
  { patron: /bing\.|duckduckgo\.|ecosia\.|yahoo\./i, origen: "otros buscadores" },
  { patron: /instagram\./i, origen: "instagram" },
  { patron: /facebook\.|fb\.com|fb\.me/i, origen: "facebook" },
  { patron: /tiktok\./i, origen: "tiktok" },
  { patron: /whatsapp\.|wa\.me/i, origen: "whatsapp" },
  { patron: /t\.co|twitter\.|x\.com/i, origen: "x" },
  { patron: /tripadvisor\./i, origen: "tripadvisor" },
  { patron: /thefork\.|eltenedor\./i, origen: "thefork" },
  { patron: /youtube\.|youtu\.be/i, origen: "youtube" },
  { patron: /linkedin\./i, origen: "linkedin" },
];

/**
 * Traduce de dónde viene la visita a una familia corta.
 *
 * `utm_source` manda sobre el referido: es lo que el restaurante escribe a mano
 * en sus propios enlaces (el QR de la mesa, la campaña de Instagram) y describe
 * la intención real mejor que el dominio desde el que se pulsó.
 *
 * Sin referido y sin utm es "directo": alguien que escribió la dirección, la
 * tenía guardada o llegó desde una app que no dice de dónde viene.
 */
export function clasificarOrigen(
  referido: string | null,
  utmSource: string | null,
  hostPropio: string | null,
): string {
  const utm = (utmSource ?? "").trim().toLowerCase();
  if (utm) return utm.slice(0, 60);

  const ref = (referido ?? "").trim();
  if (!ref) return "directo";

  let host: string;
  try {
    host = new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return "directo";
  }

  // Navegar de la carta a la home es la misma web: no es una fuente de tráfico.
  const propio = (hostPropio ?? "").replace(/^www\./, "").toLowerCase();
  if (propio && host.toLowerCase() === propio) return "navegación interna";

  const fuente = FUENTES.find((f) => f.patron.test(host));
  return fuente ? fuente.origen : "otra web";
}

/**
 * Nombre legible del botón a partir de su destino, para cuando el botón no
 * lleva texto (un icono de Instagram, el de WhatsApp).
 */
export function nombrarDestino(destino: string): string {
  if (destino.startsWith("/reservar/")) return "Reservar";
  if (destino.startsWith("/carta/")) return "Ver la carta";
  if (destino.startsWith("/empleo/")) return "Trabaja con nosotros";
  if (destino.startsWith("tel:")) return "Llamar";
  if (destino.startsWith("mailto:")) return "Escribir un correo";
  if (/wa\.me|whatsapp/i.test(destino)) return "WhatsApp";
  if (/instagram\./i.test(destino)) return "Instagram";
  if (/facebook\./i.test(destino)) return "Facebook";
  if (/tiktok\./i.test(destino)) return "TikTok";
  if (/maps\.|google\.[a-z.]+\/maps/i.test(destino)) return "Cómo llegar";
  return destino;
}

/** Suma un clic. Nunca lanza: la web tiene que funcionar aunque la medida falle. */
export async function registrarClic(
  paginaId: string,
  destino: string,
  etiqueta: string,
  userAgent: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("paginas_web_registrar_clic", {
      p_pagina_id: paginaId,
      p_destino: destino,
      p_etiqueta: etiqueta || nombrarDestino(destino),
      p_dispositivo: clasificarDispositivo(userAgent),
    });
    if (error) console.error("[web][registrarClic]", error.message);
  } catch (err) {
    console.error("[web][registrarClic] fatal:", err);
  }
}

/** Suma el tiempo de una visita que acaba de cerrarse. */
export async function registrarTiempo(
  paginaId: string,
  segundos: number,
  interactuo: boolean,
  userAgent: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("paginas_web_registrar_tiempo", {
      p_pagina_id: paginaId,
      p_segundos: Math.round(segundos),
      p_interactuo: interactuo,
      p_dispositivo: clasificarDispositivo(userAgent),
    });
    if (error) console.error("[web][registrarTiempo]", error.message);
  } catch (err) {
    console.error("[web][registrarTiempo] fatal:", err);
  }
}

/** Suma el origen de una visita. */
export async function registrarOrigen(
  paginaId: string,
  origen: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("paginas_web_registrar_origen", {
      p_pagina_id: paginaId,
      p_origen: origen,
    });
    if (error) console.error("[web][registrarOrigen]", error.message);
  } catch (err) {
    console.error("[web][registrarOrigen] fatal:", err);
  }
}
