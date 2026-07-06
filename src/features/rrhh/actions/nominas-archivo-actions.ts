"use server";

/**
 * Nómina original adjunta a un pago (rrhh_pagos.nomina_path).
 *
 * Al subir nóminas, el cliente empareja cada una con su empleado y llama a
 * `guardarNominaArchivo` con el documento (base64) de ESA nómina. Se sube al
 * bucket privado `rrhh-nominas` (path <empresa>/<periodo>/<empleado>.<ext>) por
 * service-role y se guarda el path en la fila del pago.
 *
 * `getNominaArchivoUrl` devuelve una URL firmada temporal para abrir la nómina
 * original desde la columna "Nómina" de la tabla de pagos (mismo patrón que las
 * firmas). Bloqueado si la liquidación ya fue enviada (inmutable).
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "rrhh-nominas";
const SIGNED_URL_TTL = 60 * 10; // 10 min para verla

const EXT_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Sube el documento de la nómina de un empleado y persiste su path en el pago.
 * `archivoBase64` es el PDF/imagen de esa nómina (una página del PDF de la
 * gestoría, o el archivo suelto). Devuelve el path guardado.
 */
export async function guardarNominaArchivo(
  periodo: string,
  empleadoId: string,
  archivoBase64: string,
  mimeType: string,
  /** Si ya hay nómina ese mes y esto es false, NO sobrescribe: devuelve yaExistia. */
  permitirSobrescribir = false,
): Promise<{ ok: boolean; path?: string; locked?: boolean; yaExistia?: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || !empleadoId || empleadoId.startsWith("ext-")) {
      return { ok: false, error: "Empleado no válido" };
    }
    const ext = EXT_POR_MIME[mimeType];
    if (!ext) return { ok: false, error: "Formato no admitido" };

    // Bloqueo: liquidación ya enviada = inmutable (el trigger también lo impide).
    const { data: existente } = await supabase
      .from("rrhh_pagos")
      .select("id, confirmacion_enviada_at, nomina_path")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (existente?.confirmacion_enviada_at) return { ok: false, locked: true };
    // Ya tiene nómina adjunta ese mes: no regrabar salvo que se pida expresamente.
    if (existente?.nomina_path && !permitirSobrescribir) {
      return { ok: false, yaExistia: true };
    }

    const admin = createAdminClient();
    const path = `${empresaId}/${periodo}/${empleadoId}.${ext}`;
    const bytes = Buffer.from(archivoBase64, "base64");

    const up = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { upsert: true, contentType: mimeType });
    if (up.error) return { ok: false, error: up.error.message };

    // Guardar el path en la fila del pago. Si aún no existe la fila (empleado sin
    // liquidación tecleada), la creamos con lo mínimo para no perder la nómina.
    if (existente?.id) {
      const { error } = await admin
        .from("rrhh_pagos")
        .update({ nomina_path: path })
        .eq("id", existente.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from("rrhh_pagos").insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        periodo,
        empleado_nombre: "",
        nomina_path: path,
      });
      // Si otro proceso creó la fila en paralelo, reintentar como update.
      if (error) {
        const { error: e2 } = await admin
          .from("rrhh_pagos")
          .update({ nomina_path: path })
          .eq("empresa_id", empresaId)
          .eq("empleado_id", empleadoId)
          .eq("periodo", periodo);
        if (e2) return { ok: false, error: e2.message };
      }
    }

    return { ok: true, path };
  } catch (err) {
    console.error("[rrhh] guardarNominaArchivo:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Guarda los DATOS leídos de la nómina (SS empleado/empresa + neto a percibir) en
 * el pago del empleado para ESE periodo, SIN tocar el resto de columnas (pago,
 * propina, ajuste, total…). Update parcial idempotente: crea la fila si no existe.
 * Se usa al subir nóminas para no pisar datos de otros meses.
 */
export async function guardarDatosNomina(
  periodo: string,
  empleadoId: string,
  empleadoNombre: string,
  datos: { neto: number; ssEmpleado: number; ssEmpresa: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || !empleadoId || empleadoId.startsWith("ext-")) {
      return { ok: false, error: "Empleado no válido" };
    }
    const admin = createAdminClient();

    const { data: existente } = await supabase
      .from("rrhh_pagos")
      .select("id, confirmacion_enviada_at")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (existente?.confirmacion_enviada_at) return { ok: false, error: "Liquidación ya enviada" };

    const campos = {
      nomina: datos.neto,
      ss_empleado: datos.ssEmpleado,
      ss_empresa: datos.ssEmpresa,
    };
    if (existente?.id) {
      const { error } = await admin.from("rrhh_pagos").update(campos).eq("id", existente.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from("rrhh_pagos").insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        empleado_nombre: empleadoNombre,
        periodo,
        ...campos,
      });
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] guardarDatosNomina:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/** URL firmada temporal para abrir la nómina original de un empleado/periodo. */
export async function getNominaArchivoUrl(
  periodo: string,
  empleadoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autorizado" };

    const { data: pago } = await supabase
      .from("rrhh_pagos")
      .select("nomina_path")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo)
      .maybeSingle();
    const path = pago?.nomina_path as string | null | undefined;
    if (!path) return { ok: false, error: "Sin nómina adjunta" };

    const admin = createAdminClient();
    const signed = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, error: signed.error?.message ?? "No se pudo generar el enlace" };
    }
    return { ok: true, url: signed.data.signedUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
