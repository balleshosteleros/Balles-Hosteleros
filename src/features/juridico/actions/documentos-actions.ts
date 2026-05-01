"use server";

import { createClient } from "@/lib/supabase/server";
import type { CategoriaDocumento, DocumentoProceso } from "@/features/juridico/data/procesos-juridicos";

const BUCKET = "juridico-documentos";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: (data?.empresa_id as string | null) ?? null };
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

export interface DocumentoJuridicoRow {
  id: string;
  proceso_id: string;
  actualizacion_id: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaDocumento;
  url: string;          // signed URL on read
  storage_path: string | null;
  tipo_mime: string | null;
  size_bytes: number | null;
  subido_por: string | null;
  fechaSubida: string;  // ISO date
}

export async function listDocumentosByProceso(procesoId: string): Promise<{ ok: true; data: DocumentoProceso[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("documentos_juridicos")
      .select("id, proceso_id, actualizacion_id, nombre, descripcion, categoria, url, storage_path, tipo_mime, subido_por, created_at")
      .eq("proceso_id", procesoId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[juridico:docs:list] error:", error.message, error.code);
      return { ok: false, error: error.message };
    }

    const docs: DocumentoProceso[] = [];
    for (const row of data ?? []) {
      let url = (row.url as string | null) ?? "#";
      const path = row.storage_path as string | null;
      if (path) {
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (signed.data?.signedUrl) url = signed.data.signedUrl;
      }
      docs.push({
        id: row.id as string,
        nombre: (row.nombre as string) ?? "",
        descripcion: (row.descripcion as string) ?? "",
        categoria: ((row.categoria as string) ?? "Otro") as CategoriaDocumento,
        url,
        tipo: (row.tipo_mime as string) ?? "",
        subidoPor: (row.subido_por as string) ?? "",
        fechaSubida: ((row.created_at as string) ?? "").slice(0, 10),
        actualizacionId: (row.actualizacion_id as string | null) ?? undefined,
      });
    }
    return { ok: true, data: docs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[juridico:docs:list] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function uploadDocumentoJuridico(formData: FormData): Promise<{ ok: true; data: DocumentoProceso } | { ok: false; error: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const file = formData.get("file") as File | null;
    const procesoId = formData.get("proceso_id") as string | null;
    const actualizacionId = (formData.get("actualizacion_id") as string | null) || null;
    const nombre = ((formData.get("nombre") as string | null) || "").trim();
    const descripcion = ((formData.get("descripcion") as string | null) || "").trim();
    const categoria = ((formData.get("categoria") as string | null) || "Otro") as CategoriaDocumento;
    const subidoPor = ((formData.get("subido_por") as string | null) || "").trim();

    if (!file || file.size === 0) return { ok: false, error: "No se recibió ningún archivo." };
    if (!procesoId) return { ok: false, error: "Falta proceso_id" };
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };

    const safe = sanitizeFilename(file.name);
    const path = `${empresaId}/${procesoId}/${Date.now()}_${safe}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });

    if (upErr) {
      console.error("[juridico:docs:upload] storage:", upErr.message);
      return { ok: false, error: `No se pudo subir el archivo: ${upErr.message}` };
    }

    const { data: row, error: dbErr } = await supabase
      .from("documentos_juridicos")
      .insert({
        empresa_id: empresaId,
        proceso_id: procesoId,
        actualizacion_id: actualizacionId,
        nombre,
        descripcion: descripcion || null,
        categoria,
        url: null,
        storage_path: path,
        tipo_mime: file.type || null,
        size_bytes: file.size,
        subido_por: subidoPor || null,
        subido_por_uid: user.id,
        estado: "Pendiente revisar",
      })
      .select("id, created_at")
      .single();

    if (dbErr || !row) {
      // Rollback storage upload
      await supabase.storage.from(BUCKET).remove([path]);
      const msg = dbErr?.message ?? "Error al guardar documento";
      console.error("[juridico:docs:upload] db:", msg, dbErr?.code);
      return { ok: false, error: msg };
    }

    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    const signedUrl = signed.data?.signedUrl ?? "#";

    return {
      ok: true,
      data: {
        id: row.id as string,
        nombre,
        descripcion,
        categoria,
        url: signedUrl,
        tipo: file.type || "",
        subidoPor,
        fechaSubida: ((row.created_at as string) ?? new Date().toISOString()).slice(0, 10),
        actualizacionId: actualizacionId ?? undefined,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[juridico:docs:upload] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteDocumentoJuridico(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row, error: selErr } = await supabase
      .from("documentos_juridicos")
      .select("storage_path, empresa_id")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    if (selErr || !row) return { ok: false, error: selErr?.message ?? "Documento no encontrado" };

    if (row.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
    }

    const { error: delErr } = await supabase
      .from("documentos_juridicos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (delErr) {
      console.error("[juridico:docs:delete] db:", delErr.message);
      return { ok: false, error: delErr.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[juridico:docs:delete] excepción:", msg);
    return { ok: false, error: msg };
  }
}
