/**
 * PRP-076 · Sitios que se pueden INCRUSTAR (iframe) en una página web.
 *
 * Criterio (decidido con Iván el 2026-08-07): **máxima libertad para el
 * cliente**. Es su web y su responsabilidad — el software no opina sobre el
 * contenido (textos, fotos, qué secciones pone). La lista NO existe para
 * limitar lo que puede poner, sino porque un iframe ejecuta código de un
 * tercero dentro de su página: si ese tercero es malicioso, el daño no lo sufre
 * el cliente sino **quien visita la web** (un comensal reservando mesa), y la
 * llamada de reclamación acaba en Balles.
 *
 * Por eso la regla es: **todo lo que un restaurante pueda querer, dentro**; y
 * cuando pida algo que no esté, se añade aquí en dos minutos. Es una puerta con
 * portero, no un muro.
 *
 * Para añadir un sitio: mete su dominio en la lista y listo. Los subdominios
 * entran solos (`www.`, `open.`, `player.`…).
 */

/** Dominios cuyo contenido se puede incrustar. Subdominios incluidos. */
export const DOMINIOS_INCRUSTABLES: readonly string[] = [
  // — Mapas y cómo llegar
  "google.com", // Maps, Forms, Calendar, Docs, Sheets, Drive
  "google.es",
  "goo.gl",
  "maps.app.goo.gl",
  "openstreetmap.org",
  "waze.com",

  // — Vídeo y audio
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "vimeo.com",
  "player.vimeo.com",
  "dailymotion.com",
  "twitch.tv",
  "spotify.com",
  "open.spotify.com",
  "soundcloud.com",

  // — Reservas y mesas
  "covermanager.com",
  "thefork.com",
  "thefork.es",
  "eltenedor.es",
  "opentable.com",
  "resy.com",
  "sevenrooms.com",
  "bookingkit.net",
  "mesa247.pe",
  "restoo.es",

  // — Reseñas y guías
  "tripadvisor.com",
  "tripadvisor.es",
  "yelp.com",
  "eltenedor.com",
  "thefork.co.uk",

  // — Redes sociales
  "instagram.com",
  "facebook.com",
  "fb.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "pinterest.com",
  "threads.net",

  // — Pedidos a domicilio
  "glovoapp.com",
  "ubereats.com",
  "just-eat.es",
  "justeat.es",
  "deliveroo.es",

  // — Cartas digitales y menús
  "carta.menu",
  "menudigital.es",
  "flipsnack.com",
  "issuu.com",
  "heyzine.com",

  // — Formularios, encuestas y citas
  "typeform.com",
  "jotform.com",
  "airtable.com",
  "calendly.com",
  "cal.com",
  "surveymonkey.com",
  "tally.so",

  // — Pagos, entradas y eventos
  "stripe.com",
  "paypal.com",
  "eventbrite.com",
  "eventbrite.es",
  "fourvenues.com",
  "wetaca.com",

  // — Regalos y fidelización
  "smartbox.com",
  "wonderbox.es",

  // — Infraestructura propia de Balles
  "balleshosteleros.com",
  "bacanalmadrid.com",
  "grupohabana.es",
];

/** Normaliza un hostname: minúsculas, sin protocolo, sin puerto ni ruta. */
function hostDe(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return null; // http:// nunca: contenido inseguro
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * ¿Se puede incrustar esta URL? Exige https y que el dominio (o su dominio
 * padre) esté en la lista. Nunca lanza.
 */
export function esIncrustable(url: string): boolean {
  const host = hostDe(url);
  if (!host) return false;
  return DOMINIOS_INCRUSTABLES.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Mensaje para el usuario cuando una URL no se puede incrustar. En español
 * llano y sin culpar a nadie: el sitio simplemente no está dado de alta todavía.
 */
export function motivoNoIncrustable(url: string): string {
  const host = hostDe(url);
  if (!host) {
    return "Esa dirección no es válida o no es segura (debe empezar por https).";
  }
  return `Todavía no puedo incrustar contenido de ${host}. Dímelo y lo damos de alta.`;
}
