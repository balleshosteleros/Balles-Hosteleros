"use server";

import { revalidatePath } from "next/cache";
import { SchemaType, type Schema } from "@google/generative-ai";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import {
  compararLineas,
  type LineaSistema,
} from "@/features/logistica/lib/facturas/comparar-lineas";
import {
  crearFacturaDesdeAlbaranInputSchema,
  crearFacturaHuerfanaInputSchema,
  ocrFacturaResultadoSchema,
  resolverDiscrepanciaInputSchema,
  validarFacturaInputSchema,
  type CrearFacturaDesdeAlbaranInput,
  type CrearFacturaHuerfanaInput,
  type ResolverDiscrepanciaInput,
  type ValidarFacturaInput,
} from "@/features/logistica/lib/facturas/schemas";
import type {
  ComparativaResultado,
  Factura,
  LineaFactura,
  OcrFacturaResultado,
} from "@/features/logistica/types/facturas";

const BUCKET = "logistica-facturas";
const SIGNED_URL_TTL = 60 * 60; // 1h

type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

function fail(msg: string): { ok: false; error: string } {
  return { ok: false, error: msg };
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

// ─── Mapping DB → dominio ──────────────────────────────────

interface FacturaRow {
  id: string;
  empresa_id: string;
  numero_secuencial: number;
  numero: string;
  albaran_id: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string;
  numero_factura_proveedor: string | null;
  fecha_factura: string | null;
  fecha_recepcion: string;
  estado: string;
  base_imponible: number | string;
  iva_total: number | string;
  total: number | string;
  lineas: LineaFactura[] | unknown;
  adjunto_path: string | null;
  adjunto_mime: string | null;
  adjunto_nombre: string | null;
  ocr_resultado: unknown;
  ocr_tokens_input: number | null;
  ocr_tokens_output: number | null;
  ocr_modelo: string | null;
  comparativa_resultado: ComparativaResultado | unknown;
  notas: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
  validated_by: string | null;
}

function toFactura(row: FacturaRow): Factura {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    numeroSecuencial: row.numero_secuencial,
    numero: row.numero,
    albaranId: row.albaran_id,
    proveedorId: row.proveedor_id,
    proveedorNombre: row.proveedor_nombre,
    numeroFacturaProveedor: row.numero_factura_proveedor,
    fechaFactura: row.fecha_factura,
    fechaRecepcion: row.fecha_recepcion,
    estado: row.estado as Factura["estado"],
    baseImponible: Number(row.base_imponible) || 0,
    ivaTotal: Number(row.iva_total) || 0,
    total: Number(row.total) || 0,
    lineas: (Array.isArray(row.lineas) ? row.lineas : []) as LineaFactura[],
    adjuntoPath: row.adjunto_path,
    adjuntoMime: row.adjunto_mime,
    adjuntoNombre: row.adjunto_nombre,
    ocrResultado: row.ocr_resultado ?? null,
    ocrTokensInput: row.ocr_tokens_input,
    ocrTokensOutput: row.ocr_tokens_output,
    ocrModelo: row.ocr_modelo,
    comparativaResultado: (row.comparativa_resultado as ComparativaResultado) ?? null,
    notas: row.notas,
    creadoPor: row.creado_por,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
  };
}

function calcularTotales(lineas: LineaFactura[]): {
  baseImponible: number;
  ivaTotal: number;
  total: number;
} {
  let base = 0;
  let iva = 0;
  lineas.forEach((l) => {
    if (l.discrepanciaTipo === "faltante") return; // no contribuye al total facturado
    const importe = Number(l.importeLinea) || 0;
    base += importe;
    iva += (importe * (Number(l.ivaPorcentaje) || 0)) / 100;
  });
  const round = (n: number) => Math.round(n * 100) / 100;
  return { baseImponible: round(base), ivaTotal: round(iva), total: round(base + iva) };
}

// ─── Listado / lectura ─────────────────────────────────────

export async function listFacturas(): Promise<ActionResult<Factura[]>> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");
    const { data, error } = await supabase
      .from("facturas_proveedor")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map((r) => toFactura(r as FacturaRow)) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al listar facturas";
    console.error("[facturas] listFacturas:", msg);
    return fail(msg);
  }
}

export async function getFactura(id: string): Promise<ActionResult<Factura>> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");
    const { data, error } = await supabase
      .from("facturas_proveedor")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();
    if (error) throw error;
    return { ok: true, data: toFactura(data as FacturaRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Factura no encontrada";
    console.error("[facturas] getFactura:", msg);
    return fail(msg);
  }
}

// ─── Creación ─────────────────────────────────────────────

export async function crearFacturaDesdeAlbaran(
  input: CrearFacturaDesdeAlbaranInput,
): Promise<ActionResult<{ id: string; numero: string }>> {
  try {
    const parsed = crearFacturaDesdeAlbaranInputSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.message);

    const { supabase, empresaId, userId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");

    const { data: alb, error: albErr } = await supabase
      .from("albaranes")
      .select("*")
      .eq("id", parsed.data.albaranId)
      .eq("empresa_id", empresaId)
      .single();
    if (albErr || !alb) return fail("Albarán no encontrado");
    if (alb.estado !== "Confirmado" && alb.estado !== "Recibido") {
      return fail("Solo se puede facturar un albarán Confirmado o Recibido");
    }

    // Convertir líneas del albarán (JSONB) al formato LineaFactura
    const lineasAlb = Array.isArray(alb.lineas) ? (alb.lineas as Array<Record<string, unknown>>) : [];
    const lineas: LineaFactura[] = lineasAlb.map((l, idx) => {
      const cantidad = Number(l.cantidad ?? 0);
      const precio = Number(l.precioUC ?? l.precio_unitario ?? 0);
      const iva = Number(l.impuesto ?? l.iva ?? 0);
      const importe = Math.round(cantidad * precio * 100) / 100;
      return {
        id: `lin-alb-${idx}`,
        productoId: (l.productoId as string | undefined) ?? null,
        origen: "albaran" as const,
        nombre: String(l.producto ?? l.nombre ?? ""),
        cantidad,
        unidad: String(l.unidad ?? ""),
        formato: String(l.formato ?? ""),
        precioUnitario: precio,
        ivaPorcentaje: iva,
        importeLinea: importe,
        discrepanciaTipo: null,
        discrepanciaResolucion: null,
        valorSistema: null,
        orden: idx,
      };
    });

    const totales = calcularTotales(lineas);

    // Numeración compartida: factura hereda numero_secuencial del albarán → mismo número, distinto prefijo.
    const year = new Date(alb.fecha || new Date().toISOString()).getFullYear();
    const numeroSec = alb.numero_secuencial as number | null;
    const insertPayload: Record<string, unknown> = {
      empresa_id: empresaId,
      albaran_id: alb.id,
      proveedor_id: alb.proveedor_id,
      proveedor_nombre: alb.proveedor_nombre,
      fecha_factura: alb.fecha,
      estado: "Borrador",
      lineas: lineas as unknown as object,
      base_imponible: totales.baseImponible,
      iva_total: totales.ivaTotal,
      total: totales.total,
      creado_por: userId,
    };
    if (typeof numeroSec === "number") {
      insertPayload.numero_secuencial = numeroSec;
      insertPayload.numero = `FAC-${year}-${String(numeroSec).padStart(3, "0")}`;
    }

    const { data: nueva, error: insErr } = await supabase
      .from("facturas_proveedor")
      .insert(insertPayload)
      .select("id, numero")
      .single();

    if (insErr || !nueva) return fail(insErr?.message ?? "No se pudo crear la factura");

    revalidatePath("/logistica/pedidos");
    return { ok: true, data: { id: nueva.id as string, numero: nueva.numero as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al crear factura desde albarán";
    console.error("[facturas] crearFacturaDesdeAlbaran:", msg);
    return fail(msg);
  }
}

export async function crearFacturaHuerfana(
  input: CrearFacturaHuerfanaInput,
): Promise<ActionResult<{ id: string; numero: string }>> {
  try {
    const parsed = crearFacturaHuerfanaInputSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.message);

    const { supabase, empresaId, userId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");

    const { data: nueva, error } = await supabase
      .from("facturas_proveedor")
      .insert({
        empresa_id: empresaId,
        proveedor_id: parsed.data.proveedorId,
        proveedor_nombre: parsed.data.proveedorNombre,
        fecha_factura: parsed.data.fechaFactura ?? null,
        estado: "Borrador",
        notas: parsed.data.notas ?? null,
        creado_por: userId,
      })
      .select("id, numero")
      .single();
    if (error || !nueva) return fail(error?.message ?? "No se pudo crear la factura");

    revalidatePath("/logistica/pedidos");
    return { ok: true, data: { id: nueva.id as string, numero: nueva.numero as string } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al crear factura";
    console.error("[facturas] crearFacturaHuerfana:", msg);
    return fail(msg);
  }
}

// ─── Adjunto (Storage) ─────────────────────────────────────

export async function subirAdjuntoFactura(formData: FormData): Promise<ActionResult<{ path: string }>> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");

    const facturaId = String(formData.get("facturaId") ?? "");
    const file = formData.get("file") as File | null;
    if (!facturaId) return fail("Falta facturaId");
    if (!file || file.size === 0) return fail("No se recibió ningún archivo");
    if (file.size > 20 * 1024 * 1024) return fail("El archivo supera los 20 MB");

    const safe = sanitizeFilename(file.name);
    const path = `${empresaId}/${facturaId}/${Date.now()}_${safe}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (upErr) return fail(`No se pudo subir el archivo: ${upErr.message}`);

    const { error: updErr } = await supabase
      .from("facturas_proveedor")
      .update({
        adjunto_path: path,
        adjunto_mime: file.type || null,
        adjunto_nombre: file.name,
      })
      .eq("id", facturaId)
      .eq("empresa_id", empresaId);
    if (updErr) {
      await supabase.storage.from(BUCKET).remove([path]);
      return fail(updErr.message);
    }

    revalidatePath("/logistica/pedidos");
    return { ok: true, data: { path } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al subir adjunto";
    console.error("[facturas] subirAdjuntoFactura:", msg);
    return fail(msg);
  }
}

export async function getAdjuntoSignedUrl(facturaId: string): Promise<ActionResult<{ url: string; mime: string | null }>> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");

    const { data: fact, error } = await supabase
      .from("facturas_proveedor")
      .select("adjunto_path, adjunto_mime")
      .eq("id", facturaId)
      .eq("empresa_id", empresaId)
      .single();
    if (error || !fact?.adjunto_path) return fail("Esta factura no tiene adjunto");

    const signed = await supabase.storage.from(BUCKET).createSignedUrl(fact.adjunto_path, SIGNED_URL_TTL);
    if (!signed.data?.signedUrl) return fail("No se pudo generar URL firmada");
    return { ok: true, data: { url: signed.data.signedUrl, mime: fact.adjunto_mime } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al firmar URL";
    console.error("[facturas] getAdjuntoSignedUrl:", msg);
    return fail(msg);
  }
}

// ─── OCR + Comparativa ─────────────────────────────────────

const OCR_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    proveedorNombreDetectado: { type: SchemaType.STRING, nullable: true },
    numeroFacturaDetectado: { type: SchemaType.STRING, nullable: true },
    fechaFacturaDetectada: { type: SchemaType.STRING, nullable: true, description: "YYYY-MM-DD" },
    baseImponibleDetectada: { type: SchemaType.NUMBER, nullable: true },
    ivaTotalDetectado: { type: SchemaType.NUMBER, nullable: true },
    totalDetectado: { type: SchemaType.NUMBER, nullable: true },
    lineas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          cantidad: { type: SchemaType.NUMBER },
          unidad: { type: SchemaType.STRING },
          formato: { type: SchemaType.STRING },
          precioUnitario: { type: SchemaType.NUMBER },
          ivaPorcentaje: { type: SchemaType.NUMBER },
          importeLinea: { type: SchemaType.NUMBER },
        },
        required: ["nombre", "cantidad", "precioUnitario", "importeLinea"],
      },
    },
    observaciones: { type: SchemaType.STRING, nullable: true },
  },
  required: ["lineas"],
};

const OCR_SYSTEM = `
Eres un extractor de facturas de proveedores de un restaurante en España.
Tu tarea: leer el documento adjunto (PDF o foto de factura) y devolver un JSON con:
- Datos de cabecera: proveedor, número de factura, fecha (YYYY-MM-DD), base imponible, IVA total y total.
- Una lista de líneas con: nombre del producto, cantidad, unidad (kg, L, ud...), formato, precio unitario, IVA % y importe de la línea.
Si un dato no se ve, devuélvelo como null. NO inventes. Idioma: español.
`.trim();

export async function analizarFacturaVsAlbaran(facturaId: string): Promise<ActionResult<{ resumen: ComparativaResultado["resumen"] }>> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");

    // 1. Cargar factura y sus líneas actuales (vienen del albarán)
    const { data: factRow, error: factErr } = await supabase
      .from("facturas_proveedor")
      .select("*")
      .eq("id", facturaId)
      .eq("empresa_id", empresaId)
      .single();
    if (factErr || !factRow) return fail("Factura no encontrada");
    if (!factRow.adjunto_path) return fail("Antes de analizar, sube el adjunto del proveedor");

    // 2. Descargar adjunto desde Storage
    const dl = await supabase.storage.from(BUCKET).download(factRow.adjunto_path);
    if (dl.error || !dl.data) return fail("No se pudo leer el adjunto");
    const arrayBuf = await dl.data.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const mime = factRow.adjunto_mime || "application/pdf";

    // 3. OCR con Gemini
    const prompt = "Extrae los datos estructurados de esta factura del proveedor.";
    const ocrRes = await geminiJSON<OcrFacturaResultado>(prompt, {
      systemInstruction: OCR_SYSTEM,
      responseSchema: OCR_RESPONSE_SCHEMA,
      temperature: 0.1,
      attachments: [{ mimeType: mime, base64 }],
    });

    const parsedOcr = ocrFacturaResultadoSchema.safeParse(ocrRes.data);
    if (!parsedOcr.success) {
      return fail("La IA devolvió un formato inesperado. Reintenta o valida la factura manualmente.");
    }

    // 4. Comparar contra las líneas actuales (provenientes del albarán)
    const lineasSistemaActual = (Array.isArray(factRow.lineas) ? factRow.lineas : []) as LineaFactura[];
    const lineasSistema: LineaSistema[] = lineasSistemaActual
      .filter((l) => l.origen === "albaran" || l.origen === "manual")
      .map((l) => ({
        id: l.id,
        productoId: l.productoId,
        nombre: l.nombre,
        cantidad: l.cantidad,
        unidad: l.unidad,
        formato: l.formato,
        precioUnitario: l.precioUnitario,
        ivaPorcentaje: l.ivaPorcentaje,
        importeLinea: l.importeLinea,
      }));

    const comparativa = compararLineas(lineasSistema, parsedOcr.data.lineas);
    const totales = calcularTotales(comparativa.lineas);

    // 5. Diferencias agregadas
    const diferenciaTotal = Math.round((totales.total - (Number(factRow.total) || 0)) * 100) / 100;
    const diferenciaIva = Math.round((totales.ivaTotal - (Number(factRow.iva_total) || 0)) * 100) / 100;

    const comparativaResultado: ComparativaResultado = {
      resumen: comparativa.resumen,
      diferenciaTotal,
      diferenciaIva,
    };

    const estadoNuevo = comparativa.resumen.hayAlerta ? "ConDiscrepancias" : "Analizada";

    const { error: upErr } = await supabase
      .from("facturas_proveedor")
      .update({
        lineas: comparativa.lineas as unknown as object,
        ocr_resultado: parsedOcr.data,
        ocr_tokens_input: ocrRes.tokensInput,
        ocr_tokens_output: ocrRes.tokensOutput,
        ocr_modelo: ocrRes.modelo,
        comparativa_resultado: comparativaResultado,
        proveedor_nombre: parsedOcr.data.proveedorNombreDetectado || factRow.proveedor_nombre,
        numero_factura_proveedor: parsedOcr.data.numeroFacturaDetectado || factRow.numero_factura_proveedor,
        fecha_factura: parsedOcr.data.fechaFacturaDetectada || factRow.fecha_factura,
        base_imponible: totales.baseImponible,
        iva_total: totales.ivaTotal,
        total: totales.total,
        estado: estadoNuevo,
      })
      .eq("id", facturaId)
      .eq("empresa_id", empresaId);
    if (upErr) return fail(upErr.message);

    revalidatePath("/logistica/pedidos");
    return { ok: true, data: { resumen: comparativa.resumen } };
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return fail("Falta configurar GEMINI_API_KEY en el servidor.");
    }
    const msg = err instanceof Error ? err.message : "Error al analizar la factura";
    console.error("[facturas] analizarFacturaVsAlbaran:", msg);
    return fail(msg);
  }
}

// ─── Resolución de discrepancias ────────────────────────────

export async function resolverDiscrepancia(
  input: ResolverDiscrepanciaInput,
): Promise<ActionResult<{ lineas: LineaFactura[] }>> {
  try {
    const parsed = resolverDiscrepanciaInputSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.message);

    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");

    const { data: factRow, error } = await supabase
      .from("facturas_proveedor")
      .select("lineas")
      .eq("id", parsed.data.facturaId)
      .eq("empresa_id", empresaId)
      .single();
    if (error || !factRow) return fail("Factura no encontrada");

    const lineas = (Array.isArray(factRow.lineas) ? factRow.lineas : []) as LineaFactura[];
    const updated: LineaFactura[] = lineas.map((l) => {
      if (l.id !== parsed.data.lineaId) return l;

      // Si el usuario edita manualmente, sobrescribimos los valores
      const next: LineaFactura = {
        ...l,
        discrepanciaResolucion: parsed.data.resolucion,
      };
      if (parsed.data.resolucion === "mantengo_sistema" && l.valorSistema) {
        next.cantidad = l.valorSistema.cantidad;
        next.precioUnitario = l.valorSistema.precioUnitario;
        next.ivaPorcentaje = l.valorSistema.ivaPorcentaje;
        next.importeLinea = l.valorSistema.importeLinea;
      }
      if (parsed.data.resolucion === "editado_manual") {
        if (typeof parsed.data.cantidad === "number") next.cantidad = parsed.data.cantidad;
        if (typeof parsed.data.precioUnitario === "number") next.precioUnitario = parsed.data.precioUnitario;
        if (typeof parsed.data.ivaPorcentaje === "number") next.ivaPorcentaje = parsed.data.ivaPorcentaje;
        next.importeLinea = Math.round(next.cantidad * next.precioUnitario * 100) / 100;
      }
      // acepto_proveedor: dejamos los valores OCR tal cual
      return next;
    });

    const totales = calcularTotales(updated);
    const todasResueltas = updated.every(
      (l) => l.discrepanciaTipo === null || l.discrepanciaResolucion !== null,
    );
    const estadoNuevo = todasResueltas ? "Analizada" : "ConDiscrepancias";

    const { error: upErr } = await supabase
      .from("facturas_proveedor")
      .update({
        lineas: updated as unknown as object,
        base_imponible: totales.baseImponible,
        iva_total: totales.ivaTotal,
        total: totales.total,
        estado: estadoNuevo,
      })
      .eq("id", parsed.data.facturaId)
      .eq("empresa_id", empresaId);
    if (upErr) return fail(upErr.message);

    revalidatePath("/logistica/pedidos");
    return { ok: true, data: { lineas: updated } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al resolver discrepancia";
    console.error("[facturas] resolverDiscrepancia:", msg);
    return fail(msg);
  }
}

// ─── Validación final ─────────────────────────────────────

export async function validarFactura(input: ValidarFacturaInput): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = validarFacturaInputSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.message);

    const { supabase, empresaId, userId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");

    const { data: factRow, error } = await supabase
      .from("facturas_proveedor")
      .select("lineas, adjunto_path")
      .eq("id", parsed.data.facturaId)
      .eq("empresa_id", empresaId)
      .single();
    if (error || !factRow) return fail("Factura no encontrada");
    if (!factRow.adjunto_path) return fail("No puedes validar sin adjuntar la factura del proveedor");

    const lineas = (Array.isArray(factRow.lineas) ? factRow.lineas : []) as LineaFactura[];
    const pendientes = lineas.filter(
      (l) => l.discrepanciaTipo !== null && l.discrepanciaResolucion === null,
    );
    if (pendientes.length > 0) {
      return fail(`Hay ${pendientes.length} discrepancias sin resolver`);
    }

    const { error: upErr } = await supabase
      .from("facturas_proveedor")
      .update({
        estado: "Validada",
        validated_at: new Date().toISOString(),
        validated_by: userId,
        notas: parsed.data.notas ?? null,
      })
      .eq("id", parsed.data.facturaId)
      .eq("empresa_id", empresaId);
    if (upErr) return fail(upErr.message);

    revalidatePath("/logistica/pedidos");
    return { ok: true, data: { id: parsed.data.facturaId } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al validar factura";
    console.error("[facturas] validarFactura:", msg);
    return fail(msg);
  }
}

// ─── Eliminar (anular) ─────────────────────────────────────

export async function updateNumeroFacturaProveedor(
  facturaId: string,
  numeroFacturaProveedor: string | null,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");
    const { error } = await supabase
      .from("facturas_proveedor")
      .update({ numero_factura_proveedor: numeroFacturaProveedor })
      .eq("id", facturaId)
      .eq("empresa_id", empresaId);
    if (error) return fail(error.message);
    revalidatePath("/logistica/pedidos");
    return { ok: true, data: { id: facturaId } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al actualizar nº proveedor";
    console.error("[facturas] updateNumeroFacturaProveedor:", msg);
    return fail(msg);
  }
}

export async function anularFactura(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return fail("No autenticado");
    const { error } = await supabase
      .from("facturas_proveedor")
      .update({ estado: "Anulada" })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) return fail(error.message);
    revalidatePath("/logistica/pedidos");
    return { ok: true, data: { id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al anular factura";
    console.error("[facturas] anularFactura:", msg);
    return fail(msg);
  }
}
