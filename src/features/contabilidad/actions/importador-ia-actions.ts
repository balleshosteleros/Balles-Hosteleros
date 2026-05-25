"use server";

import { SchemaType, type Schema } from "@google/generative-ai";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnalisisFacturasResultado,
  AnalisisContactosResultado,
  FilaFacturaSugerida,
  FilaContactoSugerida,
  PayloadExtraido,
} from "@/features/contabilidad/types/importador-ia";
import {
  TIPOS_FACTURA,
  ESTADOS_FACTURA,
  TIPOS_CONTACTO,
} from "@/features/contabilidad/types/importador-ia";

const MAX_FILAS_POR_ANALISIS = 300;

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
return { supabase, user, empresaId };
}

/* ── FACTURAS ──────────────────────────────────────────────────────── */

const FACTURA_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    filas: {
      type: SchemaType.ARRAY,
      description: "Lista de facturas detectadas. Una fila por factura.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          valores: {
            type: SchemaType.OBJECT,
            properties: {
              numero: { type: SchemaType.STRING, nullable: true, description: "Nº de factura o referencia." },
              tipo: {
                type: SchemaType.STRING,
                nullable: true,
                enum: [...TIPOS_FACTURA],
                format: "enum",
                description: "COMPRA si es factura recibida; VENTA si es emitida. Si no se infiere, COMPRA.",
              },
              contacto_nombre: { type: SchemaType.STRING, nullable: true, description: "Cliente (VENTA) o proveedor (COMPRA)." },
              fecha: { type: SchemaType.STRING, nullable: true, description: "Fecha de emisión. Formato YYYY-MM-DD." },
              fecha_vencimiento: { type: SchemaType.STRING, nullable: true, description: "Fecha de vencimiento. YYYY-MM-DD." },
              base_imponible: { type: SchemaType.STRING, nullable: true, description: "Importe sin IVA. Decimal con punto." },
              iva: { type: SchemaType.STRING, nullable: true, description: "Cantidad de IVA en euros." },
              total: { type: SchemaType.STRING, nullable: true, description: "Total con IVA. Decimal con punto." },
              estado: {
                type: SchemaType.STRING,
                nullable: true,
                enum: [...ESTADOS_FACTURA],
                format: "enum",
                description: "Estado de pago. Default PENDIENTE.",
              },
              notas: { type: SchemaType.STRING, nullable: true },
            },
          },
          confianza: {
            type: SchemaType.OBJECT,
            properties: {
              numero: { type: SchemaType.NUMBER, nullable: true },
              tipo: { type: SchemaType.NUMBER, nullable: true },
              contacto_nombre: { type: SchemaType.NUMBER, nullable: true },
              fecha: { type: SchemaType.NUMBER, nullable: true },
              fecha_vencimiento: { type: SchemaType.NUMBER, nullable: true },
              base_imponible: { type: SchemaType.NUMBER, nullable: true },
              iva: { type: SchemaType.NUMBER, nullable: true },
              total: { type: SchemaType.NUMBER, nullable: true },
              estado: { type: SchemaType.NUMBER, nullable: true },
              notas: { type: SchemaType.NUMBER, nullable: true },
            },
          },
        },
        required: ["valores"],
      },
    },
    resumen: { type: SchemaType.STRING, nullable: true },
  },
  required: ["filas"],
};

const INSTRUCCION_FACTURAS = `
Eres un extractor de facturas (recibidas y emitidas) de un restaurante en España.

Tu tarea: leer el documento adjunto (PDF, foto de factura, Excel, CSV) y devolver una lista
estructurada de facturas en formato JSON, siguiendo el schema.

Reglas:
- UNA factura por objeto. Si el documento contiene varias facturas, devuelve varias filas.
- Si una hoja de Excel contiene muchas filas de facturas, cada fila = una factura.
- Si una celda no aparece o no se puede inferir con razonable seguridad, ponla a null. NO inventes.
- Fechas en formato YYYY-MM-DD. Si solo aparece "1/4/2026", interpreta como 2026-04-01.
- Importes numéricos como string decimal con punto (ej. "1234.56"). Sin símbolo de moneda.
- 'tipo': COMPRA si es factura recibida de un proveedor; VENTA si es emitida a un cliente.
- 'estado': PENDIENTE | PAGADO | COBRADO | VENCIDO. Default PENDIENTE.
- Confianza por campo: 1.0 si literal del documento; 0.7-0.9 si lo has normalizado;
  0.4-0.6 si lo has inferido; <0.4 marca null en su lugar.
- Idioma: español.
`.trim();

export interface AnalizarFacturasInput {
  payload: PayloadExtraido;
}

export async function analizarFacturasIA(
  input: AnalizarFacturasInput,
): Promise<{ error?: string; resultado?: AnalisisFacturasResultado }> {
  try {
    const { payload } = input;
    let prompt: string;
    const attachments: Array<{ mimeType: string; base64: string }> = [];

    if (payload.kind === "tabla") {
      const muestra = payload.filas.slice(0, 200);
      prompt = [
        `Documento: ${payload.nombreArchivo}`,
        `Cabeceras detectadas: ${JSON.stringify(payload.cabeceras)}`,
        "",
        "Filas (JSON):",
        JSON.stringify(muestra, null, 2),
        "",
        "Mapea cada fila a una factura canónica.",
      ].join("\n");
    } else {
      prompt = [
        `Documento adjunto: ${payload.nombreArchivo} (${payload.mimeType})`,
        "Lee el documento completo (OCR si es imagen) y extrae todas las facturas.",
      ].join("\n");
      attachments.push({ mimeType: payload.mimeType, base64: payload.base64 });
    }

    const res = await geminiJSON<{
      filas?: Array<{
        valores?: Record<string, string | null>;
        confianza?: Record<string, number | null>;
      }>;
      resumen?: string | null;
    }>(prompt, {
      systemInstruction: INSTRUCCION_FACTURAS,
      responseSchema: FACTURA_SCHEMA,
      temperature: 0.2,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const filasIA = Array.isArray(res.data.filas) ? res.data.filas : [];
    if (filasIA.length === 0) {
      return { error: "La IA no encontró facturas en el documento." };
    }

    const filas: FilaFacturaSugerida[] = filasIA
      .slice(0, MAX_FILAS_POR_ANALISIS)
      .map((f, idx) => ({
        tempId: `ia-fact-${Date.now()}-${idx}`,
        valores: sanearValoresFactura(f.valores ?? {}),
        confianza: limpiarConfianza(f.confianza),
      }))
      .filter((f) => (f.valores.numero ?? "").toString().trim().length > 0 || (f.valores.contacto_nombre ?? "").toString().trim().length > 0);

    if (filas.length === 0) {
      return { error: "La IA devolvió filas sin nº de factura ni cliente." };
    }

    return {
      resultado: {
        filas,
        resumen: res.data.resumen ?? null,
        tokensInput: res.tokensInput,
        tokensOutput: res.tokensOutput,
        modelo: res.modelo,
      },
    };
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return { error: "Falta configurar GEMINI_API_KEY en el servidor." };
    }
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

function sanearValoresFactura(
  v: Record<string, string | null>,
): FilaFacturaSugerida["valores"] {
  const out: FilaFacturaSugerida["valores"] = { ...v };
  out.tipo = filtrarEnum(v.tipo, [...TIPOS_FACTURA]);
  out.estado = filtrarEnum(v.estado, [...ESTADOS_FACTURA]);
  return out;
}

export async function bulkImportFacturas(
  filas: Array<{
    numero: string;
    tipo?: string;
    contacto_nombre: string;
    fecha: string;
    fecha_vencimiento?: string | null;
    base_imponible?: number | null;
    iva?: number | null;
    total: number;
    estado?: string;
    notas?: string | null;
  }>,
): Promise<{ ok: boolean; imported: number; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, imported: 0, error: "No autenticado" };
    if (filas.length === 0) return { ok: true, imported: 0 };

    const rows = filas.map((f) => ({
      empresa_id: empresaId,
      numero: f.numero,
      tipo: f.tipo ?? "COMPRA",
      contacto_nombre: f.contacto_nombre,
      fecha: f.fecha,
      fecha_vencimiento: f.fecha_vencimiento ?? null,
      base_imponible: f.base_imponible ?? null,
      iva: f.iva ?? null,
      total: f.total,
      estado: f.estado ?? "PENDIENTE",
      notas: f.notas ?? null,
      created_by: user?.id ?? null,
    }));

    const { error } = await supabase.from("facturas").insert(rows);
    if (error) throw error;
    return { ok: true, imported: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contabilidad] bulkImportFacturas:", msg);
    return { ok: false, imported: 0, error: msg };
  }
}

/* ── CONTACTOS ─────────────────────────────────────────────────────── */

const CONTACTO_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    filas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          valores: {
            type: SchemaType.OBJECT,
            properties: {
              nombre: { type: SchemaType.STRING, nullable: true, description: "Razón social o nombre completo." },
              tipo: {
                type: SchemaType.STRING,
                nullable: true,
                enum: [...TIPOS_CONTACTO],
                format: "enum",
              },
              nif: { type: SchemaType.STRING, nullable: true, description: "CIF, NIF o NIE. Sin espacios." },
              email: { type: SchemaType.STRING, nullable: true },
              telefono: { type: SchemaType.STRING, nullable: true },
              direccion: { type: SchemaType.STRING, nullable: true },
              categoria: { type: SchemaType.STRING, nullable: true, description: "Categoría libre (Proveedor, Cliente, etc.)" },
              observaciones: { type: SchemaType.STRING, nullable: true },
            },
          },
          confianza: {
            type: SchemaType.OBJECT,
            properties: {
              nombre: { type: SchemaType.NUMBER, nullable: true },
              tipo: { type: SchemaType.NUMBER, nullable: true },
              nif: { type: SchemaType.NUMBER, nullable: true },
              email: { type: SchemaType.NUMBER, nullable: true },
              telefono: { type: SchemaType.NUMBER, nullable: true },
              direccion: { type: SchemaType.NUMBER, nullable: true },
              categoria: { type: SchemaType.NUMBER, nullable: true },
              observaciones: { type: SchemaType.NUMBER, nullable: true },
            },
          },
        },
        required: ["valores"],
      },
    },
    resumen: { type: SchemaType.STRING, nullable: true },
  },
  required: ["filas"],
};

const INSTRUCCION_CONTACTOS = `
Eres un extractor de contactos (clientes, proveedores, autónomos, particulares) para una empresa de hostelería en España.

Tu tarea: leer el documento (Excel, CSV, PDF, foto) y devolver una lista estructurada de contactos en JSON.

Reglas:
- UN contacto por objeto. Si el documento contiene una lista/tabla, cada fila = un contacto.
- 'tipo': EMPRESA (sociedad), AUTONOMO (persona física profesional), PARTICULAR (persona física no profesional).
  - Si el NIF empieza por A/B/C/D/E/F/G/H/J/N/P/Q/R/S/U/V/W → EMPRESA.
  - Si parece DNI/NIE (números + letra) → PARTICULAR salvo que el contexto deje claro AUTONOMO.
- Limpia teléfonos: solo dígitos y "+".
- Emails en minúsculas.
- Si una celda no aparece, null. No inventes.
- Idioma: español.
`.trim();

export interface AnalizarContactosInput {
  payload: PayloadExtraido;
}

export async function analizarContactosIA(
  input: AnalizarContactosInput,
): Promise<{ error?: string; resultado?: AnalisisContactosResultado }> {
  try {
    const { payload } = input;
    let prompt: string;
    const attachments: Array<{ mimeType: string; base64: string }> = [];

    if (payload.kind === "tabla") {
      const muestra = payload.filas.slice(0, 300);
      prompt = [
        `Documento: ${payload.nombreArchivo}`,
        `Cabeceras: ${JSON.stringify(payload.cabeceras)}`,
        "",
        "Filas (JSON):",
        JSON.stringify(muestra, null, 2),
        "",
        "Mapea cada fila a un contacto canónico.",
      ].join("\n");
    } else {
      prompt = [
        `Documento adjunto: ${payload.nombreArchivo} (${payload.mimeType})`,
        "Lee el documento (OCR si es imagen) y extrae todos los contactos.",
      ].join("\n");
      attachments.push({ mimeType: payload.mimeType, base64: payload.base64 });
    }

    const res = await geminiJSON<{
      filas?: Array<{
        valores?: Record<string, string | null>;
        confianza?: Record<string, number | null>;
      }>;
      resumen?: string | null;
    }>(prompt, {
      systemInstruction: INSTRUCCION_CONTACTOS,
      responseSchema: CONTACTO_SCHEMA,
      temperature: 0.2,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const filasIA = Array.isArray(res.data.filas) ? res.data.filas : [];
    if (filasIA.length === 0) {
      return { error: "La IA no encontró contactos en el documento." };
    }

    const filas: FilaContactoSugerida[] = filasIA
      .slice(0, MAX_FILAS_POR_ANALISIS)
      .map((f, idx) => ({
        tempId: `ia-cont-${Date.now()}-${idx}`,
        valores: sanearValoresContacto(f.valores ?? {}),
        confianza: limpiarConfianza(f.confianza),
      }))
      .filter((f) => (f.valores.nombre ?? "").toString().trim().length > 0);

    if (filas.length === 0) {
      return { error: "La IA devolvió filas sin nombre." };
    }

    return {
      resultado: {
        filas,
        resumen: res.data.resumen ?? null,
        tokensInput: res.tokensInput,
        tokensOutput: res.tokensOutput,
        modelo: res.modelo,
      },
    };
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return { error: "Falta configurar GEMINI_API_KEY en el servidor." };
    }
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

function sanearValoresContacto(
  v: Record<string, string | null>,
): FilaContactoSugerida["valores"] {
  const out: FilaContactoSugerida["valores"] = { ...v };
  out.tipo = filtrarEnum(v.tipo, [...TIPOS_CONTACTO]);
  return out;
}

export async function bulkImportContactos(
  filas: Array<{
    nombre: string;
    tipo?: string;
    nif?: string | null;
    email?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    categoria?: string | null;
    observaciones?: string | null;
  }>,
): Promise<{ ok: boolean; imported: number; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, imported: 0, error: "No autenticado" };
    if (filas.length === 0) return { ok: true, imported: 0 };

    const rows = filas.map((c) => ({
      empresa_id: empresaId,
      nombre: c.nombre,
      tipo: c.tipo ?? "EMPRESA",
      nif: c.nif ?? null,
      email: c.email ?? null,
      telefono: c.telefono ?? null,
      direccion: c.direccion ?? null,
      categoria: c.categoria ?? null,
      observaciones: c.observaciones ?? null,
      created_by: user?.id ?? null,
    }));

    const { error } = await supabase.from("contactos_contabilidad").insert(rows);
    if (error) throw error;
    return { ok: true, imported: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[contabilidad] bulkImportContactos:", msg);
    return { ok: false, imported: 0, error: msg };
  }
}

/* ── Helpers comunes ───────────────────────────────────────────────── */

function filtrarEnum(
  raw: string | null | undefined,
  catalogo: readonly string[],
): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return (catalogo as readonly string[]).includes(v) ? v : null;
}

function limpiarConfianza<K extends string>(
  c?: Record<string, number | null>,
): Partial<Record<K, number>> {
  if (!c) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "number" && v >= 0 && v <= 1) {
      out[k] = v;
    }
  }
  return out as Partial<Record<K, number>>;
}
