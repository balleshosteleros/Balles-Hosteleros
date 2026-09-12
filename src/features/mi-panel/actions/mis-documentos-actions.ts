"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/supabase/get-context";
import { friendlyError } from "@/shared/lib/friendly-errors";

export type CategoriaDocumento =
  | "nominas"
  | "contratos"
  | "justificantes"
  | "registros-jornada"
  | "entregas"
  | "sanciones"
  | "bajas-medicas"
  // Cajón para lo que no encaja en ninguna de las anteriores. Sin él, esos
  // documentos se quedaban fuera del expediente por no tener dónde ir.
  | "otros";

export interface DocumentoEmpleado {
  id: string;
  categoria: CategoriaDocumento;
  nombre: string;
  tipoMime: string | null;
  tamanoBytes: number | null;
  fecha: string; // YYYY-MM-DD
}

/**
 * La ficha de empleado del usuario en la empresa activa.
 *
 * Su panel es SUYO: da igual el rol, el puesto o los permisos que tenga en la
 * empresa, aquí solo se ve lo de esta persona. Todo lo que se lea para el panel
 * se ata a este id, sin fiarlo a la RLS: la de nóminas, por ejemplo, autoriza a
 * quien gestiona pagos a leer las de TODA la empresa, y sin este filtro esas
 * nóminas ajenas acababan en su carpeta personal.
 */
async function miEmpleadoId(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  userId: string,
  empresaId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("empleados")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Documentos personales del empleado autenticado, agrupados por categoría. */
export async function listMisDocumentos(): Promise<{ ok: boolean; data: Record<CategoriaDocumento, DocumentoEmpleado[]>; error?: string }> {
  const vacio: Record<CategoriaDocumento, DocumentoEmpleado[]> = {
    nominas: [],
    contratos: [],
    justificantes: [],
    "registros-jornada": [],
    entregas: [],
    sanciones: [],
    "bajas-medicas": [],
    otros: [],
  };
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: true, data: vacio };
    if (!empresaId) return { ok: true, data: vacio };

    const empleadoId = await miEmpleadoId(supabase, userId, empresaId);
    if (!empleadoId) return { ok: true, data: vacio };

    // Atado a su ficha y a la empresa activa: quien trabaja en las dos tiene una
    // ficha en cada una y veía aquí mezclados los documentos de ambos
    // empleadores (dos contratos, dos juegos de nóminas) sin nada que los
    // distinguiera.
    const { data, error } = await supabase
      .from("documentos_empleado")
      .select("id, categoria, nombre, tipo_mime, tamano_bytes, created_at")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const grupos: Record<CategoriaDocumento, DocumentoEmpleado[]> = {
      nominas: [],
      contratos: [],
      justificantes: [],
      "registros-jornada": [],
      entregas: [],
      sanciones: [],
      "bajas-medicas": [],
      otros: [],
    };
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        categoria: CategoriaDocumento;
        nombre: string;
        tipo_mime: string | null;
        tamano_bytes: number | null;
        created_at: string;
      };
      if (!grupos[r.categoria]) continue;
      grupos[r.categoria].push({
        id: r.id,
        categoria: r.categoria,
        nombre: r.nombre,
        tipoMime: r.tipo_mime,
        tamanoBytes: r.tamano_bytes,
        fecha: (r.created_at ?? "").slice(0, 10),
      });
    }

    // Las NÓMINAS no salen de aquí: viven en `rrhh_pagos_nominas` y la carpeta
    // las pide por su lado (`listMisNominas`), ya agrupadas por mes y atadas a
    // la ficha de quien mira.
    return { ok: true, data: grupos };
  } catch (err) {
    console.error("[mi-panel] listMisDocumentos:", err);
    return { ok: false, data: vacio, error: friendlyError(err, "total") };
  }
}

/**
 * URL firmada (1h) para descargar un documento del empleado. Se comprueba antes
 * que el documento es de SU ficha y de la empresa activa; la firma se genera con
 * cliente admin para no depender de políticas de storage por carpeta.
 */
export async function getDocumentoEmpleadoUrl(
  documentoId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const empleadoId = await miEmpleadoId(supabase, userId, empresaId);
    if (!empleadoId) return { ok: false, error: "Documento no disponible" };

    const { data: doc, error } = await supabase
      .from("documentos_empleado")
      .select("storage_path")
      .eq("id", documentoId)
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .maybeSingle();
    if (error) throw error;
    if (!doc) return { ok: false, error: "Documento no disponible" };

    const admin = createAdminClient();
    const { data: signed, error: sErr } = await admin.storage
      .from("empleados-docs")
      .createSignedUrl((doc as { storage_path: string }).storage_path, 60 * 60);
    if (sErr) throw sErr;
    return { ok: true, url: signed?.signedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mi-panel] getDocumentoEmpleadoUrl:", msg);
    return { ok: false, error: msg };
  }
}
