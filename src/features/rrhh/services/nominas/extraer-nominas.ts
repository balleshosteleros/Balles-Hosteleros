import "server-only";

/**
 * Extracción por IA (visión) de nóminas: núcleo compartido.
 *
 * Lo usan DOS entradas:
 *   1. `/api/nominas/extraer` (autenticado) — subida manual desde el módulo Pagos.
 *   2. `/api/gestoria/nominas/[token]` (público) — la gestoría sube por enlace.
 *
 * Admite un archivo (imagen o PDF de 1 página) o UN PDF con TODAS las nóminas
 * (una por página): parte el PDF y trata cada página como una nómina. Por cada
 * una, Gemini propone DNI/NIE, nombre, SS (empleado/empresa), neto, IRPF y el
 * periodo. Devuelve además el documento de esa nómina en base64 para guardarlo.
 */

import { PDFDocument } from "pdf-lib";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import { normalizarDniNie, esDniNieValido } from "@/features/rrhh/lib/documentacion-validacion";
import type { NominaLeida } from "@/features/rrhh/services/nominas/procesar-nominas";

export { GeminiKeyMissingError };

export const MAX_NOMINAS_BYTES = 25 * 1024 * 1024; // un PDF con todas las nóminas pesa
const MAX_PAGINAS = 200; // salvaguarda: un mes de nóminas no llega a esto
// Gemini lee PDF de forma nativa además de las imágenes habituales.
export const TIPOS_NOMINA_OK = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const PROMPT =
  "Esta es una nómina española (recibo de salarios) de UN trabajador. Extrae ÚNICAMENTE:\n" +
  "1. El DNI o NIE del trabajador. Léelo CARÁCTER A CARÁCTER, con máxima atención, sin inventar. " +
  "Suele aparecer bajo la etiqueta 'D.N.I.' o junto a los datos del trabajador.\n" +
  "   FORMATO EXACTO (respétalo SIEMPRE):\n" +
  "   - DNI: EXACTAMENTE 8 dígitos seguidos de 1 letra final (ej. 47309297E). Nunca 9 dígitos.\n" +
  "   - NIE: 1 letra inicial X, Y o Z, seguida de 7 dígitos, seguida de 1 letra final (ej. Z0033540B). " +
  "En total: letra + 7 dígitos + letra. Nunca dos letras juntas al inicio ni al final.\n" +
  "   REGLAS de lectura:\n" +
  "   - El PRIMER carácter de un NIE es una LETRA (X/Y/Z), no un número.\n" +
  "   - El ÚLTIMO carácter SIEMPRE es una LETRA de control (A-Z), nunca un número. Si crees leer un número al final, es una letra (0→O, 8→B, 5→S, 1→I, 2→Z).\n" +
  "   - No añadas dígitos de más: un NIE tiene 7 dígitos entre las dos letras, ni 8 ni 6.\n" +
  "   - Es el identificador fiscal del TRABAJADOR, NO el CIF de la empresa (el CIF empieza por letra + 8 dígitos y es de la empresa 'SYSTEM SL').\n" +
  "   - Si no lo lees con total seguridad, devuelve cadena vacía (mejor vacío que un DNI inventado).\n" +
  "2. El nombre completo del trabajador tal cual aparece (aparece como 'APELLIDO1 APELLIDO2, NOMBRE').\n" +
  "3. El importe TOTAL de las aportaciones/deducciones de Seguridad Social a cargo del TRABAJADOR " +
  "(suma de contingencias comunes, desempleo y formación que se DESCUENTAN de su nómina). Es la parte del empleado.\n" +
  "4. El importe TOTAL del coste de Seguridad Social a cargo de la EMPRESA por ese trabajador " +
  "(aportación empresarial; suele aparecer en el recibo de cotización o en el pie de la nómina). Es la parte de la empresa.\n" +
  "5. El LÍQUIDO A PERCIBIR (neto que cobra el trabajador; el importe final a pagar tras deducciones). " +
  "En euros. Es el 'líquido a percibir' o 'total a percibir'.\n" +
  "5b. El importe de la RETENCIÓN de IRPF practicada al trabajador (línea 'RETENCION I.R.P.F.'; " +
  "es una deducción de su nómina). En euros. 0 si no aparece.\n" +
  "6. El PERIODO de la nómina: el mes y año al que corresponde el recibo (aparece como 'del 1 al 30 de junio', " +
  "año 2026, etc.). Devuélvelo SIEMPRE en formato 'AAAA-MM' (p.ej. junio de 2026 = '2026-06'). Si no lo lees, cadena vacía.\n" +
  "Devuelve los importes como número en euros con punto decimal (p.ej. 123.45), sin el símbolo €. " +
  "Si un dato no aparece con seguridad, usa cadena vacía (texto) o 0 (importes). Responde solo con el JSON pedido.";

/** Salida estructurada garantizada por Gemini. */
const RESPUESTA_SCHEMA = {
  type: "object",
  properties: {
    dniNie: { type: "string", description: "DNI o NIE del trabajador, o cadena vacía si no se lee." },
    nombre: { type: "string", description: "Nombre completo del trabajador, o cadena vacía si no se lee." },
    ssEmpleado: { type: "number", description: "SS a cargo del trabajador en euros. 0 si no se puede leer." },
    ssEmpresa: { type: "number", description: "SS a cargo de la empresa en euros. 0 si no se puede leer." },
    neto: { type: "number", description: "Líquido a percibir (neto a pagar al trabajador) en euros. 0 si no se lee." },
    irpf: { type: "number", description: "Retención de IRPF practicada al trabajador en euros. 0 si no se lee." },
    periodo: { type: "string", description: "Mes del recibo en formato AAAA-MM (p.ej. '2026-06'), o cadena vacía si no se lee." },
  },
  required: ["dniNie", "nombre", "ssEmpleado", "ssEmpresa", "neto", "irpf", "periodo"],
} as const;

/** Redondea a 2 decimales y descarta valores no finitos o negativos. */
function importe(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

type IaLeida = {
  dniNie?: string;
  nombre?: string;
  ssEmpleado?: number;
  ssEmpresa?: number;
  neto?: number;
  irpf?: number;
  periodo?: string;
};

/** Normaliza el periodo leído por la IA a 'AAAA-MM' válido, o "" si no cuadra. */
function normalizarPeriodo(v: unknown): string {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mes = Number(m[2]);
  if (y < 2000 || y > 2100 || mes < 1 || mes > 12) return "";
  return `${y}-${String(mes).padStart(2, "0")}`;
}

/** Lee una nómina (imagen o PDF de una página) con Gemini. */
async function leerNomina(mimeType: string, base64: string): Promise<IaLeida | null> {
  try {
    const { data } = await geminiJSON<IaLeida>(PROMPT, {
      responseSchema: RESPUESTA_SCHEMA as never,
      temperature: 0,
      attachments: [{ mimeType, base64 }],
    });
    return data;
  } catch (e) {
    if (e instanceof GeminiKeyMissingError) throw e;
    console.error("[nominas/extraer] gemini:", e);
    return null;
  }
}

/**
 * Parte un PDF en páginas individuales (cada página → su propio PDF de 1 página).
 * Si el PDF tiene 1 página, devuelve el original tal cual.
 */
async function partirPdfEnPaginas(buffer: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const n = doc.getPageCount();
  if (n <= 1) return [buffer.toString("base64")];
  const paginas: string[] = [];
  const total = Math.min(n, MAX_PAGINAS);
  for (let i = 0; i < total; i++) {
    const nuevo = await PDFDocument.create();
    const [pagina] = await nuevo.copyPages(doc, [i]);
    nuevo.addPage(pagina);
    const bytes = await nuevo.save();
    paginas.push(Buffer.from(bytes).toString("base64"));
  }
  return paginas;
}

/**
 * Resuelve el MIME real de un archivo subido: algunos navegadores no rellenan
 * `type` en ficheros arrastrados; si el nombre acaba en .pdf lo tratamos como PDF.
 * Devuelve "" si el tipo no está admitido.
 */
export function resolverMimeNomina(archivo: File): string {
  const tipo =
    archivo.type && TIPOS_NOMINA_OK.has(archivo.type)
      ? archivo.type
      : /\.pdf$/i.test(archivo.name)
        ? "application/pdf"
        : archivo.type;
  return TIPOS_NOMINA_OK.has(tipo) ? tipo : "";
}

/**
 * Lee TODAS las nóminas de un archivo (imagen o PDF multipágina) con la IA y
 * devuelve la lista lista para emparejar+guardar (`NominaLeida[]`). Lanza
 * `GeminiKeyMissingError` si no hay clave. Devuelve [] si la IA no leyó ninguna.
 */
export async function extraerNominasDeArchivo(buffer: Buffer, mimeType: string): Promise<NominaLeida[]> {
  // PDF → una entrada por página; imagen → un único documento.
  let documentos: { mimeType: string; base64: string }[];
  if (mimeType === "application/pdf") {
    try {
      const paginas = await partirPdfEnPaginas(buffer);
      documentos = paginas.map((base64) => ({ mimeType: "application/pdf", base64 }));
    } catch (e) {
      console.error("[nominas/extraer] pdf partir:", e);
      documentos = [{ mimeType: "application/pdf", base64: buffer.toString("base64") }];
    }
  } else {
    documentos = [{ mimeType, base64: buffer.toString("base64") }];
  }

  // Leer EN PARALELO por tandas para no tardar minutos con muchas nóminas.
  const LOTE = 5;
  const leidas: (NominaLeida | null)[] = [];
  for (let i = 0; i < documentos.length; i += LOTE) {
    const tanda = documentos.slice(i, i + LOTE);
    const res = await Promise.all(
      tanda.map(async (doc) => {
        const data = await leerNomina(doc.mimeType, doc.base64);
        if (!data) return null;
        // Validar el DNI/NIE leído: si no tiene formato válido, lo descartamos
        // para emparejar por nombre en vez de por un DNI corrupto.
        const dniRaw = normalizarDniNie((data.dniNie ?? "").trim());
        const dniNie = dniRaw && esDniNieValido(dniRaw) ? dniRaw : "";
        return {
          dniNie,
          nombre: (data.nombre ?? "").trim(),
          ssEmpleado: importe(data.ssEmpleado),
          ssEmpresa: importe(data.ssEmpresa),
          neto: importe(data.neto),
          irpf: importe(data.irpf),
          periodo: normalizarPeriodo(data.periodo),
          mimeType: doc.mimeType,
          archivoBase64: doc.base64,
        } as NominaLeida;
      }),
    );
    leidas.push(...res);
  }
  return leidas.filter((x): x is NominaLeida => x !== null);
}
