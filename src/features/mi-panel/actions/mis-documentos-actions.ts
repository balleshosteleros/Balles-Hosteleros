"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CategoriaDocumento =
  | "nominas"
  | "contratos"
  | "justificantes"
  | "registros-jornada";

export interface DocumentoEmpleado {
  id: string;
  categoria: CategoriaDocumento;
  nombre: string;
  tipoMime: string | null;
  tamanoBytes: number | null;
  fecha: string; // YYYY-MM-DD
}

/** Documentos personales del empleado autenticado, agrupados por categoría. */
export async function listMisDocumentos(): Promise<{
  ok: boolean;
  data: Record<CategoriaDocumento, DocumentoEmpleado[]>;
}> {
  const vacio: Record<CategoriaDocumento, DocumentoEmpleado[]> = {
    nominas: [],
    contratos: [],
    justificantes: [],
    "registros-jornada": [],
  };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: true, data: vacio };

    // La RLS ya limita a los documentos del propio empleado.
    const { data, error } = await supabase
      .from("documentos_empleado")
      .select("id, categoria, nombre, tipo_mime, tamano_bytes, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const grupos: Record<CategoriaDocumento, DocumentoEmpleado[]> = {
      nominas: [],
      contratos: [],
      justificantes: [],
      "registros-jornada": [],
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
    return { ok: true, data: grupos };
  } catch (err) {
    console.error("[mi-panel] listMisDocumentos:", err);
    return { ok: false, data: vacio };
  }
}

/**
 * URL firmada (1h) para descargar un documento del empleado. Verifica primero
 * vía RLS que el documento es suyo; la firma se genera con cliente admin para
 * no depender de políticas de storage por carpeta.
 */
export async function getDocumentoEmpleadoUrl(
  documentoId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };

    // RLS garantiza que solo recupera el documento si es del propio empleado.
    const { data: doc, error } = await supabase
      .from("documentos_empleado")
      .select("storage_path")
      .eq("id", documentoId)
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
