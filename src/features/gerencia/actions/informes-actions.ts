"use server";

import { createClient } from "@/lib/supabase/server";
import { INFORME_TIPOS, type InformeRow, type InformeTipo } from "@/features/gerencia/data/informes";

const BUCKET = "gerencia-informes";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

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

export async function listInformes(): Promise<
  { ok: true; data: InformeRow[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("informes_gerencia")
      .select("id, tipo, fecha, importe, observaciones, storage_path, file_name, size_bytes, mime_type, registrado_por, created_at")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false });

    if (error) {
      console.error("[informes:list] error:", error.message);
      return { ok: false, error: error.message };
    }

    const rows: InformeRow[] = [];
    for (const r of data ?? []) {
      let url: string | null = null;
      const sp = r.storage_path as string | null;
      if (sp) {
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(sp, SIGNED_URL_TTL_SECONDS);
        if (signed.data?.signedUrl) url = signed.data.signedUrl;
      }
      rows.push({
        id: r.id as string,
        tipo: ((r.tipo as string) ?? "descuentos") as InformeTipo,
        fecha: ((r.fecha as string) ?? "").slice(0, 10),
        importe: Number(r.importe ?? 0),
        observaciones: (r.observaciones as string | null) ?? null,
        storage_path: sp,
        file_name: (r.file_name as string | null) ?? null,
        size_bytes: (r.size_bytes as number | null) ?? null,
        mime_type: (r.mime_type as string | null) ?? null,
        registrado_por: (r.registrado_por as string | null) ?? null,
        url,
        created_at: (r.created_at as string) ?? "",
      });
    }
    return { ok: true, data: rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[informes:list] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function createInforme(
  formData: FormData
): Promise<{ ok: true; data: InformeRow } | { ok: false; error: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const tipo = ((formData.get("tipo") as string | null) || "").trim() as InformeTipo;
    const fecha = ((formData.get("fecha") as string | null) || "").trim();
    const importeStr = ((formData.get("importe") as string | null) || "0").trim();
    const observaciones = ((formData.get("observaciones") as string | null) || "").trim();
    const registradoPor = ((formData.get("registrado_por") as string | null) || "").trim();
    const file = formData.get("file") as File | null;

    if (!tipo || !INFORME_TIPOS.some((t) => t.value === tipo)) {
      return { ok: false, error: "Tipo de informe no válido" };
    }
    if (!fecha) return { ok: false, error: "La fecha es obligatoria" };

    const importe = Number(importeStr.replace(",", ".")) || 0;

    const { data: row, error: dbErr } = await supabase
      .from("informes_gerencia")
      .insert({
        empresa_id: empresaId,
        tipo,
        fecha,
        importe,
        observaciones: observaciones || null,
        registrado_por: registradoPor || null,
        registrado_por_uid: user.id,
      })
      .select("id, created_at")
      .single();

    if (dbErr || !row) {
      console.error("[informes:create] db:", dbErr?.message);
      return { ok: false, error: dbErr?.message ?? "No se pudo crear el informe" };
    }

    const informeId = row.id as string;
    let storagePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;
    let signedUrl: string | null = null;

    if (file && file.size > 0) {
      const safe = sanitizeFilename(file.name);
      const sp = `${empresaId}/${informeId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(sp, file, { upsert: false, contentType: file.type || "application/octet-stream" });

      if (upErr) {
        console.error("[informes:create] storage:", upErr.message);
      } else {
        storagePath = sp;
        fileName = file.name;
        fileSize = file.size;
        mimeType = file.type || null;

        const { error: updErr } = await supabase
          .from("informes_gerencia")
          .update({
            storage_path: storagePath,
            file_name: fileName,
            size_bytes: fileSize,
            mime_type: mimeType,
            updated_at: new Date().toISOString(),
          })
          .eq("id", informeId);
        if (updErr) console.error("[informes:create] update path:", updErr.message);

        const signed = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
        signedUrl = signed.data?.signedUrl ?? null;
      }
    }

    return {
      ok: true,
      data: {
        id: informeId,
        tipo,
        fecha,
        importe,
        observaciones: observaciones || null,
        storage_path: storagePath,
        file_name: fileName,
        size_bytes: fileSize,
        mime_type: mimeType,
        registrado_por: registradoPor || null,
        url: signedUrl,
        created_at: (row.created_at as string) ?? new Date().toISOString(),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[informes:create] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteInforme(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row } = await supabase
      .from("informes_gerencia")
      .select("storage_path")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    if (row?.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
    }

    const { error } = await supabase
      .from("informes_gerencia")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[informes:delete] db:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[informes:delete] excepción:", msg);
    return { ok: false, error: msg };
  }
}
