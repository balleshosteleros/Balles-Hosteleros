/**
 * Color de fondo de las zonas de sala según el tema activo.
 *
 * Vive aquí, fuera de cualquier vista, porque lo usan a la vez el plano de
 * Reservas, sus etiquetas de zona, el listado agrupado y el salón de la
 * reasignación manual de mesas. Es el ÚNICO punto donde se decide ese color:
 * si cada pantalla lo calculara por su cuenta, la misma zona se vería de un
 * color distinto según desde dónde se mirara.
 */

/**
 * Mezcla un hex con blanco para suavizar los pasteles de zona.
 * ratio 0 = original, 1 = blanco. Tolerante a entradas mal formateadas.
 */
export function lightenHex(hex: string, ratio: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  const out = (mix(r) << 16) | (mix(g) << 8) | mix(b);
  return `#${out.toString(16).padStart(6, "0")}`;
}

/**
 * Versión oscura de un pastel de zona.
 *
 * No se puede mezclar el hex con azul marino en RGB: los amarillos y naranjas
 * salían marrones. Se trabaja en HSL para CONSERVAR el matiz de la zona (lo que
 * la identifica de un vistazo) y bajar solo luminosidad y saturación, de modo
 * que el amarillo siga leyéndose como amarillo, pero apagado.
 */
export function zonaOscura(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d !== 0) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  // Matiz intacto: es lo que identifica la zona de un vistazo. La luminosidad
  // sube lo justo para que el NOMBRE Y LA CAPACIDAD de la mesa, que van en
  // negro, se lean sobre el fondo. Con luminosidad 26 el texto oscuro quedaba
  // ilegible y el claro se comía el matiz de la zona.
  const satOut = Math.min(sat, 0.45) * 100;
  const lumOut = 62;
  return `hsl(${h.toFixed(0)} ${satOut.toFixed(0)}% ${lumOut}%)`;
}

/** Cuánto aclaramos los pasteles de zona (tirando a blanco, sutil). */
export const ZONA_LIGHTEN = 0.35;

/**
 * Color de fondo de una zona según el tema activo: aclarado hacia blanco en
 * claro, mezclado con azul marino en oscuro.
 */
export function colorZona(hex: string, esOscuro: boolean): string {
  return esOscuro ? zonaOscura(hex) : lightenHex(hex, ZONA_LIGHTEN);
}

/* ---------------------------------------------------------------------------
   Fondo de las MESAS LIBRES
   ---------------------------------------------------------------------------
   Las mesas ya no se pintan del pastel de su zona: TODAS comparten el azul
   oscuro de la marca. El color de zona sigue vivo, pero solo en las ETIQUETAS
   de zona del plano ("Altas", "VIP", "Barra"…), que es donde de verdad hace
   falta para saber dónde está uno; en las mesas competía con el código de
   color de los ESTADOS, que es lo único que importa mirar durante el servicio.

   Una mesa con reserva NUNCA pasa por aquí: manda su estado (OCUPADA verde
   oscuro, RESERVADA verde claro, TERMINADA rosa, BLOQUEADA negro).
   --------------------------------------------------------------------------- */

/** Matiz del azul marino del software (el mismo 220 del tema oscuro de sala). */
const MESA_HUE = 220;

/**
 * Degradado azul oscuro de una mesa libre.
 *
 * No es un color plano: cada mesa recibe una inclinación y una luminosidad
 * ligeramente distintas, derivadas de su propio identificador. Así el plano
 * respira —no parece una plancha de un solo azul— sin que ninguna mesa llame
 * más la atención que otra, que es justo lo que tiene que hacer una mesa libre.
 */
export function fondoMesaLibre(semilla: string, esOscuro: boolean): string {
  // Hash estable del identificador: la misma mesa se ve siempre igual entre
  // recargas. Con Math.random() el plano parpadearía en cada render.
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0;
  const abs = Math.abs(h);
  // Variación deliberadamente CORTA: pasado este margen las mesas dejan de
  // leerse como un conjunto y parecen estados distintos.
  const angulo = 120 + (abs % 7) * 15; // 120º–210º
  const deriva = (abs >> 3) % 5; // 0–4 puntos de luminosidad
  const satura = 30 + ((abs >> 6) % 8); // 30%–37%

  // En tema oscuro el azul arranca más bajo para separarse del lienzo marino;
  // en claro sube lo justo para que el texto en blanco siga contrastando.
  const luzAlta = (esOscuro ? 26 : 34) + deriva;
  const luzBaja = (esOscuro ? 15 : 22) + deriva;

  return (
    `linear-gradient(${angulo}deg, ` +
    `hsl(${MESA_HUE} ${satura}% ${luzAlta}%), ` +
    `hsl(${MESA_HUE + 6} ${satura + 4}% ${luzBaja}%))`
  );
}
