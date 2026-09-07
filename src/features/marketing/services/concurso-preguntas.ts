/**
 * Genera las cinco preguntas del concurso del mes a partir de la carta real del
 * restaurante.
 *
 * ── Por qué se generan y no se escriben a mano ─────────────────────────────
 * Dos motivos. Uno: la carta cambia, y una pregunta escrita en enero sobre un
 * plato que se quitó en marzo convierte el concurso en una trampa. Se generan el
 * día que se abre la edición, así que siempre hablan de la carta que hay ese día.
 * Dos: son doce meses por dos restaurantes; a mano, nadie las mantiene.
 *
 * ── Por qué se responden mirando la carta ──────────────────────────────────
 * La gracia del concurso es que juegue todo el mundo, no solo el cliente
 * veterano. Preguntar "¿cómo se llama nuestro jefe de cocina?" premia a quien ya
 * viene cada semana, que es justo a quien no hace falta convencer. Preguntando
 * por platos, precios y apartados de la carta, cualquiera puede jugar abriendo
 * la carta digital — y de paso la abre, que es medio objetivo de la campaña.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

export interface PreguntaGenerada {
  orden: number;
  enunciado: string;
  opciones: string[];
  /** Índice de la opción correcta dentro de `opciones`. */
  respuesta: number;
}

interface ItemCarta {
  nombre: string;
  precio: number | null;
  categoria: string | null;
}

/**
 * Apartados de la carta que no dan buenas preguntas.
 *
 * La carta digital lleva también la bodega, los cafés, las shishas y los vapers,
 * y de ahí salían preguntas como "¿en qué apartado está Dyc 8?" o "¿cuánto
 * cuesta el Cotton candy Ice 2%?". Nadie ha ido nunca a un restaurante a
 * fijarse en eso, y una pregunta así no invita a mirar la carta: aburre.
 */
const APARTADOS_QUE_NO_PREGUNTAMOS =
  /whisk|ginebr|ron\b|vodka|licor|destilad|refresc|caf[eé]|cervez|vino|champ[aá]|cava|shisha|vaper|copa|bodega|agua|infusi|t[eé]\b/i;

/**
 * Fotos que delatan que la ficha no es un plato: la botella del proveedor, la
 * cachimba, el vaper. Mismo criterio que usa la foto del correo.
 */
const FOTOS_QUE_NO_SON_PLATO = /bottle-|shisha-|vaper-/;

/**
 * Platos que no están en ninguna de nuestras cartas y suenan a restaurante
 * normal. Sirven de opción falsa en las preguntas de "¿cuál tenemos?": tienen
 * que ser creíbles, o la pregunta se contesta por descarte sin mirar nada.
 * Antes de usar uno se comprueba que no exista de verdad en la carta.
 */
const PLATOS_QUE_NO_TENEMOS = [
  "Solomillo Wellington",
  "Bacalao al pil-pil",
  "Fabada asturiana",
  "Pulpo a la gallega",
  "Rabo de toro estofado",
  "Lasaña de berenjena",
  "Salmorejo cordobés",
  "Callos a la madrileña",
  "Merluza en salsa verde",
  "Codillo al horno",
  "Tataki de atún rojo",
  "Cochinillo confitado",
];

/** Baraja sin sesgo (Fisher-Yates). */
function barajar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "17.5" → "17,50 €", con la coma decimal de toda la aplicación. */
function euros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/**
 * Coloca la respuesta correcta en una posición al azar entre las falsas y
 * devuelve dónde quedó. Sin esto la correcta saldría siempre la primera.
 */
function mezclarOpciones(correcta: string, falsas: string[]): { opciones: string[]; respuesta: number } {
  const opciones = barajar([correcta, ...falsas]);
  return { opciones, respuesta: opciones.indexOf(correcta) };
}

/** ¿Cuál de estos cuatro está en nuestra carta? */
function preguntaPlatoNuestro(items: ItemCarta[], usados: Set<string>): PreguntaGenerada | null {
  const candidato = items.find((i) => !usados.has(i.nombre));
  if (!candidato) return null;
  const nombresReales = new Set(items.map((i) => i.nombre.toLowerCase()));
  const falsas = PLATOS_QUE_NO_TENEMOS.filter((p) => !nombresReales.has(p.toLowerCase())).slice(0, 3);
  if (falsas.length < 3) return null;
  usados.add(candidato.nombre);
  const { opciones, respuesta } = mezclarOpciones(candidato.nombre, falsas);
  return { orden: 0, enunciado: "¿Cuál de estos está en nuestra carta?", opciones, respuesta };
}

/** El contrario: tres nuestros y un impostor. */
function preguntaPlatoQueNoTenemos(items: ItemCarta[], usados: Set<string>): PreguntaGenerada | null {
  // Uno por apartado: tres platos del mismo apartado hacen que el impostor
  // cante solo por venir de otro sitio.
  const nuestros: ItemCarta[] = [];
  const apartadosVistos = new Set<string>();
  for (const i of items) {
    if (usados.has(i.nombre)) continue;
    const ap = i.categoria ?? "";
    if (apartadosVistos.has(ap)) continue;
    apartadosVistos.add(ap);
    nuestros.push(i);
    if (nuestros.length === 3) break;
  }
  if (nuestros.length < 3) return null;
  const nombresReales = new Set(items.map((i) => i.nombre.toLowerCase()));
  const impostor = PLATOS_QUE_NO_TENEMOS.filter((p) => !nombresReales.has(p.toLowerCase())).at(-1);
  if (!impostor) return null;
  for (const n of nuestros) usados.add(n.nombre);
  const { opciones, respuesta } = mezclarOpciones(
    impostor,
    nuestros.map((i) => i.nombre),
  );
  return { orden: 0, enunciado: "¿Cuál de estos NO lo tenemos?", opciones, respuesta };
}

/**
 * ¿Cuánto cuesta este plato? Las opciones falsas se separan lo justo para que
 * haya que mirarlo: a un euro de distancia sería adivinar, a diez sería regalar.
 */
function preguntaPrecio(items: ItemCarta[], usados: Set<string>): PreguntaGenerada | null {
  const conPrecio = items.filter((i) => i.precio != null && i.precio > 3 && !usados.has(i.nombre));
  if (!conPrecio.length) return null;
  const item = conPrecio[0];
  const p = Number(item.precio);
  const desvios = [-3.5, 2.5, 5];
  const falsas = desvios.map((d) => euros(Math.max(1, Math.round((p + d) * 2) / 2)));
  const correcta = euros(p);
  if (new Set([...falsas, correcta]).size < 4) return null;
  usados.add(item.nombre);
  const { opciones, respuesta } = mezclarOpciones(correcta, falsas);
  return { orden: 0, enunciado: `¿Cuánto cuesta nuestro «${item.nombre}»?`, opciones, respuesta };
}

/** ¿En qué apartado de la carta lo encuentras? */
function preguntaCategoria(
  items: ItemCarta[],
  categorias: string[],
  usados: Set<string>,
): PreguntaGenerada | null {
  const item = items.find((i) => i.categoria && !usados.has(i.nombre));
  if (!item?.categoria) return null;
  const otras = barajar(categorias.filter((c) => c !== item.categoria)).slice(0, 3);
  if (otras.length < 3) return null;
  usados.add(item.nombre);
  const { opciones, respuesta } = mezclarOpciones(item.categoria, otras);
  return {
    orden: 0,
    enunciado: `¿En qué apartado de la carta está «${item.nombre}»?`,
    opciones,
    respuesta,
  };
}

/**
 * Cinco preguntas de la carta de esa empresa. Devuelve menos de cinco solo si la
 * carta es tan corta que no da para más; el llamador decide qué hacer entonces.
 */
export async function generarPreguntasDeLaCarta(
  admin: Admin,
  empresaId: string,
): Promise<PreguntaGenerada[]> {
  const { data } = await admin
    .from("carta_items")
    .select("nombre, precio, visible, oculto, foto_url, carta_categorias(nombre)")
    .eq("empresa_id", empresaId)
    .eq("visible", true);

  const items: ItemCarta[] = barajar(
    (data ?? [])
      .filter((r) => !r.oculto)
      // Con foto y sin ser botella: las fichas que el restaurante se molestó en
      // fotografiar son justo las que el cliente reconoce de haber estado allí.
      .filter((r) => {
        const foto = String(r.foto_url ?? "");
        return foto.startsWith("http") && !FOTOS_QUE_NO_SON_PLATO.test(foto);
      })
      .map((r) => ({
        nombre: String(r.nombre ?? "").trim(),
        precio: r.precio == null ? null : Number(r.precio),
        categoria:
          (r.carta_categorias as { nombre?: string } | null)?.nombre?.trim() ?? null,
      }))
      .filter((i) => i.nombre.length > 2)
      .filter((i) => !APARTADOS_QUE_NO_PREGUNTAMOS.test(i.categoria ?? "")),
  );
  if (items.length < 8) return [];

  const categorias = [...new Set(items.map((i) => i.categoria).filter(Boolean) as string[])];
  const usados = new Set<string>();

  // Cinco preguntas de cuatro clases distintas: si las cinco fueran del mismo
  // molde, el que juega aprende el truco en la segunda y las tres siguientes
  // dejan de medir nada.
  const candidatas = [
    preguntaPlatoNuestro(items, usados),
    preguntaPrecio(items, usados),
    preguntaCategoria(items, categorias, usados),
    preguntaPlatoQueNoTenemos(items, usados),
    preguntaPrecio(items, usados),
  ].filter(Boolean) as PreguntaGenerada[];

  return candidatas.slice(0, 5).map((p, i) => ({ ...p, orden: i + 1 }));
}
