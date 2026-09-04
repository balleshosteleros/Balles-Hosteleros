/**
 * Orígenes de una reserva. La columna `reservas.origen` es `text` libre y así
 * se queda: por ahí entran las palabras clave de los enlaces de campaña
 * (`reserva_links.palabra_clave`), que se crean desde Marketing sin tocar
 * código. Un catálogo cerrado dejaría fuera cualquier campaña nueva.
 *
 * Por eso este módulo NO valida contra una lista: normaliza el string crudo a
 * una CLAVE estable y le asigna etiqueta y color. Lo conocido (web, google,
 * teléfono, walk-in, redes) tiene nombre y color fijos; lo que no está en la
 * tabla conserva su propia clave —nunca cae en un cajón "Otros"— y recibe un
 * color estable derivado de su nombre. Así, si mañana entra una reserva con
 * origen "TIKTOK" o con la palabra clave "NAVIDAD", aparece en la analítica
 * con su nombre propio y siempre del mismo color, sin desplegar nada.
 *
 * Regla operativa: quien llega sin reservar se marca con origen `WALKIN` — el
 * restaurante no le captó por ningún canal digital, llegó andando. "Walk in"
 * es SIEMPRE un origen: como estado no existe, porque se perdía en cuanto se
 * sentaba al cliente.
 *
 * Regla operativa 2: un alta de tipo Cliente desde el back-office nace con
 * `TELEFONO`, que es como entra la inmensa mayoría — pero el usuario puede
 * cambiarlo, porque también se apunta gente que llama a la puerta o escribe.
 *
 * Regla operativa 3: "Manual" NO es un origen. Toda reserva entra por un canal
 * real (teléfono, local, web, redes…) y el alta desde sala obliga a elegirlo.
 * Una reserva sin `origen` en BD es un dato que falta, no un canal: se rotula
 * como tal y no se ofrece en ningún selector ni filtro.
 */

/** Clave normalizada de origen. Es `string` a propósito: el catálogo es abierto. */
export type OrigenBucket = string;

/**
 * Rótulo para una reserva sin `origen` en BD. No es un canal: es la marca de
 * que el dato falta (reservas antiguas anteriores a que el origen fuese
 * obligatorio). Por eso no aparece en selectores ni en filtros.
 */
export const ORIGEN_SIN_DATO = "SIN_DATO";

/**
 * Alias de valores crudos que significan lo mismo → clave canónica.
 * Todo lo que entra por el motor de la web se lee igual ("Web"), venga del
 * enlace pelado o de un enlace de campaña sin palabra clave.
 *
 * Debe mantenerse coherente con `origenLabel()` en `data/reservas.ts`, que es
 * lo que ve el staff en el listado de reservas: el mismo origen no puede
 * llamarse de dos formas distintas en dos pantallas.
 */
const ALIAS: Record<string, string> = {
  RESERVA_WEB: "WEB",
  PORTAL_PROPIO: "WEB",
  WWW: "WEB",
  MOTOR_WEB: "WEB",
  "MOTOR WEB": "WEB",
  WALK_IN: "WALKIN",
  "WALK-IN": "WALKIN",
  "WALK IN": "WALKIN",
  TELEFONO: "TELEFONO",
  "TELÉFONO": "TELEFONO",
  TLF: "TELEFONO",
  IG: "INSTAGRAM",
  FB: "FACEBOOK",
  GOOGLE_RWG: "GOOGLE",
  "RESERVE WITH GOOGLE": "GOOGLE",
  // Canales heredados de CoverManager (migración 2022-2026). Cover rotulaba
  // "terceros" a lo que entraba por portales externos: en nuestro caso solo
  // estaba conectado Google, así que se leen como GOOGLE y no como un canal
  // aparte. `SALA` es la que apuntó el personal desde el propio programa:
  // en los informes del grupo eso siempre se ha llamado TELÉFONO, que es como
  // entra (alguien llama y el personal la escribe).
  TERCEROS: "GOOGLE",
  // La app movil de Cover era otra forma de reservar por internet: se lee
  // como WEB, igual que el navegador. Ese canal muere con Cover.
  APP: "WEB",
  SALA: "TELEFONO",
  // Grafias sueltas del prescriptor que escribia el personal en Cover.
  CAMPAÑA: "CAMPANA",
  "GOOGLE ORGÁNICO": "GOOGLE_ORGANICO",
  "INSTAGRAM ORGÁNICO": "INSTAGRAM_ORGANICO",
  GOOGLEADDS: "GOOGLE_ADS",
  GOOGLEADS: "GOOGLE_ADS",
  INSTAGRAMHISTORIAS: "INSTAGRAM",
  FIDELIZACIÓN: "FIDELIZACION",
};

/** Etiquetas de los orígenes conocidos. El resto se rotula desde su propia clave. */
const LABELS: Record<string, string> = {
  WEB: "Web",
  GOOGLE: "Google",
  TELEFONO: "Teléfono",
  WALKIN: "Walk in",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  AGORA: "Ágora",
  LISTA_ESPERA: "Lista de espera",
  // Canales que traia el prescriptor de CoverManager (2022-2026). Google e
  // Instagram van separados en pago y organico a proposito: es lo que permite
  // ver que trae la publicidad frente a lo que llega solo.
  GOOGLE_ORGANICO: "Google orgánico",
  GOOGLE_ADS: "Google Ads",
  INSTAGRAM_ORGANICO: "Instagram orgánico",
  MARKETING: "Marketing",
  CAMPANA: "Campaña",
  CALIDAD: "Calidad",
  FIDELIZACION: "Fidelización",
  EXPERIENCIA: "Experiencia",
  TIKTOK: "TikTok",
  SMS: "SMS",
  [ORIGEN_SIN_DATO]: "Sin origen",
};

/**
 * Paleta de los orígenes conocidos: rojo para tráfico físico, verde Google,
 * teal motor web propio, colores de marca en redes, gris para el dato que falta.
 */
const COLORS: Record<string, string> = {
  WEB: "#0d9488",       // teal-600 — motor web propio
  GOOGLE: "#22c55e",    // green-500 — Reserve with Google
  TELEFONO: "#f59e0b",  // amber-500 — llamada que apunta el personal
  WALKIN: "#ef4444",    // red-500 — cliente andante
  INSTAGRAM: "#ec4899", // pink-500
  FACEBOOK: "#6366f1",  // indigo-500
  WHATSAPP: "#16a34a",  // green-600
  EMAIL: "#0ea5e9",     // sky-500
  AGORA: "#a855f7",     // purple-500
  LISTA_ESPERA: "#7c3aed", // violet-600 — entró desde la lista de espera
  // Mismo tono de familia que su canal de pago, un paso mas claro, para que
  // "Google" y "Google organico" se lean juntos de un vistazo en la grafica.
  GOOGLE_ORGANICO: "#86efac",   // green-300
  GOOGLE_ADS: "#15803d",        // green-700
  INSTAGRAM_ORGANICO: "#f9a8d4",// pink-300
  MARKETING: "#f43f5e",         // rose-500
  CAMPANA: "#fb923c",           // orange-400
  CALIDAD: "#64748b",           // slate-500
  FIDELIZACION: "#14b8a6",      // teal-500
  EXPERIENCIA: "#8b5cf6",       // violet-500
  TIKTOK: "#0f172a",            // slate-900 — negro de marca
  SMS: "#38bdf8",               // sky-400
  [ORIGEN_SIN_DATO]: "#94a3b8", // slate-400
};

/**
 * Colores para orígenes no catalogados (campañas nuevas, canales futuros).
 * Se elige por hash del nombre, así que la misma campaña sale siempre del
 * mismo color aunque cambie el año, el filtro o el orden de la consulta.
 * Ninguno choca de cerca con los fijos de arriba.
 */
const PALETA_EXTRA = [
  "#0891b2", // cyan-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#65a30d", // lime-600
  "#e11d48", // rose-600
  "#2563eb", // blue-600
  "#c2410c", // orange-700
  "#059669", // emerald-600
  "#9333ea", // purple-600
];

/**
 * Orígenes que se ofrecen al dar de alta una reserva desde sala.
 *
 * NO es el catálogo cerrado de la columna (que es abierto: por ahí entran las
 * palabras clave de campaña). Es solo lo que tiene sentido elegir a mano.
 * Quedan fuera `WALKIN` (no se elige: lo fija el propio tipo de reserva) y
 * `WEB`/`GOOGLE` (los pone el motor de reservas al entrar solas).
 *
 * Hoy solo hay uno: el alta desde sala es la reserva que coge el personal por
 * TELÉFONO. WhatsApp, Instagram, Facebook y email no son canales de reserva
 * todavía —no hay por dónde entren—, así que ofrecerlos solo llevaría a
 * marcar un origen que no ha ocurrido y a ensuciar la analítica de canales.
 * Cuando alguno se abra de verdad, se añade aquí y el campo vuelve a ser un
 * desplegable solo.
 *
 * El primero es el que sale marcado por defecto.
 */
export const ORIGENES_ALTA_SALA: readonly string[] = ["TELEFONO"];

/**
 * Normaliza cualquier string crudo de `reservas.origen` a su clave estable.
 * - null / "" → `SIN_DATO` (reserva antigua sin canal registrado)
 * - Aplica los alias conocidos.
 * - Cualquier otro valor conserva su propia clave en mayúsculas.
 */
export function normalizarOrigen(raw: string | null | undefined): OrigenBucket {
  if (!raw) return ORIGEN_SIN_DATO;
  const up = raw.trim().toUpperCase();
  if (up.length === 0) return ORIGEN_SIN_DATO;
  return ALIAS[up] ?? up;
}

/** Etiqueta legible de una clave ya normalizada. */
export function labelOrigen(clave: OrigenBucket): string {
  const conocido = LABELS[clave];
  if (conocido) return conocido;
  // Campaña o canal sin catalogar: "BLACK_FRIDAY" → "Black friday".
  const limpio = clave.replace(/_/g, " ").toLowerCase();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Color estable de una clave ya normalizada. */
export function colorOrigen(clave: OrigenBucket): string {
  const conocido = COLORS[clave];
  if (conocido) return conocido;
  let hash = 0;
  for (let i = 0; i < clave.length; i++) {
    hash = (hash * 31 + clave.charCodeAt(i)) >>> 0;
  }
  return PALETA_EXTRA[hash % PALETA_EXTRA.length];
}
