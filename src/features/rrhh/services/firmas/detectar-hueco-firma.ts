/**
 * Detección automática del hueco de firma en un PDF.
 *
 * Problema que resuelve: cuando la empresa sube un PDF a mano, nadie sabía en
 * qué punto del papel debía ir el trazo, así que se estampaba en el centro
 * geométrico de la página 1 y tapaba el documento. Aquí se localiza el sitio
 * real y se mide el hueco disponible, sin que el empleado elija nada.
 *
 * Estrategia en dos pasos:
 *   1. TEXTO (rápido, gratis, determinista) — se buscan los anclajes habituales
 *      de un documento laboral ("Firma del trabajador", "Fdo.", "Conforme"…) con
 *      sus coordenadas reales, y se mide el blanco que queda debajo.
 *   2. GEMINI (respaldo) — solo si el PDF no tiene capa de texto (escaneado) o
 *      ningún anclaje reconocible. Se le manda el PDF y devuelve la caja en
 *      porcentajes.
 *
 * Si ambos fallan se devuelve null y el llamador aplica su propio suelo; nunca
 * se lanza excepción, porque un fallo de detección no puede tumbar un envío.
 */
import type { Schema } from "@google/generative-ai";
import { geminiJSON } from "@/lib/ia/gemini";

/**
 * Caja donde va la firma, en porcentajes de la página con origen ARRIBA-izquierda
 * (mismo convenio que `posicion_firma_default` y que el estampador de `pdf.ts`).
 */
export type HuecoFirma = {
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
  /** Alto útil del hueco. Permite escalar el trazo al espacio real disponible. */
  altoPct: number;
  origen: "texto" | "ia" | "fallback";
};

/**
 * Anclajes ordenados de más a menos específico. El primero que aparezca en el
 * documento manda: "Firma del trabajador" es una señal mucho más fiable de
 * dónde firma el empleado que un "Fdo." suelto, que también usa la empresa.
 */
const ANCLAJES: Array<{ re: RegExp; peso: number }> = [
  { re: /firma\s+del\s+(trabajador|empleado|candidato)/i, peso: 100 },
  { re: /firma\s+(del\s+)?interesad[oa]/i, peso: 95 },
  // "Firmado:" es la etiqueta que usan los documentos generados por el sistema.
  { re: /^firmado\s*:?\s*$/i, peso: 90 },
  { re: /^firma\s*:?\s*$/i, peso: 85 },
  { re: /el\s+(trabajador|empleado)\s*[,:]?\s*$/i, peso: 80 },
  { re: /recib[íi]\s+conforme/i, peso: 75 },
  { re: /\bconforme\b/i, peso: 60 },
  { re: /\bfdo\.?\b/i, peso: 55 },
  { re: /\bfirma\b/i, peso: 40 },
];

/** Proporción de página que ocupa la caja de firma por defecto. */
const ANCHO_PCT_DEFECTO = 0.32;
/** Alto máximo razonable para un trazo manuscrito, en % de página. */
const ALTO_PCT_MAX = 0.09;
/** Alto mínimo por debajo del cual la firma sería ilegible. */
const ALTO_PCT_MIN = 0.03;

type ItemTexto = {
  texto: string;
  /** Coordenadas en puntos PDF, origen ABAJO-izquierda (convenio de pdf.js). */
  x: number;
  y: number;
  alto: number;
};

/**
 * Extrae el texto con coordenadas usando pdf.js en su build `legacy`, que es la
 * que funciona en Node sin DOM. La importación es dinámica para no cargar el
 * motor en peticiones que no lo necesitan.
 */
async function extraerItems(
  pdf: Buffer,
): Promise<{ paginas: Array<{ items: ItemTexto[]; ancho: number; alto: number }> } | null> {
  try {
    // En Node, pdf.js desactiva el worker y resuelve su `workerSrc` por sí solo;
    // sobrescribirlo aquí rompe la carga ("Setting up fake worker failed").
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(pdf),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    const paginas: Array<{ items: ItemTexto[]; ancho: number; alto: number }> = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: ItemTexto[] = [];
      for (const it of content.items) {
        if (!("str" in it) || typeof it.str !== "string") continue;
        const texto = it.str.trim();
        if (!texto) continue;
        // transform = [a, b, c, d, e, f]; (e, f) es la posición, d el alto de línea.
        const t = it.transform as number[];
        items.push({
          texto,
          x: t[4] ?? 0,
          y: t[5] ?? 0,
          alto: Math.abs(t[3] ?? 10) || 10,
        });
      }
      paginas.push({ items, ancho: viewport.width, alto: viewport.height });
      page.cleanup();
    }
    await doc.destroy();
    return { paginas };
  } catch (err) {
    console.error("[firmas] extraerItems:", err);
    return null;
  }
}

/**
 * Busca el anclaje de firma y mide el blanco que queda debajo.
 *
 * Se recorre de la última página a la primera: en un documento laboral la firma
 * está al final, y un "Fdo." de la cabecera no debe ganarle al del pie.
 */
function detectarPorTexto(
  paginas: Array<{ items: ItemTexto[]; ancho: number; alto: number }>,
): HuecoFirma | null {
  for (let idx = paginas.length - 1; idx >= 0; idx--) {
    const { items, ancho, alto } = paginas[idx];
    if (items.length === 0) continue;

    let mejor: { item: ItemTexto; peso: number } | null = null;
    for (const item of items) {
      for (const { re, peso } of ANCLAJES) {
        if (!re.test(item.texto)) continue;
        // A igual peso gana el que esté más abajo (y menor = más cerca del pie).
        if (!mejor || peso > mejor.peso || (peso === mejor.peso && item.y < mejor.item.y)) {
          mejor = { item, peso };
        }
        break;
      }
    }
    if (!mejor) continue;

    const ancla = mejor.item;
    // Techo del hueco: justo debajo de la línea del anclaje.
    const techoY = ancla.y - ancla.alto * 0.4;

    // Suelo: lo primero que haya dibujado por debajo, en la misma columna. Si no
    // hay nada, el margen inferior de la página. Esto es lo que impide que la
    // firma invada el nombre y el DNI que suelen ir bajo el hueco.
    const columnaIzq = ancla.x - ancho * 0.05;
    const columnaDer = ancla.x + ancho * ANCHO_PCT_DEFECTO + ancho * 0.05;
    let sueloY = alto * 0.06;
    for (const it of items) {
      if (it === ancla) continue;
      if (it.y >= techoY) continue;
      const dentroColumna = it.x + 1 >= columnaIzq && it.x <= columnaDer;
      if (!dentroColumna) continue;
      // El borde superior del texto de abajo marca el límite del hueco.
      const bordeSuperior = it.y + it.alto;
      if (bordeSuperior > sueloY) sueloY = bordeSuperior;
    }

    const huecoPt = techoY - sueloY;
    if (huecoPt < alto * ALTO_PCT_MIN) continue; // hueco irreal, seguimos buscando

    const altoPct = Math.min(huecoPt / alto, ALTO_PCT_MAX);
    return {
      pagina: idx + 1,
      xPct: Math.max(0, ancla.x / ancho),
      // yPct con origen ARRIBA-izquierda, que es lo que espera el estampador.
      yPct: Math.max(0, Math.min(1, (alto - techoY) / alto)),
      anchoPct: Math.min(ANCHO_PCT_DEFECTO, 1 - ancla.x / ancho),
      altoPct,
      origen: "texto",
    };
  }
  return null;
}

const ESQUEMA_IA: Schema = {
  type: "object",
  properties: {
    encontrado: { type: "boolean" },
    pagina: { type: "integer" },
    xPct: { type: "number" },
    yPct: { type: "number" },
    anchoPct: { type: "number" },
    altoPct: { type: "number" },
  },
  required: ["encontrado", "pagina", "xPct", "yPct", "anchoPct", "altoPct"],
} as unknown as Schema;

/**
 * Respaldo con Gemini para PDFs escaneados o sin anclaje textual. Gemini lee el
 * PDF de forma nativa, así que no hace falta rasterizar la página.
 */
async function detectarConIA(pdf: Buffer): Promise<HuecoFirma | null> {
  try {
    const { data } = await geminiJSON<{
      encontrado: boolean;
      pagina: number;
      xPct: number;
      yPct: number;
      anchoPct: number;
      altoPct: number;
    }>(
      [
        "Analiza este documento laboral y localiza el ESPACIO EN BLANCO donde debe",
        "estamparse la firma manuscrita DEL TRABAJADOR (no la de la empresa).",
        "",
        "Busca etiquetas como 'Firma del trabajador', 'Fdo.', 'El trabajador',",
        "'Recibí conforme'. La firma va en el blanco JUSTO DEBAJO de esa etiqueta.",
        "",
        "Devuelve la caja en porcentajes de 0 a 1 sobre el tamaño de la página, con",
        "ORIGEN ARRIBA-IZQUIERDA (yPct=0 es el borde superior del papel).",
        "- xPct/yPct: esquina superior izquierda de la caja.",
        "- anchoPct: entre 0.2 y 0.4 normalmente.",
        "- altoPct: alto del blanco disponible, entre 0.03 y 0.09.",
        "",
        "La caja NO debe solaparse con ningún texto impreso. Si hay varias firmas,",
        "elige la del trabajador/empleado. Si no localizas ninguna, encontrado=false.",
      ].join("\n"),
      {
        responseSchema: ESQUEMA_IA,
        temperature: 0.1,
        attachments: [{ mimeType: "application/pdf", base64: pdf.toString("base64") }],
      },
    );

    if (!data?.encontrado) return null;
    const pagina = Math.max(1, Math.round(data.pagina || 1));
    const xPct = clamp(data.xPct, 0, 0.9);
    const yPct = clamp(data.yPct, 0, 0.97);
    return {
      pagina,
      xPct,
      yPct,
      anchoPct: clamp(data.anchoPct || ANCHO_PCT_DEFECTO, 0.15, 1 - xPct),
      altoPct: clamp(data.altoPct || 0.06, ALTO_PCT_MIN, ALTO_PCT_MAX),
      origen: "ia",
    };
  } catch (err) {
    // Sin key, sin cuota o error de red: no es motivo para bloquear el envío.
    console.error("[firmas] detectarConIA:", err);
    return null;
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Punto de entrada: dónde va la firma en este PDF.
 *
 * Devuelve null solo si ni el texto ni la IA logran ubicarla; en ese caso el
 * llamador debe usar `huecoFirmaPorDefecto()`, nunca el centro de la página.
 */
export async function detectarHuecoFirma(pdf: Buffer): Promise<HuecoFirma | null> {
  const extraido = await extraerItems(pdf);
  if (extraido) {
    const porTexto = detectarPorTexto(extraido.paginas);
    if (porTexto) return porTexto;
  }
  return detectarConIA(pdf);
}

/** Nº de páginas del PDF. Sirve para llevar el suelo a la última página. */
export async function contarPaginas(pdf: Buffer): Promise<number> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(new Uint8Array(pdf), { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return 1;
  }
}

/**
 * Suelo cuando no se detecta nada: pie de la ÚLTIMA página, que es donde se
 * firma por convención. Nunca el centro del documento, que es lo que tapaba el
 * texto.
 */
export function huecoFirmaPorDefecto(numPaginas: number): HuecoFirma {
  return {
    pagina: Math.max(1, numPaginas),
    xPct: 0.1,
    yPct: 0.82,
    anchoPct: ANCHO_PCT_DEFECTO,
    altoPct: 0.06,
    origen: "fallback",
  };
}
