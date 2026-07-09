"use server";

/**
 * Server Actions para el PDF de un modelo fiscal (AEAT).
 *
 * Replica el patrón de subida de albaranes (logistica/actions/albaranes-actions.ts):
 *  - contexto/empresaId vía getAppContext()
 *  - path canónico con empresa_id como primer segmento (RLS)
 *  - upload → persistir path en BD → compensar con .remove() si falla el guardado
 *  - createSignedUrl para lectura temporal
 *
 * Bucket privado: 'modelos-aeat-pdf'. Tabla: 'modelos_aeat' (columna pdf_url).
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import type { ModeloTipo, ModeloPeriodo } from "../types/modelos";

const BUCKET_MODELOS = "modelos-aeat-pdf";

/** Fila mínima que necesitamos leer de modelos_aeat para construir el path. */
type FilaModeloPdf = {
  tipo: ModeloTipo;
  periodo: ModeloPeriodo;
  ejercicio: number;
  pdf_url: string | null;
};

/**
 * Construye el path canónico del objeto en el bucket. El primer segmento DEBE ser
 * empresa_id (RLS). tipo/periodo/ejercicio son valores controlados (enums/int), por
 * lo que no requieren sanitización adicional.
 */
function pathModeloPdf(
  empresaId: string,
  ejercicio: number,
  periodo: ModeloPeriodo,
  tipo: ModeloTipo,
): string {
  return `${empresaId}/${ejercicio}/${periodo}/${tipo}_${Date.now()}.pdf`;
}

/**
 * Sube el PDF de un modelo a Storage y persiste su path en `modelos_aeat.pdf_url`.
 * Si la fila ya tenía un PDF anterior, lo borra del bucket (best-effort).
 */
export async function subirModeloPdf(modeloId: string, file: File) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    if (!file || file.size === 0) {
      return { ok: false as const, error: "No se recibió ningún archivo" };
    }
    if (file.type !== "application/pdf") {
      return { ok: false as const, error: "El archivo debe ser un PDF" };
    }

    // Leer la fila para conocer tipo/periodo/ejercicio y el PDF anterior (si lo hay).
    const { data: fila, error: readErr } = await supabase
      .from("modelos_aeat")
      .select("tipo, periodo, ejercicio, pdf_url")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .maybeSingle<FilaModeloPdf>();
    if (readErr) throw readErr;
    if (!fila) return { ok: false as const, error: "El modelo no existe" };

    const path = pathModeloPdf(empresaId, fila.ejercicio, fila.periodo, fila.tipo);

    const { error: upErr } = await supabase.storage
      .from(BUCKET_MODELOS)
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      return { ok: false as const, error: `No se pudo subir el archivo: ${upErr.message}` };
    }

    const { error: updErr } = await supabase
      .from("modelos_aeat")
      .update({ pdf_url: path })
      .eq("id", modeloId)
      .eq("empresa_id", empresaId);
    if (updErr) {
      // Compensación: el guardado en BD falló, retiramos el objeto subido.
      await supabase.storage.from(BUCKET_MODELOS).remove([path]);
      return { ok: false as const, error: updErr.message };
    }

    // Borrar el PDF anterior (best-effort: no rompe la operación si falla).
    const anterior = fila.pdf_url;
    if (anterior && anterior !== path) {
      const { error: rmErr } = await supabase.storage.from(BUCKET_MODELOS).remove([anterior]);
      if (rmErr) {
        console.error(
          `[modelos] subirModeloPdf: no se pudo borrar el PDF anterior (${anterior}): ${rmErr.message}`,
        );
      }
    }

    revalidatePath("/gestoria/modelos");
    return { ok: true as const, path };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] subirModeloPdf:", msg);
    return { ok: false as const, error: msg };
  }
}

/** URL firmada (10 min) para ver/descargar el PDF de un modelo. */
export async function getModeloPdfSignedUrl(modeloId: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { data: fila, error: readErr } = await supabase
      .from("modelos_aeat")
      .select("pdf_url")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .maybeSingle<{ pdf_url: string | null }>();
    if (readErr) throw readErr;
    if (!fila?.pdf_url) return { ok: false as const, error: "Sin documento" };

    const signed = await supabase.storage
      .from(BUCKET_MODELOS)
      .createSignedUrl(fila.pdf_url, 60 * 10);
    if (!signed.data?.signedUrl) {
      return { ok: false as const, error: "No se pudo generar la URL" };
    }
    return { ok: true as const, url: signed.data.signedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] getModeloPdfSignedUrl:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Elimina el PDF de un modelo: borra el objeto del bucket (best-effort) y pone
 * `pdf_url = null`. Útil para reemplazos/limpieza.
 */
export async function eliminarModeloPdf(modeloId: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { data: fila, error: readErr } = await supabase
      .from("modelos_aeat")
      .select("pdf_url")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .maybeSingle<{ pdf_url: string | null }>();
    if (readErr) throw readErr;

    if (fila?.pdf_url) {
      const { error: rmErr } = await supabase.storage
        .from(BUCKET_MODELOS)
        .remove([fila.pdf_url]);
      if (rmErr) {
        console.error(
          `[modelos] eliminarModeloPdf: no se pudo borrar el objeto (${fila.pdf_url}): ${rmErr.message}`,
        );
      }
    }

    const { error: updErr } = await supabase
      .from("modelos_aeat")
      .update({ pdf_url: null })
      .eq("id", modeloId)
      .eq("empresa_id", empresaId);
    if (updErr) throw updErr;

    revalidatePath("/gestoria/modelos");
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] eliminarModeloPdf:", msg);
    return { ok: false as const, error: msg };
  }
}
