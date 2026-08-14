import "server-only";

/**
 * Extracción de las CASILLAS REALES de un justificante AEAT ya presentado.
 *
 * Al subir el PDF de la gestoría no basta con guardar el archivo: los
 * justificantes traen el texto legible ("Modelo 303", "casilla 46 → 747,12"),
 * así que se leen las casillas y se guardan como datos. Eso es lo que permite
 * tener gráficas e histórico fiscal reales dentro del software, en vez de una
 * carpeta de PDFs opaca.
 *
 * IMPORTANTE: lo extraído se guarda SIEMPRE marcado con origen "gestoria"
 * (ver `casillas_origen` en modelos_aeat). Un dato leído de un PDF por IA no
 * puede confundirse nunca con uno calculado por el motor interno.
 */

import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import type { CasillasMap, ModeloPeriodo, ModeloTipo } from "../types/modelos";

/**
 * Casillas que pedimos por tipo de modelo. Se listan explícitamente para que la
 * IA busque valores concretos en vez de "lo que encuentre": así el resultado es
 * estable entre ejercicios y comparable en las gráficas.
 */
const CASILLAS_POR_TIPO: Partial<Record<ModeloTipo, { casilla: string; que: string }[]>> = {
  "303": [
    { casilla: "01", que: "Base imponible régimen general al 21%" },
    { casilla: "03", que: "Cuota devengada al 21%" },
    { casilla: "04", que: "Base imponible al 10%" },
    { casilla: "06", que: "Cuota devengada al 10%" },
    { casilla: "07", que: "Base imponible al 4%" },
    { casilla: "09", que: "Cuota devengada al 4%" },
    { casilla: "27", que: "Total cuota devengada" },
    { casilla: "28", que: "Base de cuotas soportadas en operaciones interiores corrientes" },
    { casilla: "29", que: "Cuota deducible en operaciones interiores corrientes" },
    { casilla: "30", que: "Base de bienes de inversión interiores" },
    { casilla: "31", que: "Cuota deducible de bienes de inversión interiores" },
    { casilla: "45", que: "Total a deducir" },
    { casilla: "46", que: "Resultado régimen general (27 - 45)" },
    { casilla: "64", que: "Suma de resultados" },
    { casilla: "69", que: "Resultado de la autoliquidación" },
    { casilla: "71", que: "Resultado a ingresar" },
    { casilla: "72", que: "Importe a compensar" },
    { casilla: "110", que: "Cuotas a compensar pendientes de periodos anteriores" },
    { casilla: "78", que: "Cuotas a compensar de periodos anteriores aplicadas en este periodo" },
    { casilla: "87", que: "Cuotas a compensar pendientes para periodos posteriores" },
  ],
  "111": [
    { casilla: "01", que: "Rendimientos del trabajo dinerarios: importe de las percepciones" },
    { casilla: "02", que: "Rendimientos del trabajo dinerarios: número de perceptores" },
    { casilla: "03", que: "Rendimientos del trabajo dinerarios: importe de las retenciones" },
    { casilla: "04", que: "Rendimientos del trabajo en especie: número de perceptores" },
    { casilla: "06", que: "Rendimientos del trabajo en especie: ingresos a cuenta" },
    { casilla: "07", que: "Actividades económicas dinerarias: importe de las percepciones" },
    { casilla: "08", que: "Actividades económicas dinerarias: número de perceptores" },
    { casilla: "09", que: "Actividades económicas dinerarias: importe de las retenciones" },
    { casilla: "28", que: "Suma de retenciones e ingresos a cuenta" },
    { casilla: "30", que: "Resultado a ingresar" },
  ],
  "115": [
    { casilla: "01", que: "Número de perceptores" },
    { casilla: "02", que: "Base de las retenciones" },
    { casilla: "03", que: "Importe de las retenciones" },
    { casilla: "05", que: "Resultado a ingresar" },
  ],
  "390": [
    { casilla: "33", que: "Total bases IVA devengado régimen general" },
    { casilla: "34", que: "Total cuotas IVA devengado régimen general" },
    { casilla: "47", que: "Total cuotas IVA y recargo de equivalencia" },
    { casilla: "64", que: "Suma de deducciones" },
    { casilla: "65", que: "Resultado régimen general (47 - 64)" },
    { casilla: "84", que: "Suma de resultados" },
    { casilla: "85", que: "Compensación de cuotas del ejercicio anterior" },
    { casilla: "86", que: "Resultado de la liquidación" },
    { casilla: "95", que: "Total resultados a ingresar en las autoliquidaciones del ejercicio" },
    { casilla: "97", que: "Importe a compensar del último periodo" },
    { casilla: "108", que: "Total volumen de operaciones" },
  ],
  "347": [
    { casilla: "01", que: "Número total de personas y entidades declaradas" },
    { casilla: "02", que: "Importe total anual de las operaciones declaradas" },
  ],
  "130": [
    { casilla: "01", que: "Ingresos computables del periodo" },
    { casilla: "02", que: "Gastos fiscalmente deducibles" },
    { casilla: "03", que: "Rendimiento neto" },
    { casilla: "07", que: "Pago fraccionado previo" },
    { casilla: "19", que: "Resultado a ingresar" },
  ],
};

export interface ResultadoExtraccion {
  /** Casillas leídas del justificante (clave = número de casilla AEAT). */
  casillas: CasillasMap;
  /** Confianza global 0..1 de la lectura. */
  confianza: number;
  /** Motivo/observación legible (por qué salió vacío, avisos, etc.). */
  motivo: string;
  /** Código Seguro de Verificación del justificante (comprobable en la Sede). */
  csv: string | null;
  /** Número de justificante de la presentación. */
  numeroJustificante: string | null;
  /** Fecha de presentación real que consta en el justificante (ISO), si se lee. */
  fechaPresentacion: string | null;
}

const VACIO: ResultadoExtraccion = {
  casillas: {},
  confianza: 0,
  motivo: "",
  csv: null,
  numeroJustificante: null,
  fechaPresentacion: null,
};

/**
 * Convierte un importe español ("370.345,71", "-752,95", "1.088,94 €") a número.
 * Devuelve null si no es un importe utilizable.
 */
export function parseImporteEs(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/[€\s]/g, "").trim();
  if (!limpio) return null;
  // Formato español: el punto es separador de miles y la coma decimal.
  const normalizado = limpio.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee las casillas de un justificante AEAT. Best-effort: si la IA no está
 * configurada o falla, devuelve vacío SIN romper la subida — el PDF se guarda
 * igual y las casillas pueden extraerse después.
 */
export async function extraerCasillasIA(input: {
  buffer: Buffer;
  tipo: ModeloTipo;
  ejercicio: number;
  periodo: ModeloPeriodo;
}): Promise<ResultadoExtraccion> {
  const pedidas = CASILLAS_POR_TIPO[input.tipo];
  if (!pedidas || pedidas.length === 0) {
    return { ...VACIO, motivo: `El modelo ${input.tipo} no tiene casillas definidas para extraer.` };
  }

  const listado = pedidas.map((c) => `- casilla "${c.casilla}": ${c.que}`).join("\n");

  const prompt =
    `Este PDF es un justificante de presentación de la AEAT del modelo ${input.tipo}, ` +
    `ejercicio ${input.ejercicio}, periodo ${input.periodo}. ` +
    "Extrae el VALOR NUMÉRICO de las siguientes casillas tal y como aparecen impresas:\n" +
    listado +
    "\n\nReglas estrictas:\n" +
    "1. Devuelve el importe EXACTO que figura en el documento, sin recalcular ni deducir nada.\n" +
    "2. Si una casilla no aparece, está vacía o es ilegible, OMÍTELA del resultado. " +
    "NUNCA inventes un 0 ni un valor aproximado.\n" +
    "3. Usa el formato numérico del documento (español: '370.345,71'). Conserva el signo negativo si lo hay.\n" +
    "4. Las casillas de 'número de perceptores' son enteros, no importes.\n" +
    "5. Extrae también, de la cabecera del justificante: el Código Seguro de Verificación (CSV), " +
    "el número de justificante y la fecha de presentación (formato AAAA-MM-DD). " +
    "Si alguno no aparece, devuélvelo como cadena vacía.\n" +
    "Responde solo con el JSON pedido.";

  const schema = {
    type: "object",
    properties: {
      casillas: {
        type: "array",
        description: "Una entrada por casilla LEÍDA en el documento. Omite las que no aparezcan.",
        items: {
          type: "object",
          properties: {
            casilla: { type: "string", description: "Número de casilla AEAT, p. ej. '46'." },
            valor: { type: "string", description: "Importe tal cual aparece, p. ej. '747,12'." },
          },
          required: ["casilla", "valor"],
        },
      },
      csv: { type: "string", description: "Código Seguro de Verificación, o cadena vacía." },
      numeroJustificante: { type: "string", description: "Número de justificante, o cadena vacía." },
      fechaPresentacion: {
        type: "string",
        description: "Fecha de presentación en formato AAAA-MM-DD, o cadena vacía.",
      },
      confianza: { type: "number", description: "Confianza global 0..1 de la lectura." },
    },
    required: ["casillas", "csv", "numeroJustificante", "fechaPresentacion", "confianza"],
  };

  interface RespuestaIA {
    casillas: Array<{ casilla: string; valor: string }>;
    csv: string;
    numeroJustificante: string;
    fechaPresentacion: string;
    confianza: number;
  }

  let ia: RespuestaIA;
  try {
    const { data } = await geminiJSON<RespuestaIA>(prompt, {
      responseSchema: schema as never,
      temperature: 0,
      attachments: [{ mimeType: "application/pdf", base64: input.buffer.toString("base64") }],
    });
    ia = data;
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return { ...VACIO, motivo: "IA no configurada: el PDF se guarda sin extraer casillas." };
    }
    console.error("[modelos] extraerCasillasIA:", err);
    return { ...VACIO, motivo: "No se pudieron extraer las casillas; el PDF se guarda igual." };
  }

  // Solo se aceptan casillas que habíamos pedido: evita que la IA "invente"
  // casillas que no corresponden al modelo.
  const permitidas = new Set(pedidas.map((c) => c.casilla));
  const casillas: CasillasMap = {};
  let descartadas = 0;

  for (const fila of ia.casillas ?? []) {
    const clave = String(fila.casilla ?? "").trim();
    if (!permitidas.has(clave)) {
      descartadas++;
      continue;
    }
    const num = parseImporteEs(fila.valor);
    if (num === null) {
      descartadas++;
      continue;
    }
    casillas[clave] = num;
  }

  const limpiar = (s: string | undefined) => {
    const v = (s ?? "").trim();
    return v.length > 0 ? v : null;
  };
  const fecha = limpiar(ia.fechaPresentacion);

  const leidas = Object.keys(casillas).length;
  return {
    casillas,
    confianza: ia.confianza ?? 0,
    csv: limpiar(ia.csv),
    numeroJustificante: limpiar(ia.numeroJustificante),
    // Solo se acepta una fecha con forma AAAA-MM-DD; cualquier otra cosa se descarta.
    fechaPresentacion: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    motivo:
      leidas === 0
        ? "No se identificó ninguna casilla en el documento."
        : `Se leyeron ${leidas} casillas del justificante` +
          (descartadas > 0 ? ` (${descartadas} descartadas por no ser válidas).` : "."),
  };
}
