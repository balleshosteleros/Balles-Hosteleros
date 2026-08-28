/**
 * PRP-076 · Fase 1 — Retoque de TEXTOS por conversación.
 *
 * Regla de oro: la IA NO devuelve bloques. Devuelve una lista de cambios
 * puntuales (bloque + campo + texto nuevo) que aplicamos nosotros sobre los
 * bloques reales. Así la IA no puede inventarse estructura, borrar bloques ni
 * romper el esquema: como mucho escribe un texto donde no tocaba, y eso se
 * deshace.
 */
import type { Bloque } from "../types";

/**
 * Campos de texto editables por chat, por tipo de bloque.
 *
 * ESTA LISTA ES EL LÍMITE DE LO QUE LA IA PUEDE TOCAR. Lo que no esté aquí no
 * se cambia por conversación, aunque el usuario lo pida. Quedan fuera a
 * propósito:
 *
 * - URLs y enlaces (`href`, `url`): un enlace mal escrito rompe la navegación
 *   o manda al visitante fuera de la web, y eso no se ve hasta que alguien lo
 *   pulsa. Se cambian en el editor.
 * - Imágenes: la IA no sube fotos; se suben desde el editor o se adjuntan.
 * - Datos verificables (dirección, coordenadas, valoraciones, seguidores,
 *   premios, testimonios): son hechos, no redacción. Si la IA los reescribe,
 *   publica algo falso. Los testimonios además son de personas reales.
 * - Precios y carta: salen del módulo de Cocina, no se escriben aquí.
 */
const CAMPOS_TEXTO: Record<string, string[]> = {
  hero: ["titulo", "subtitulo", "cta.label"],
  texto_libre: ["html_seguro"],
  cta: ["titulo", "texto", "boton.label"],
  galeria: [],
  menu: ["titulo"],
  testimonios: ["titulo", "subtitulo"],
  formulario: ["titulo", "texto_boton"],
  mapa: [],
  footer: [],
  video: ["titulo"],
  reservas: ["titulo", "subtitulo"],
  collage_carta: ["titulo", "frase", "cta_label"],
  // "parrafos.0", "parrafos.1"… El relato SÍ es redacción, y es justo lo que
  // el dueño querrá pulir hablando. Se permite por índice para que la IA
  // reescriba un párrafo concreto sin poder añadir ni quitar párrafos.
  historia: ["titulo", "parrafos.0", "parrafos.1", "parrafos.2", "parrafos.3"],
  premios: ["titulo", "frase"],
  instagram: ["titulo", "frase", "cta_label"],
  redes: ["titulo", "descripcion"],
  bolsa_inspectores: ["titulo", "descripcion", "cta_label"],
};

export interface CambioTexto {
  bloqueId: string;
  campo: string;
  valor: string;
}

export interface ResultadoAplicar {
  bloques: Bloque[];
  aplicados: CambioTexto[];
  descartados: Array<CambioTexto & { motivo: string }>;
}

/** Lee un campo anidado con notación "a.b" sobre los datos de un bloque. */
function leerCampo(datos: Record<string, unknown>, campo: string): unknown {
  return campo
    .split(".")
    .reduce<unknown>(
      (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
      datos,
    );
}

/** Devuelve una copia de `datos` con `campo` puesto a `valor` (inmutable). */
function escribirCampo(
  datos: Record<string, unknown>,
  campo: string,
  valor: string,
): Record<string, unknown> {
  const partes = campo.split(".");
  const copia = { ...datos };
  let cursor: Record<string, unknown> = copia;
  for (let i = 0; i < partes.length - 1; i++) {
    const k = partes[i];
    const actual = cursor[k];
    // Un array se copia como array: con {...} se convertiría en un objeto
    // {"0": "…"} y el bloque dejaría de pintar (parrafos.0 del bloque historia).
    const siguiente = Array.isArray(actual)
      ? [...actual]
      : actual && typeof actual === "object"
        ? { ...(actual as Record<string, unknown>) }
        : {};
    cursor[k] = siguiente;
    cursor = siguiente as Record<string, unknown>;
  }
  cursor[partes[partes.length - 1]] = valor;
  return copia;
}

/**
 * Resumen de los textos actuales que se le manda a la IA como contexto.
 * Solo textos: ni urls, ni ids de imagen, ni nada que la IA pueda estropear.
 */
export function resumirTextos(bloques: Bloque[]): Array<{
  bloqueId: string;
  tipo: string;
  orden: number;
  textos: Record<string, string>;
}> {
  return bloques.map((b) => {
    const campos = CAMPOS_TEXTO[b.tipo] ?? [];
    const datos = (b.datos ?? {}) as unknown as Record<string, unknown>;
    const textos: Record<string, string> = {};
    for (const campo of campos) {
      const v = leerCampo(datos, campo);
      if (typeof v === "string" && v.trim()) textos[campo] = v;
    }
    return { bloqueId: b.id, tipo: b.tipo, orden: b.orden, textos };
  });
}

const MAX_LONGITUD = 5000;

/**
 * Aplica los cambios que propone la IA. Descarta silenciosamente (pero
 * informando) todo lo que no cuadre: bloque inexistente, campo no editable,
 * valor vacío o desproporcionado. Nunca lanza.
 */
export function aplicarCambios(
  bloques: Bloque[],
  cambios: CambioTexto[],
): ResultadoAplicar {
  const aplicados: CambioTexto[] = [];
  const descartados: Array<CambioTexto & { motivo: string }> = [];
  const porId = new Map(bloques.map((b) => [b.id, b]));

  const nuevos = [...bloques];

  for (const c of cambios) {
    const bloque = porId.get(c.bloqueId);
    if (!bloque) {
      descartados.push({ ...c, motivo: "El bloque no existe" });
      continue;
    }
    const permitidos = CAMPOS_TEXTO[bloque.tipo] ?? [];
    if (!permitidos.includes(c.campo)) {
      descartados.push({ ...c, motivo: "Ese texto no se puede cambiar por chat" });
      continue;
    }
    if (typeof c.valor !== "string" || !c.valor.trim()) {
      descartados.push({ ...c, motivo: "Texto vacío" });
      continue;
    }
    if (c.valor.length > MAX_LONGITUD) {
      descartados.push({ ...c, motivo: "Texto demasiado largo" });
      continue;
    }
    // Un campo indexado ("parrafos.2") solo vale si ese elemento YA existe:
    // si no, la IA estaría añadiendo contenido nuevo, no reescribiendo.
    if (
      leerCampo((bloque.datos ?? {}) as unknown as Record<string, unknown>, c.campo) === undefined
    ) {
      descartados.push({ ...c, motivo: "Ese texto no existe en la web" });
      continue;
    }

    const idx = nuevos.findIndex((b) => b.id === c.bloqueId);
    const actual = nuevos[idx];
    nuevos[idx] = {
      ...actual,
      datos: escribirCampo(
        (actual.datos ?? {}) as unknown as Record<string, unknown>,
        c.campo,
        c.valor,
      ),
    } as unknown as Bloque;
    aplicados.push(c);
  }

  return { bloques: nuevos, aplicados, descartados };
}

/** Etiqueta legible de un campo, para contárselo al usuario sin jerga. */
export function etiquetaCampo(campo: string): string {
  const mapa: Record<string, string> = {
    titulo: "título",
    subtitulo: "subtítulo",
    texto: "texto",
    frase: "frase",
    descripcion: "descripción",
    cta_label: "botón",
    html_seguro: "contenido",
    "cta.label": "botón",
    "boton.label": "botón",
    texto_boton: "botón",
    direccion_texto: "dirección",
  };
  return mapa[campo] ?? campo;
}
