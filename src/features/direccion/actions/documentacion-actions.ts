"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  MAX_FILE_BYTES,
  MAX_BYTES_EMPRESA,
  MAX_DOCS_CARPETA,
  MAX_DOCS_EMPRESA,
  isAllowedMime,
} from "@/features/direccion/lib/documentos-config";

const BUCKET = "documentacion";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

/* ─────────────────────────────────────────────────────────────
 * CARPETAS DOCUMENTALES
 * ────────────────────────────────────────────────────────────*/

export type Carpeta = {
  id: string;
  nombre: string;
  parent_id: string | null;
  created_at: string;
};

/**
 * Lista carpetas de la empresa.
 *  · `parentId === null` (default): carpetas raíz.
 *  · `parentId === string`: hijas de esa carpeta.
 */
export async function listCarpetas(
  parentId: string | null = null,
): Promise<{ ok: boolean; data: Carpeta[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    let query = supabase
      .from("carpetas_documentos")
      .select("id, nombre, parent_id, created_at")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });

    if (parentId === null) {
      query = query.is("parent_id", null);
    } else {
      query = query.eq("parent_id", parentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as Carpeta[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] listCarpetas:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function createCarpeta(
  nombre: string,
  parentId: string | null = null,
): Promise<{ ok: boolean; data?: Carpeta; error?: string }> {
  try {
    const limpio = (nombre ?? "").trim();
    if (!limpio) return { ok: false, error: "El nombre no puede estar vacío" };
    if (limpio.length > 80) return { ok: false, error: "Máximo 80 caracteres" };

    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Si hay parent, verificar que pertenece a esta empresa y es raíz (1 nivel max)
    if (parentId) {
      const { data: parent, error: pErr } = await supabase
        .from("carpetas_documentos")
        .select("id, parent_id")
        .eq("id", parentId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (pErr || !parent) return { ok: false, error: "Carpeta padre no encontrada" };
      if (parent.parent_id !== null) {
        return { ok: false, error: "Solo se permite un nivel de subcarpetas" };
      }
    }

    const { data, error } = await supabase
      .from("carpetas_documentos")
      .insert({
        empresa_id: empresaId,
        nombre: limpio,
        parent_id: parentId,
        created_by: user?.id ?? null,
      })
      .select("id, nombre, parent_id, created_at")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, error: "Ya existe una carpeta con ese nombre aquí" };
      }
      throw error;
    }
    return { ok: true, data: data as Carpeta };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] createCarpeta:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCarpeta(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("carpetas_documentos").delete().eq("id", id);
    if (error) {
      // 23503 = foreign_key_violation (carpeta tiene documentos)
      if ((error as { code?: string }).code === "23503") {
        return { ok: false, error: "La carpeta contiene documentos. Elimínalos primero." };
      }
      throw error;
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] deleteCarpeta:", msg);
    return { ok: false, error: msg };
  }
}

/* ─────────────────────────────────────────────────────────────
 * DOCUMENTOS (storage + tabla)
 * ────────────────────────────────────────────────────────────*/

export type DocumentoRow = {
  id: string;
  carpeta_id: string;
  nombre: string;
  descripcion: string | null;
  tipo_mime: string | null;
  tamano_bytes: number | null;
  estado: string;
  nivel_acceso: string;
  created_at: string;
  url: string; // signed URL
  storage_path: string;
};

/** Reserva server-side: valida cuotas + MIME + tamaño y devuelve el path donde el cliente debe subir. */
export async function prepareUpload(input: {
  carpetaId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<{ ok: true; storagePath: string; nombre: string } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    if (!input.carpetaId) return { ok: false, error: "Falta carpeta destino" };
    if (!input.fileName || input.fileName.trim().length === 0) {
      return { ok: false, error: "Nombre de archivo vacío" };
    }
    if (input.fileSize <= 0) return { ok: false, error: "Archivo vacío" };
    if (input.fileSize > MAX_FILE_BYTES) {
      return { ok: false, error: `Archivo demasiado grande. Máximo ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
    }
    if (!isAllowedMime(input.fileType)) {
      return { ok: false, error: "Tipo de archivo no permitido (solo PDF, Office, imágenes y texto)" };
    }

    // Carpeta debe pertenecer a esta empresa (RLS lo garantiza, comprobamos para mensaje útil)
    const { data: carpeta, error: carpetaErr } = await supabase
      .from("carpetas_documentos")
      .select("id")
      .eq("id", input.carpetaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (carpetaErr || !carpeta) {
      return { ok: false, error: "Carpeta no encontrada" };
    }

    // Pre-check cuotas (el trigger BD también lo cubre, pero damos mejor mensaje aquí)
    const [{ count: docsCarpeta }, { count: docsEmpresa }, { data: bytesAgg }] = await Promise.all([
      supabase
        .from("documentos")
        .select("id", { count: "exact", head: true })
        .eq("carpeta_id", input.carpetaId),
      supabase
        .from("documentos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId),
      supabase
        .from("documentos")
        .select("tamano_bytes")
        .eq("empresa_id", empresaId),
    ]);

    if ((docsCarpeta ?? 0) >= MAX_DOCS_CARPETA) {
      return { ok: false, error: `Esta carpeta ya tiene ${MAX_DOCS_CARPETA} documentos (máximo).` };
    }
    if ((docsEmpresa ?? 0) >= MAX_DOCS_EMPRESA) {
      return { ok: false, error: `La empresa ya tiene ${MAX_DOCS_EMPRESA} documentos (máximo).` };
    }
    const usados = (bytesAgg ?? []).reduce(
      (s, r) => s + ((r as { tamano_bytes: number | null }).tamano_bytes ?? 0),
      0,
    );
    if (usados + input.fileSize > MAX_BYTES_EMPRESA) {
      const usadosMB = (usados / 1024 / 1024).toFixed(2);
      return {
        ok: false,
        error: `Cuota de empresa excedida (${usadosMB} MB / ${MAX_BYTES_EMPRESA / 1024 / 1024} MB). Borra archivos para liberar espacio.`,
      };
    }

    const safe = sanitizeFilename(input.fileName);
    const storagePath = `${empresaId}/${input.carpetaId}/${Date.now()}_${safe}`;
    const nombre = input.fileName.trim().slice(0, 200);
    return { ok: true, storagePath, nombre };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] prepareUpload:", msg);
    return { ok: false, error: msg };
  }
}

/** Inserta la fila tras la subida exitosa al Storage (cliente). */
export async function confirmDocumento(input: {
  carpetaId: string;
  storagePath: string;
  nombre: string;
  tipoMime: string;
  tamanoBytes: number;
  descripcion?: string;
}): Promise<{ ok: true; data: DocumentoRow } | { ok: false; error: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    if (input.tamanoBytes > MAX_FILE_BYTES) {
      return { ok: false, error: "Archivo demasiado grande" };
    }
    if (!isAllowedMime(input.tipoMime)) {
      return { ok: false, error: "Tipo de archivo no permitido" };
    }

    const { data: row, error: dbErr } = await supabase
      .from("documentos")
      .insert({
        empresa_id: empresaId,
        carpeta_id: input.carpetaId,
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        storage_path: input.storagePath,
        tipo_mime: input.tipoMime,
        tamano_bytes: input.tamanoBytes,
        created_by: user.id,
      })
      .select("id, carpeta_id, nombre, descripcion, tipo_mime, tamano_bytes, estado, nivel_acceso, created_at, storage_path")
      .single();

    if (dbErr || !row) {
      // Rollback: borrar el archivo subido si la fila no se pudo crear
      await supabase.storage.from(BUCKET).remove([input.storagePath]);
      return { ok: false, error: dbErr?.message ?? "No se pudo registrar el documento" };
    }

    const signed = await supabase.storage.from(BUCKET).createSignedUrl(input.storagePath, SIGNED_URL_TTL_SECONDS);
    return {
      ok: true,
      data: {
        ...(row as Omit<DocumentoRow, "url">),
        url: signed.data?.signedUrl ?? "",
      } as DocumentoRow,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] confirmDocumento:", msg);
    return { ok: false, error: msg };
  }
}

export async function listDocumentosByCarpeta(
  carpetaId: string,
): Promise<{ ok: boolean; data: DocumentoRow[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data, error } = await supabase
      .from("documentos")
      .select("id, carpeta_id, nombre, descripcion, tipo_mime, tamano_bytes, estado, nivel_acceso, created_at, storage_path")
      .eq("empresa_id", empresaId)
      .eq("carpeta_id", carpetaId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const docs: DocumentoRow[] = [];
    for (const row of data ?? []) {
      const path = (row as { storage_path: string }).storage_path;
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      docs.push({
        ...(row as Omit<DocumentoRow, "url">),
        url: signed.data?.signedUrl ?? "",
      } as DocumentoRow);
    }
    return { ok: true, data: docs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] listDocumentosByCarpeta:", msg);
    return { ok: false, data: [], error: msg };
  }
}

/** Versión sólo-metadata (sin signed URLs) usada por export/IO. */
export async function listAllDocumentos(): Promise<{ ok: boolean; data: Omit<DocumentoRow, "url">[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { data, error } = await supabase
      .from("documentos")
      .select("id, carpeta_id, nombre, descripcion, tipo_mime, tamano_bytes, estado, nivel_acceso, created_at, storage_path")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as Omit<DocumentoRow, "url">[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] listAllDocumentos:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function deleteDocumento(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row, error: selErr } = await supabase
      .from("documentos")
      .select("storage_path")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    if (selErr || !row) return { ok: false, error: selErr?.message ?? "Documento no encontrado" };

    if (row.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
    }

    const { error: delErr } = await supabase
      .from("documentos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (delErr) return { ok: false, error: delErr.message };
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] deleteDocumento:", msg);
    return { ok: false, error: msg };
  }
}

export type UsoEmpresa = {
  docs_total: number;
  bytes_total: number;
  max_docs: number;
  max_bytes: number;
};

export async function getUsoEmpresa(): Promise<{ ok: boolean; data?: UsoEmpresa; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("v_documentos_uso")
      .select("docs_total, bytes_total")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;

    return {
      ok: true,
      data: {
        docs_total: (data?.docs_total as number) ?? 0,
        bytes_total: (data?.bytes_total as number) ?? 0,
        max_docs: MAX_DOCS_EMPRESA,
        max_bytes: MAX_BYTES_EMPRESA,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] getUsoEmpresa:", msg);
    return { ok: false, error: msg };
  }
}
