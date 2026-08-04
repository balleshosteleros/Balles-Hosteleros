"use server";

/**
 * Importación de albaranes (PRP-073 Fase 1).
 *
 * Ciclo: iniciar (autoriza y firma la subida) → el NAVEGADOR sube directo a
 * Storage → completar (valida el objeto real + huella SHA-256) → analizar
 * (OCR desde Storage) → revisable. El archivo NUNCA viaja por una Server
 * Action: muere el base64 y su límite mudo de ~10,5 MB.
 *
 * Toda respuesta fallida es un `FalloImportacion` con código estable, mensaje
 * en español, traceId y si merece "Reintentar". Cada transición deja un
 * evento append-only en `albaran_eventos`.
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";
import {
  MENSAJES_IMPORTACION,
  MAX_OCR_BYTES,
  esMimeAlbaranAdmitido,
  nuevoTraceId,
  type ErrorImportacionAlbaran,
  type FalloImportacion,
  type FlujoImportacionAlbaran,
} from "@/features/logistica/lib/albaranes/importaciones";
import {
  ejecutarOcrAlbaran,
  type CabeceraOcrAlbaran,
  type LineaOcrAlbaran,
} from "@/features/logistica/lib/albaranes/ocr-albaran";

const BUCKET = "logistica-albaranes";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function fallo(
  errorCode: ErrorImportacionAlbaran,
  traceId: string,
  opts?: { message?: string; retryable?: boolean },
): FalloImportacion {
  const porDefectoRetryable: Partial<Record<ErrorImportacionAlbaran, boolean>> = {
    UPLOAD_FAILED: true,
    OCR_FAILED: true,
    OCR_EMPTY: true,
    PERSIST_FAILED: true,
  };
  return {
    ok: false,
    errorCode,
    message: opts?.message ?? MENSAJES_IMPORTACION[errorCode],
    traceId,
    retryable: opts?.retryable ?? porDefectoRetryable[errorCode] ?? false,
  };
}

/** Evento append-only. Nunca rompe el flujo principal si falla. */
async function registrarEvento(
  supabase: SupabaseClient,
  ev: {
    empresaId: string;
    importacionId?: string | null;
    albaranId?: string | null;
    actorId?: string | null;
    tipo: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("albaran_eventos").insert({
      empresa_id: ev.empresaId,
      importacion_id: ev.importacionId ?? null,
      albaran_id: ev.albaranId ?? null,
      actor_id: ev.actorId ?? null,
      tipo: ev.tipo,
      payload: ev.payload ?? null,
    });
  } catch (err) {
    console.error("[importaciones-albaran] registrarEvento:", err);
  }
}

/** Tipo real del archivo por cabecera mágica (file.type/extensión no son confiables). */
function detectarTipoReal(buf: Buffer): { mime: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: "image/png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return { mime: "image/webp" };
  if (buf.subarray(0, 4).toString("ascii") === "%PDF") return { mime: "application/pdf" };
  // HEIC/HEIF (iPhone): caja ISO-BMFF "ftyp" + brand heic/heix/hevc/heif/mif1...
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii").toLowerCase();
    if (["heic", "heix", "hevc", "heif", "mif1", "msf1"].includes(brand)) return { mime: "image/heic" };
  }
  return null;
}

interface FilaImportacion {
  id: string;
  empresa_id: string;
  estado: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  archivo_sha256: string | null;
  intentos: number;
  trace_id: string | null;
  pedido_id: string | null;
  albaran_id: string | null;
}

async function cargarImportacion(
  supabase: SupabaseClient,
  empresaId: string,
  importacionId: string,
): Promise<FilaImportacion | null> {
  const { data } = await supabase
    .from("albaran_importaciones")
    .select("id, empresa_id, estado, storage_path, file_name, mime_type, size_bytes, archivo_sha256, intentos, trace_id, pedido_id, albaran_id")
    .eq("id", importacionId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return (data as FilaImportacion | null) ?? null;
}

// ────────────────────────────────────────────────────────────────────────────

export type IniciarImportacionResult =
  | { ok: true; importacionId: string; path: string; token: string; traceId: string }
  | FalloImportacion;

/**
 * Autoriza la subida: valida sesión/empresa/MIME/tamaño declarado, crea la
 * importación en `pendiente_subida` y devuelve la credencial firmada para que
 * el navegador suba DIRECTO al bucket. El path lo decide el servidor con la
 * empresa ACTIVA (la RLS del bucket autoriza por usuarios.empresa_id, que en
 * multi-empresa puede divergir — por eso la autorización real es esta action).
 */
export async function iniciarImportacionAlbaran(input: {
  flujo: FlujoImportacionAlbaran;
  pedidoId?: string | null;
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<IniciarImportacionResult> {
  const traceId = nuevoTraceId();
  try {
    const { supabase, userId, empresaId } = await getLogisticaContext();
    if (!userId) return fallo("AUTH_EXPIRED", traceId);
    if (!empresaId) return fallo("NO_ACTIVE_COMPANY", traceId);

    if (!esMimeAlbaranAdmitido(input.mimeType)) return fallo("UNSUPPORTED_MEDIA", traceId);
    if (!Number.isFinite(input.size) || input.size <= 0) {
      return fallo("UPLOAD_FAILED", traceId, { message: "El archivo está vacío o no se pudo leer." });
    }
    if (input.size > MAX_DOCUMENTO_BYTES) {
      return fallo("FILE_TOO_LARGE", traceId, {
        message: `El archivo supera los ${MAX_DOCUMENTO_MB} MB. Haz la foto de nuevo o elige un archivo más ligero.`,
      });
    }

    const { data: fila, error: insErr } = await supabase
      .from("albaran_importaciones")
      .insert({
        empresa_id: empresaId,
        created_by: userId,
        flujo: input.flujo,
        pedido_id: input.pedidoId || null,
        estado: "pendiente_subida",
        file_name: input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.size,
        trace_id: traceId,
      })
      .select("id")
      .single();
    if (insErr || !fila) {
      console.error(`[importaciones-albaran] iniciar insert (${traceId}):`, insErr?.message);
      return fallo("PERSIST_FAILED", traceId);
    }

    const path = `${empresaId}/importaciones/${fila.id}/${Date.now()}_${sanitizeFilename(input.fileName)}`;
    const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (!signed.data?.token) {
      console.error(`[importaciones-albaran] signed URL (${traceId}):`, signed.error?.message);
      await supabase
        .from("albaran_importaciones")
        .update({ estado: "error", error_code: "UPLOAD_FAILED", error_message: signed.error?.message ?? null })
        .eq("id", fila.id);
      return fallo("UPLOAD_FAILED", traceId);
    }

    await supabase.from("albaran_importaciones").update({ storage_path: path }).eq("id", fila.id);
    await registrarEvento(supabase, {
      empresaId,
      importacionId: fila.id,
      actorId: userId,
      tipo: "importacion_creada",
      payload: { flujo: input.flujo, fileName: input.fileName, mimeType: input.mimeType, size: input.size },
    });

    return { ok: true, importacionId: fila.id as string, path, token: signed.data.token, traceId };
  } catch (err) {
    console.error(`[importaciones-albaran] iniciar (${traceId}):`, err);
    return fallo("PERSIST_FAILED", traceId);
  }
}

export type CompletarSubidaResult = { ok: true; sha256: string } | FalloImportacion;

/**
 * Tras la subida del navegador: valida que el objeto EXISTE de verdad, con
 * tamaño real y cabecera mágica coherente, y calcula la huella SHA-256
 * autoritativa en servidor. Pasa la importación a `subido`.
 */
export async function completarSubidaAlbaran(input: {
  importacionId: string;
}): Promise<CompletarSubidaResult> {
  let traceId = nuevoTraceId();
  try {
    const { supabase, userId, empresaId } = await getLogisticaContext();
    if (!userId) return fallo("AUTH_EXPIRED", traceId);
    if (!empresaId) return fallo("NO_ACTIVE_COMPANY", traceId);

    const imp = await cargarImportacion(supabase, empresaId, input.importacionId);
    if (!imp || !imp.storage_path) return fallo("NOT_FOUND", traceId);
    traceId = imp.trace_id ?? traceId;

    const descarga = await supabase.storage.from(BUCKET).download(imp.storage_path);
    if (!descarga.data) {
      await supabase
        .from("albaran_importaciones")
        .update({ estado: "error", error_code: "UPLOAD_FAILED", error_message: descarga.error?.message ?? "objeto no encontrado" })
        .eq("id", imp.id);
      return fallo("UPLOAD_FAILED", traceId);
    }

    const buf = Buffer.from(await descarga.data.arrayBuffer());
    if (buf.length === 0) return fallo("UPLOAD_FAILED", traceId, { message: "El archivo subido está vacío. Reintenta la subida." });
    if (buf.length > MAX_DOCUMENTO_BYTES) {
      return fallo("FILE_TOO_LARGE", traceId, { message: `El archivo supera los ${MAX_DOCUMENTO_MB} MB.` });
    }

    const tipoReal = detectarTipoReal(buf);
    if (!tipoReal) {
      await supabase
        .from("albaran_importaciones")
        .update({ estado: "error", error_code: "UNSUPPORTED_MEDIA", error_message: "cabecera de archivo no reconocida" })
        .eq("id", imp.id);
      return fallo("UNSUPPORTED_MEDIA", traceId);
    }

    const sha256 = createHash("sha256").update(buf).digest("hex");
    const { error: updErr } = await supabase
      .from("albaran_importaciones")
      .update({
        estado: "subido",
        archivo_sha256: sha256,
        size_bytes: buf.length,
        mime_type: tipoReal.mime, // el real manda sobre el declarado
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", imp.id);
    if (updErr) return fallo("PERSIST_FAILED", traceId);

    await registrarEvento(supabase, {
      empresaId,
      importacionId: imp.id,
      actorId: userId,
      tipo: "subida_completada",
      payload: { sha256, sizeBytes: buf.length, mimeReal: tipoReal.mime },
    });

    return { ok: true, sha256 };
  } catch (err) {
    console.error(`[importaciones-albaran] completar (${traceId}):`, err);
    return fallo("PERSIST_FAILED", traceId);
  }
}

export type AnalizarImportacionResult =
  | { ok: true; cabecera: CabeceraOcrAlbaran; lineas: LineaOcrAlbaran[] }
  | FalloImportacion;

/**
 * OCR desde Storage: descarga el objeto en servidor y lo analiza con el
 * extractor único. El base64 es interno (nunca del body de la request).
 */
export async function analizarImportacionAlbaran(input: {
  importacionId: string;
}): Promise<AnalizarImportacionResult> {
  let traceId = nuevoTraceId();
  try {
    const { supabase, userId, empresaId } = await getLogisticaContext();
    if (!userId) return fallo("AUTH_EXPIRED", traceId);
    if (!empresaId) return fallo("NO_ACTIVE_COMPANY", traceId);

    const imp = await cargarImportacion(supabase, empresaId, input.importacionId);
    if (!imp || !imp.storage_path) return fallo("NOT_FOUND", traceId);
    traceId = imp.trace_id ?? traceId;
    if (imp.estado === "pendiente_subida") {
      return fallo("UPLOAD_FAILED", traceId, { message: "La subida no llegó a completarse. Reintenta la subida." });
    }

    const marcarError = async (code: ErrorImportacionAlbaran, message: string) => {
      await supabase
        .from("albaran_importaciones")
        .update({ estado: "error", error_code: code, error_message: message, updated_at: new Date().toISOString() })
        .eq("id", imp.id);
      await registrarEvento(supabase, {
        empresaId,
        importacionId: imp.id,
        actorId: userId,
        tipo: "ocr_error",
        payload: { errorCode: code, intento: imp.intentos + 1 },
      });
    };

    if ((imp.size_bytes ?? 0) > MAX_OCR_BYTES) {
      const msg = `El documento es demasiado grande para el análisis (máx. ${Math.floor(MAX_OCR_BYTES / 1024 / 1024)} MB). Haz la foto de nuevo con menos resolución o comprime el PDF.`;
      await marcarError("FILE_TOO_LARGE", msg);
      return fallo("FILE_TOO_LARGE", traceId, { message: msg, retryable: false });
    }

    await supabase
      .from("albaran_importaciones")
      .update({ estado: "analizando", intentos: imp.intentos + 1, updated_at: new Date().toISOString() })
      .eq("id", imp.id);

    const descarga = await supabase.storage.from(BUCKET).download(imp.storage_path);
    if (!descarga.data) {
      await marcarError("UPLOAD_FAILED", "El archivo no está disponible en el almacén.");
      return fallo("UPLOAD_FAILED", traceId);
    }
    const buf = Buffer.from(await descarga.data.arrayBuffer());

    const res = await ejecutarOcrAlbaran({
      base64: buf.toString("base64"),
      mimeType: imp.mime_type || "image/jpeg",
    });
    if (!res.ok) {
      await marcarError(res.error, res.message);
      return fallo(res.error, traceId, { message: res.message });
    }

    const { error: updErr } = await supabase
      .from("albaran_importaciones")
      .update({
        estado: "revisable",
        ocr_resultado: { cabecera: res.cabecera, lineas: res.lineas },
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", imp.id);
    if (updErr) return fallo("PERSIST_FAILED", traceId);

    await registrarEvento(supabase, {
      empresaId,
      importacionId: imp.id,
      actorId: userId,
      tipo: "ocr_ok",
      payload: { nLineas: res.lineas.length, intento: imp.intentos + 1 },
    });

    return { ok: true, cabecera: res.cabecera, lineas: res.lineas };
  } catch (err) {
    console.error(`[importaciones-albaran] analizar (${traceId}):`, err);
    return fallo("OCR_FAILED", traceId);
  }
}

/** Reintento sobre la MISMA importación: reusa el archivo ya subido. */
export async function reintentarImportacionAlbaran(input: {
  importacionId: string;
}): Promise<AnalizarImportacionResult> {
  const traceId = nuevoTraceId();
  try {
    const { supabase, userId, empresaId } = await getLogisticaContext();
    if (!userId) return fallo("AUTH_EXPIRED", traceId);
    if (!empresaId) return fallo("NO_ACTIVE_COMPANY", traceId);

    const imp = await cargarImportacion(supabase, empresaId, input.importacionId);
    if (!imp) return fallo("NOT_FOUND", traceId);
    if (imp.estado === "pendiente_subida" || !imp.storage_path) {
      return fallo("UPLOAD_FAILED", imp?.trace_id ?? traceId, {
        message: "La subida no llegó a completarse: vuelve a elegir la foto.",
        retryable: false,
      });
    }

    await registrarEvento(supabase, {
      empresaId,
      importacionId: imp.id,
      actorId: userId,
      tipo: "reintento",
      payload: { desdeEstado: imp.estado, intentosPrevios: imp.intentos },
    });
  } catch (err) {
    console.error(`[importaciones-albaran] reintentar (${traceId}):`, err);
    return fallo("PERSIST_FAILED", traceId);
  }
  return analizarImportacionAlbaran(input);
}
