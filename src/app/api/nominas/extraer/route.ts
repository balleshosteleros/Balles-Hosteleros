/**
 * Extracción por IA (visión) de los importes de Seguridad Social de una nómina.
 *
 * Endpoint AUTENTICADO (gestores de RRHH): lo llama el módulo de Pagos cuando se
 * adjuntan una o varias nóminas. Lee cada nómina con Gemini (visión nativa, el
 * mismo motor que el resto del proyecto — soporta PDF e imagen) y PROPONE:
 *   - la SS que paga el trabajador (se descuenta de su nómina)
 *   - la SS que paga la empresa por ese trabajador
 *   - el nombre del trabajador (para emparejar la nómina con su fila en la tabla)
 *
 * La IA solo propone: los importes quedan editables en la tabla de pagos. Estos
 * importes son INFORMATIVOS y no alteran el `total` del pago.
 *
 * Best-effort: si la IA no lee un importe, devuelve null en ese campo. Si no hay
 * GEMINI_API_KEY configurada, degrada con elegancia (los importes se teclean a mano).
 */
import { NextResponse } from "next/server";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import { getAppContext } from "@/lib/supabase/get-context";
import { normalizarDniNie } from "@/features/rrhh/lib/documentacion-validacion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
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
  "Esta es una nómina española (recibo de salarios). Extrae ÚNICAMENTE:\n" +
  "1. El DNI o NIE del trabajador (DNI: 8 dígitos + letra; NIE: letra X/Y/Z + 7 dígitos + letra). " +
  "Es el identificador fiscal del trabajador, NO el CIF de la empresa.\n" +
  "2. El nombre completo del trabajador tal cual aparece.\n" +
  "3. El importe TOTAL de las aportaciones/deducciones de Seguridad Social a cargo del TRABAJADOR " +
  "(suma de contingencias comunes, desempleo y formación que se DESCUENTAN de su nómina). Es la parte del empleado.\n" +
  "4. El importe TOTAL del coste de Seguridad Social a cargo de la EMPRESA por ese trabajador " +
  "(aportación empresarial; suele aparecer en el recibo de cotización o en el pie de la nómina). Es la parte de la empresa.\n" +
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
  },
  required: ["dniNie", "nombre", "ssEmpleado", "ssEmpresa"],
} as const;

/** Redondea a 2 decimales y descarta valores no finitos o negativos. */
function importe(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
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
      return NextResponse.json({ ok: false, error: "El archivo supera 10MB" }, { status: 400 });
    }
    if (!TIPOS_OK.has(archivo.type)) {
      return NextResponse.json(
        { ok: false, error: "Formato no admitido (usa PDF, JPG, PNG o WebP)" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    try {
      const { data } = await geminiJSON<{ dniNie?: string; nombre?: string; ssEmpleado?: number; ssEmpresa?: number }>(
        PROMPT,
        {
          responseSchema: RESPUESTA_SCHEMA as never,
          temperature: 0,
          attachments: [{ mimeType: archivo.type, base64: buffer.toString("base64") }],
        },
      );
      const dniRaw = (data.dniNie ?? "").trim();
      return NextResponse.json({
        ok: true,
        dniNie: dniRaw ? normalizarDniNie(dniRaw) : "",
        nombre: (data.nombre ?? "").trim(),
        ssEmpleado: importe(data.ssEmpleado),
        ssEmpresa: importe(data.ssEmpresa),
      });
    } catch (e) {
      if (e instanceof GeminiKeyMissingError) {
        return NextResponse.json({ ok: false, motivo: "ia_no_configurada", error: "IA no configurada" });
      }
      console.error("[nominas/extraer] gemini:", e);
      return NextResponse.json({ ok: false, motivo: "ia_fallo", error: "No se pudo leer la nómina" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[nominas/extraer] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
