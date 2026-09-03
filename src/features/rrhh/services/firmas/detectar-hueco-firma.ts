/**
 * Detección automática del/de los hueco(s) de firma en un PDF.
 *
 * Problema que resuelve: cuando la empresa sube un PDF a mano, nadie sabía en
 * qué punto del papel debía ir el trazo, así que se estampaba en el centro
 * geométrico de la página 1 y tapaba el documento. Aquí se localizan TODOS los
 * sitios reales (un documento puede pedir firma en varias páginas o varias
 * casillas) y se mide el hueco disponible en cada uno, sin que el empleado
 * elija nada.
 *
 * Estrategia en dos pasos:
 *   1. TEXTO (rápido, gratis, determinista) — se buscan los anclajes habituales
 *      de un documento laboral ("Firma del trabajador", "Fdo.", "Conforme"…) con
 *      sus coordenadas reales, y se mide el blanco que queda debajo. Se
 *      acumulan TODOS los anclajes válidos, no solo el primero.
 *   2. GEMINI (respaldo) — solo si el PDF no tiene capa de texto (escaneado) o
 *      ningún anclaje reconocible. Se le manda el PDF y devuelve la caja en
 *      porcentajes.
 *
 * Si ambos fallan se devuelve una lista vacía y el llamador aplica su propio
 * suelo; nunca se lanza excepción, porque un fallo de detección no puede
 * tumbar un envío.
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

/** Separación mínima (en % de alto de página) para tratar dos anclajes de la
 * misma página como sitios de firma DISTINTOS y no como el mismo detectado
 * dos veces (p. ej. "Firma:" y "Fdo." pegados en la misma línea). */
const SEPARACION_MIN_PCT = 0.04;

/**
 * Mide el hueco en blanco que queda bajo un anclaje concreto, dentro de su
 * columna, sin invadir el texto (nombre, DNI, etc.) que haya debajo.
 */
function medirHueco(
  ancla: ItemTexto,
  items: ItemTexto[],
  ancho: number,
  alto: number,
): { techoY: number; sueloY: number } {
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
  return { techoY, sueloY };
}

/**
 * Busca TODOS los anclajes de firma del documento y mide el blanco que queda
 * debajo de cada uno. Un mismo documento puede pedir firma en varias páginas
 * o varias casillas de la misma página (p. ej. contrato + anexo de RGPD).
 *
 * Se recorre de la última página a la primera: en un documento laboral la
 * firma principal suele estar al final, así que queda primera en la lista
 * (el llamador la usa para calcular altura por defecto de un solo trazo).
 */
function detectarPorTexto(
  paginas: Array<{ items: ItemTexto[]; ancho: number; alto: number }>,
): HuecoFirma[] {
  const huecos: HuecoFirma[] = [];

  for (let idx = paginas.length - 1; idx >= 0; idx--) {
    const { items, ancho, alto } = paginas[idx];
    if (items.length === 0) continue;

    // Candidatos de esta página: cada item que matchee algún anclaje, con su peso.
    const candidatos: Array<{ item: ItemTexto; peso: number }> = [];
    for (const item of items) {
      for (const { re, peso } of ANCLAJES) {
        if (!re.test(item.texto)) continue;
        candidatos.push({ item, peso });
        break;
      }
    }
    if (candidatos.length === 0) continue;

    // Se procesan de mayor a menor peso; a igual peso, el más cercano al pie
    // primero. Cada candidato aceptado "reserva" su franja vertical para que
    // un anclaje de menor peso muy cercano (p. ej. "Firma" dentro de "Firma
    // del trabajador") no genere un segundo hueco duplicado sobre el mismo sitio.
    candidatos.sort((a, b) => b.peso - a.peso || a.item.y - b.item.y);
    const yaCubierto: number[] = [];

    for (const { item: ancla } of candidatos) {
      const yPctAncla = alto > 0 ? ancla.y / alto : 0;
      const duplicado = yaCubierto.some(
        (y) => Math.abs(y - yPctAncla) < SEPARACION_MIN_PCT,
      );
      if (duplicado) continue;

      const { techoY, sueloY } = medirHueco(ancla, items, ancho, alto);
      const huecoPt = techoY - sueloY;
      if (huecoPt < alto * ALTO_PCT_MIN) continue; // hueco irreal, siguiente candidato

      yaCubierto.push(yPctAncla);
      const altoPct = Math.min(huecoPt / alto, ALTO_PCT_MAX);
      huecos.push({
        pagina: idx + 1,
        xPct: Math.max(0, ancla.x / ancho),
        // yPct con origen ARRIBA-izquierda, que es lo que espera el estampador.
        yPct: Math.max(0, Math.min(1, (alto - techoY) / alto)),
        anchoPct: Math.min(ANCHO_PCT_DEFECTO, 1 - ancla.x / ancho),
        altoPct,
        origen: "texto",
      });
    }
  }
  return huecos;
}

const ESQUEMA_IA: Schema = {
  type: "object",
  properties: {
    huecos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pagina: { type: "integer" },
          xPct: { type: "number" },
          yPct: { type: "number" },
          anchoPct: { type: "number" },
          altoPct: { type: "number" },
        },
        required: ["pagina", "xPct", "yPct", "anchoPct", "altoPct"],
      },
    },
  },
  required: ["huecos"],
} as unknown as Schema;

/**
 * Respaldo con Gemini para PDFs escaneados o sin anclaje textual. Gemini lee el
 * PDF de forma nativa, así que no hace falta rasterizar la página. Devuelve
 * TODOS los sitios de firma del trabajador que encuentre, no solo uno.
 */
async function detectarConIA(pdf: Buffer): Promise<HuecoFirma[]> {
  try {
    const { data } = await geminiJSON<{
      huecos: Array<{
        pagina: number;
        xPct: number;
        yPct: number;
        anchoPct: number;
        altoPct: number;
      }>;
    }>(
      [
        "Analiza este documento laboral y localiza TODOS los ESPACIOS EN BLANCO donde",
        "debe estamparse la firma manuscrita DEL TRABAJADOR (no la de la empresa).",
        "Un mismo documento puede pedir firma en varias páginas o varias casillas",
        "(p. ej. el contrato y un anexo de protección de datos): devuélvelas todas.",
        "",
        "Busca etiquetas como 'Firma del trabajador', 'Fdo.', 'El trabajador',",
        "'Recibí conforme'. La firma va en el blanco JUSTO DEBAJO de esa etiqueta.",
        "",
        "Para cada hueco, devuelve la caja en porcentajes de 0 a 1 sobre el tamaño de",
        "esa página, con ORIGEN ARRIBA-IZQUIERDA (yPct=0 es el borde superior del papel).",
        "- xPct/yPct: esquina superior izquierda de la caja.",
        "- anchoPct: entre 0.2 y 0.4 normalmente.",
        "- altoPct: alto del blanco disponible, entre 0.03 y 0.09.",
        "",
        "Cada caja NO debe solaparse con ningún texto impreso (nombre, DNI, fecha…).",
        "Ignora las firmas de la empresa/representante. Si no localizas ninguna,",
        "devuelve huecos como lista vacía.",
      ].join("\n"),
      {
        responseSchema: ESQUEMA_IA,
        temperature: 0.1,
        attachments: [{ mimeType: "application/pdf", base64: pdf.toString("base64") }],
      },
    );

    if (!data?.huecos?.length) return [];
    return data.huecos.map((h) => {
      const xPct = clamp(h.xPct, 0, 0.9);
      return {
        pagina: Math.max(1, Math.round(h.pagina || 1)),
        xPct,
        yPct: clamp(h.yPct, 0, 0.97),
        anchoPct: clamp(h.anchoPct || ANCHO_PCT_DEFECTO, 0.15, 1 - xPct),
        altoPct: clamp(h.altoPct || 0.06, ALTO_PCT_MIN, ALTO_PCT_MAX),
        origen: "ia" as const,
      };
    });
  } catch (err) {
    // Sin key, sin cuota o error de red: no es motivo para bloquear el envío.
    console.error("[firmas] detectarConIA:", err);
    return [];
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Punto de entrada: dónde va la firma (o firmas) en este PDF.
 *
 * Devuelve lista vacía solo si ni el texto ni la IA logran ubicar ningún
 * hueco; en ese caso el llamador debe usar `huecoFirmaPorDefecto()`, nunca el
 * centro de la página.
 */
export async function detectarHuecoFirma(pdf: Buffer): Promise<HuecoFirma[]> {
  const extraido = await extraerItems(pdf);
  if (extraido) {
    const porTexto = detectarPorTexto(extraido.paginas);
    if (porTexto.length > 0) return porTexto;
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
 * Suelo cuando no se detecta ningún anclaje: pie de la ÚLTIMA página, que es
 * donde se firma por convención. Nunca el centro del documento, que es lo que
 * tapaba el texto.
 *
 * Antes esta coordenada fija (yPct=0.82) se usaba a ciegas, y en documentos
 * cuyo bloque de nombre/DNI cae justo ahí, la firma lo tapaba. Ahora, si el
 * PDF tiene capa de texto legible, se comprueba que la caja no invada ningún
 * texto real de la página; si invade, se sube el suelo hasta el hueco en
 * blanco más cercano por encima. Si el PDF no tiene texto (escaneado), se
 * mantiene la coordenada fija sin más remedio.
 */
export async function huecoFirmaPorDefecto(pdf: Buffer, numPaginas: number): Promise<HuecoFirma> {
  const pagina = Math.max(1, numPaginas);
  const base = {
    pagina,
    xPct: 0.1,
    anchoPct: ANCHO_PCT_DEFECTO,
    altoPct: 0.06,
    origen: "fallback" as const,
  };

  const extraido = await extraerItems(pdf);
  const pag = extraido?.paginas[pagina - 1];
  if (!pag || pag.items.length === 0) {
    return { ...base, yPct: 0.82 };
  }

  const { items, ancho, alto } = pag;
  const columnaIzq = base.xPct * ancho - ancho * 0.05;
  const columnaDer = base.xPct * ancho + ancho * ANCHO_PCT_DEFECTO + ancho * 0.05;
  const alturaHuecoPt = base.altoPct * alto;

  // Suelo fijo de partida: 18% desde abajo (yPct=0.82 con origen arriba).
  let techoY = alto * (1 - 0.82);
  let sueloY = techoY - alturaHuecoPt;

  // Si ese hueco de partida invade texto de la columna, se sube por encima del
  // bloque de texto más alto que lo pise, dejando el mismo margen que usa la
  // detección por anclaje.
  const invasores = items.filter((it) => {
    const dentroColumna = it.x + 1 >= columnaIzq && it.x <= columnaDer;
    if (!dentroColumna) return false;
    const itTop = it.y + it.alto;
    // Se solapa si el texto tiene parte entre sueloY y techoY.
    return itTop > sueloY && it.y < techoY;
  });
  if (invasores.length > 0) {
    const bordeSuperiorMasAlto = Math.max(...invasores.map((it) => it.y + it.alto));
    sueloY = bordeSuperiorMasAlto;
    techoY = sueloY + alturaHuecoPt;
  }

  const yPct = Math.max(0, Math.min(1, (alto - techoY) / alto));
  const huecoPt = techoY - sueloY;
  const altoPct = huecoPt > 0 ? Math.min(huecoPt / alto, ALTO_PCT_MAX) : base.altoPct;
  return { ...base, yPct, altoPct };
}
