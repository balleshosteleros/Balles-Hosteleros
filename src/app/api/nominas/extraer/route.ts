/**
 * Extracción por IA (visión) de las nóminas de un mes.
 *
 * Endpoint AUTENTICADO (gestores de RRHH): lo llama el módulo de Pagos cuando se
 * adjuntan una o varias nóminas. Admite DOS formas de subir:
 *   1. Un archivo por empleado (PDF o imagen).
 *   2. UN PDF con TODAS las nóminas juntas (una por página, el caso de la
 *      gestoría): el endpoint lo PARTE en páginas y trata cada página como una
 *      nómina independiente.
 *
 * Para cada nómina, Gemini (visión nativa) PROPONE:
 *   - el DNI/NIE y el nombre del trabajador (para emparejarla con su fila)
 *   - la SS que paga el trabajador (se descuenta de su nómina)
 *   - la SS que paga la empresa por ese trabajador
 *
 * Devuelve un array `nominas`: cada elemento trae los datos leídos y el propio
 * documento de esa nómina en base64 (`archivoBase64` + `mimeType`), para que el
 * cliente lo guarde en Storage vinculado al empleado emparejado.
 *
 * La IA solo propone: los importes quedan editables. La SS es INFORMATIVA y no
 * altera el `total` del pago. Best-effort: si la IA no lee un dato, va vacío/0.
 * Si no hay GEMINI_API_KEY, degrada con elegancia.
 */
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import { getAppContext } from "@/lib/supabase/get-context";
import { normalizarDniNie } from "@/features/rrhh/lib/documentacion-validacion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // un PDF con todas las nóminas puede pesar más
const MAX_PAGINAS = 200; // salvaguarda: un PDF de nóminas de un mes no llega a esto
// Gemini lee PDF de forma nativa además de las imágenes habituales.
const TIPOS_OK = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const PROMPT =
  "Esta es una nómina española (recibo de salarios) de UN trabajador. Extrae ÚNICAMENTE:\n" +
  "1. El DNI o NIE del trabajador (DNI: 8 dígitos + letra; NIE: letra X/Y/Z + 7 dígitos + letra). " +
  "Es el identificador fiscal del trabajador, NO el CIF de la empresa.\n" +
  "2. El nombre completo del trabajador tal cual aparece.\n" +
  "3. El importe TOTAL de las aportaciones/deducciones de Seguridad Social a cargo del TRABAJADOR " +
  "(suma de contingencias comunes, desempleo y formación que se DESCUENTAN de su nómina). Es la parte del empleado.\n" +
  "4. El importe TOTAL del coste de Seguridad Social a cargo de la EMPRESA por ese trabajador " +
  "(aportación empresarial; suele aparecer en el recibo de cotización o en el pie de la nómina). Es la parte de la empresa.\n" +
  "5. El LÍQUIDO A PERCIBIR (neto que cobra el trabajador; el importe final a pagar tras deducciones). " +
  "En euros. Es el 'líquido a percibir' o 'total a percibir'.\n" +
  "6. El PERIODO de la nómina: el mes y año al que corresponde el recibo (aparece como 'del 1 al 30 de junio', " +
  "año 2026, etc.). Devuélvelo SIEMPRE en formato 'AAAA-MM' (p.ej. junio de 2026 = '2026-06'). Si no lo lees, cadena vacía.\n" +
  "Devuelve los importes como número en euros con punto decimal (p.ej. 123.45), sin el símbolo €. " +
  "Si un dato no aparece con seguridad, usa cadena vacía (texto) o 0 (importes). Responde solo con el JSON pedido.";

/** Salida estructurada garantizada por Gemini. */
const RESPUESTA_SCHEMA = {
  type: "object",
  properties: {
    dniNie: {
      type: "string",
      description: "DNI o NIE del trabajador, o cadena vacía si no se lee.",
    },
    nombre: {
      type: "string",
      description: "Nombre completo del trabajador, o cadena vacía si no se lee.",
    },
    ssEmpleado: {
      type: "number",
      description: "SS a cargo del trabajador en euros. 0 si no se puede leer.",
    },
    ssEmpresa: {
      type: "number",
      description: "SS a cargo de la empresa en euros. 0 si no se puede leer.",
    },
    neto: {
      type: "number",
      description: "Líquido a percibir (neto a pagar al trabajador) en euros. 0 si no se lee.",
    },
    periodo: {
      type: "string",
      description: "Mes del recibo en formato AAAA-MM (p.ej. '2026-06'), o cadena vacía si no se lee.",
    },
  },
  required: ["dniNie", "nombre", "ssEmpleado", "ssEmpresa", "neto", "periodo"],
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

/** Una nómina lista para el cliente: datos leídos + su documento en base64. */
interface NominaResultado {
  dniNie: string;
  nombre: string;
  ssEmpleado: number;
  ssEmpresa: number;
  neto: number;
  periodo: string;
  mimeType: string;
  archivoBase64: string;
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
 * Devuelve un array de buffers base64. Si el PDF tiene 1 página, devuelve el
 * original tal cual (evita recomprimir sin necesidad).
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

export async function POST(req: Request) {
  try {
    // Autenticación: solo usuarios con empresa activa (gestores de RRHH).
    const { empresaId } = await getAppContext();
    if (!empresaId) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const fd = await req.formData();
    const archivo = fd.get("archivo") as File | null;
    if (!archivo || archivo.size === 0) {
      return NextResponse.json({ ok: false, error: "Falta el archivo" }, { status: 400 });
    }
    if (archivo.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "El archivo supera 25MB" }, { status: 400 });
    }
    // Algunos navegadores no rellenan `type` en ficheros arrastrados: si el
    // nombre acaba en .pdf lo tratamos como PDF igualmente.
    const tipo =
      archivo.type && TIPOS_OK.has(archivo.type)
        ? archivo.type
        : /\.pdf$/i.test(archivo.name)
          ? "application/pdf"
          : archivo.type;
    if (!TIPOS_OK.has(tipo)) {
      return NextResponse.json(
        { ok: false, error: "Formato no admitido (usa PDF, JPG, PNG o WebP)" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());

    // Preparar la lista de "documentos-nómina":
    //  - PDF  → una entrada por página (una nómina por página).
    //  - imagen → un único documento.
    let documentos: { mimeType: string; base64: string }[];
    if (tipo === "application/pdf") {
      try {
        const paginas = await partirPdfEnPaginas(buffer);
        documentos = paginas.map((base64) => ({ mimeType: "application/pdf", base64 }));
      } catch (e) {
        console.error("[nominas/extraer] pdf partir:", e);
        // Si no se puede partir (PDF corrupto/cifrado): probar como un único doc.
        documentos = [{ mimeType: "application/pdf", base64: buffer.toString("base64") }];
      }
    } else {
      documentos = [{ mimeType: tipo, base64: buffer.toString("base64") }];
    }

    try {
      const nominas: NominaResultado[] = [];
      for (const doc of documentos) {
        const data = await leerNomina(doc.mimeType, doc.base64);
        if (!data) continue; // página ilegible: se omite, no rompe el lote
        const dniRaw = (data.dniNie ?? "").trim();
        nominas.push({
          dniNie: dniRaw ? normalizarDniNie(dniRaw) : "",
          nombre: (data.nombre ?? "").trim(),
          ssEmpleado: importe(data.ssEmpleado),
          ssEmpresa: importe(data.ssEmpresa),
          neto: importe(data.neto),
          periodo: normalizarPeriodo(data.periodo),
          mimeType: doc.mimeType,
          archivoBase64: doc.base64,
        });
      }

      if (nominas.length === 0) {
        return NextResponse.json({ ok: false, motivo: "ia_fallo", error: "No se pudo leer ninguna nómina" });
      }
      return NextResponse.json({ ok: true, nominas });
    } catch (e) {
      if (e instanceof GeminiKeyMissingError) {
        return NextResponse.json({ ok: false, motivo: "ia_no_configurada", error: "IA no configurada" });
      }
      console.error("[nominas/extraer] fatal ia:", e);
      return NextResponse.json({ ok: false, motivo: "ia_fallo", error: "No se pudo leer la nómina" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[nominas/extraer] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
