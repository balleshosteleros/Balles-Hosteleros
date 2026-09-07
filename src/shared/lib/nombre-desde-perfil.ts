/**
 * Saca un nombre utilizable del nombre de perfil de WhatsApp.
 *
 * Cuando un cliente escribe al restaurante, lo único que llega es como se haya
 * puesto él en su perfil. Y la gente se pone de todo: emojis alrededor del
 * nombre ("🌺 Zaira 🌺"), letras de fantasía ("𝒜𝓃𝒹𝓇𝑒𝒶 𝒫𝒶𝑒𝓏", "ℙ𝕒𝕓𝕝𝕠"),
 * el nombre deletreado ("C L a u d i a"), adornos ("══ஜ ★ 𝕀𝕟𝕞𝕒 ★ ஜ══") o
 * directamente nada aprovechable ("❤️", ".", "😎🙃🤓").
 *
 * Debajo de casi todo eso hay un nombre real, y tirarlo es perder un dato que
 * el cliente sí nos dio. Esta función lo intenta y dice claramente si lo ha
 * conseguido, para que quien la llama pueda dejar constancia de que ese nombre
 * NO lo escribió una persona del equipo: se dedujo del perfil.
 *
 * Lo que NO hace: adivinar. Si debajo no hay un nombre —un corazón, una letra
 * suelta, un apodo—, devuelve `null`. La ficha se queda sin nombre y el cliente
 * se identifica por su teléfono, que es el dato bueno. Inventarle un nombre
 * sería peor que no tenerlo: acabaría en un correo dirigido a nadie.
 *
 * El original se guarda aparte, en `clientes_sala.nombre_whatsapp`, porque es
 * como aparece esa persona en el móvil del restaurante y es la única forma de
 * casar un chat con una ficha.
 */

import { normalizarNombre } from "@/shared/lib/normalizar-nombre";
import { validarNombre } from "@/shared/lib/validar-contacto";

export interface NombreDesdePerfil {
  /** Nombre ya usable, o `null` si debajo no había ninguno. */
  nombre: string | null;
  /** El texto del perfil, tal cual llegó. Se guarda siempre. */
  original: string;
  /**
   * `true` cuando el nombre hubo que descifrarlo (se le quitaron emojis, se
   * pasaron letras de fantasía a normales, se juntó un nombre deletreado).
   *
   * Es lo que distingue "Marta" escrito por el personal de "Marta" sacado de
   * "🌸 𝓜𝓪𝓻𝓽𝓪 🌸". Quien importa contactos usa esta bandera para anotarlo en
   * la actividad del cliente.
   */
  detectado: boolean;
}

/**
 * Todo lo que no es una letra latina, un espacio o un signo que sí aparece en
 * nombres de verdad (apóstrofe, guion, punto de una inicial).
 *
 * Se va por el alfabeto y no por una lista de emojis a propósito: la lista de
 * emojis crece cada año y siempre se queda corta, mientras que "un nombre se
 * escribe con letras" no cambia. Eso se lleva por delante emojis, banderas,
 * modificadores de tono de piel, adornos (★, ══) y también los alfabetos no
 * latinos, que aquí siempre venían de decoración (ஜ), nunca del nombre.
 */
const NO_ES_NOMBRE = /[^\p{Script=Latin}\p{M}\s'´`.\-]/gu;

/**
 * Caracteres invisibles que el filtro de arriba deja pasar por ser "marcas":
 * el selector de variación que convierte un símbolo en emoji (U+FE0F) y el
 * unificador de emojis compuestos (U+200D). Sin quitarlos, "🏔️ Itzi 🏔️" se
 * queda en "️ Itzi ️" — con dos caracteres fantasma pegados al nombre que no
 * se ven pero rompen la búsqueda y la ordenación.
 */
const INVISIBLES = /[\u{FE00}-\u{FE0F}\u{200B}-\u{200D}\u{20E3}\u{FFFD}]/gu;

/**
 * Nombre deletreado: "C L a u d i a", "T A m a r a".
 *
 * Solo se junta cuando TODAS las piezas son de una sola letra y hay al menos
 * tres. Con dos se rompería "M Castro" o "J María", donde la letra suelta es
 * una inicial de verdad y el nombre está en la otra pieza.
 */
function juntarDeletreado(texto: string): string {
  const piezas = texto.split(" ").filter(Boolean);
  if (piezas.length < 3) return texto;
  if (!piezas.every((p) => p.replace(/[^\p{L}]/gu, "").length === 1)) return texto;
  return piezas.join("");
}

/**
 * @param crudo El nombre tal y como viene del perfil. Puede ser nombre y
 *   apellidos ya juntos: se procesa igual, porque los adornos aparecen en
 *   cualquiera de los dos.
 */
export function nombreDesdePerfil(
  crudo: string | null | undefined,
): NombreDesdePerfil {
  const original = (crudo ?? "").trim();
  if (!original) return { nombre: null, original, detectado: false };

  // NFKC convierte las letras de fantasía a letras normales: las matemáticas
  // ("ℙ𝕒𝕓𝕝𝕠" → "Pablo"), las de ancho completo ("ＭＡＲＩＡ" → "MARIA") y las
  // versalitas. Son caracteres Unicode distintos, no una fuente: sin esto
  // "𝕁𝕒𝕧𝕚𝕖𝕣" no casa con "Javier" ni en la búsqueda ni en el validador.
  let texto = original.normalize("NFKC").replace(INVISIBLES, "");
  texto = texto.replace(NO_ES_NOMBRE, " ").replace(/\s+/g, " ").trim();
  texto = juntarDeletreado(texto);

  // Un punto o un guion suelto, o al principio y al final, es adorno: "~Javier~"
  // ya perdió las virgulillas arriba, pero "- Noe -" deja los guiones.
  texto = texto.replace(/^[\s'´`.\-]+|[\s'´`.\-]+$/g, "").trim();

  if (!validarNombre(texto).ok) {
    return { nombre: null, original, detectado: false };
  }

  const nombre = normalizarNombre(texto);
  return { nombre, original, detectado: nombre !== normalizarNombre(original) };
}
