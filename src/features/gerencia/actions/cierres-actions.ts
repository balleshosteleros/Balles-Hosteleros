"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
const BUCKET = "cierres-documentos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type CierreModo = "fijo" | "libre";

// Tipo de movimiento registrado en el submódulo Cierres.
export type CierreTipo = "cierre" | "retirada" | "ingreso";

export interface CierreGasto {
  id?: string;
  tipo: string;
  descripcion: string;
  importe: number;
}

export interface CierreRow {
  id: string;
  tipo: CierreTipo;
  fecha: string;
  semana_iso: string | null;
  efectivo_retirado: number;
  total_contado: number;
  cuadra: boolean;
  descuadre: number;
  notas: string | null;
  storage_path: string | null;
  file_name: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  registrado_por: string | null;
  url: string | null;
  gastos: CierreGasto[];
  total_gastos: number;
  created_at: string;
}

export interface CierresConfig {
  modo: CierreModo;
  dia_semana: number | null;
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
return { supabase, user, empresaId };
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function listCierres(): Promise<{ ok: true; data: CierreRow[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("cierres_semanales")
      .select("id, tipo, fecha, semana_iso, efectivo_retirado, total_contado, cuadra, descuadre, notas, storage_path, file_name, size_bytes, mime_type, registrado_por, created_at")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false });

    if (error) {
      console.error("[cierres:list] error:", error.message);
      return { ok: false, error: error.message };
    }

    // Gastos de todos los cierres de la empresa, agrupados por cierre_id.
    const gastosPorCierre: Record<string, CierreGasto[]> = {};
    {
      const { data: gData, error: gErr } = await supabase
        .from("cierres_gastos")
        .select("id, cierre_id, tipo, descripcion, importe")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: true });
      if (gErr) {
        console.error("[cierres:list] gastos:", gErr.message);
      } else {
        for (const g of gData ?? []) {
          const cid = g.cierre_id as string;
          (gastosPorCierre[cid] ??= []).push({
            id: g.id as string,
            tipo: (g.tipo as string | null) ?? "",
            descripcion: (g.descripcion as string | null) ?? "",
            importe: Number(g.importe ?? 0),
          });
        }
      }
    }

    const rows: CierreRow[] = [];
    for (const r of data ?? []) {
      let url: string | null = null;
      const sp = r.storage_path as string | null;
      if (sp) {
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(sp, SIGNED_URL_TTL_SECONDS);
        if (signed.data?.signedUrl) url = signed.data.signedUrl;
      }
      rows.push({
        id: r.id as string,
        tipo: (((r.tipo as string | null) ?? "cierre") as CierreTipo),
        fecha: ((r.fecha as string) ?? "").slice(0, 10),
        semana_iso: (r.semana_iso as string | null) ?? null,
        efectivo_retirado: Number(r.efectivo_retirado ?? 0),
        total_contado: Number(r.total_contado ?? 0),
        cuadra: Boolean(r.cuadra),
        descuadre: Number(r.descuadre ?? 0),
        notas: (r.notas as string | null) ?? null,
        storage_path: sp,
        file_name: (r.file_name as string | null) ?? null,
        size_bytes: (r.size_bytes as number | null) ?? null,
        mime_type: (r.mime_type as string | null) ?? null,
        registrado_por: (r.registrado_por as string | null) ?? null,
        url,
        gastos: gastosPorCierre[r.id as string] ?? [],
        total_gastos: (gastosPorCierre[r.id as string] ?? []).reduce((s, g) => s + g.importe, 0),
        created_at: (r.created_at as string) ?? "",
      });
    }
    return { ok: true, data: rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:list] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function createCierre(formData: FormData): Promise<{ ok: true; data: CierreRow } | { ok: false; error: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const tipoRaw = ((formData.get("tipo") as string | null) || "cierre").trim();
    const tipo: CierreTipo = tipoRaw === "retirada" || tipoRaw === "ingreso" ? tipoRaw : "cierre";
    const fecha = ((formData.get("fecha") as string | null) || "").trim();
    const efectivoStr = ((formData.get("efectivo_retirado") as string | null) || "0").trim();
    const contadoStr = ((formData.get("total_contado") as string | null) || "0").trim();
    const notas = ((formData.get("notas") as string | null) || "").trim();
    const registradoPor = ((formData.get("registrado_por") as string | null) || "").trim();
    const file = formData.get("file") as File | null;

    if (!fecha) return { ok: false, error: "La fecha es obligatoria" };

    // Gastos de la semana (registro informativo, no altera el descuadre).
    let gastosInput: CierreGasto[] = [];
    const gastosRaw = (formData.get("gastos") as string | null) || "";
    if (gastosRaw) {
      try {
        const parsed = JSON.parse(gastosRaw) as unknown;
        if (Array.isArray(parsed)) {
          gastosInput = parsed
            .map((g) => {
              const o = g as Record<string, unknown>;
              const tipo = String(o.tipo ?? "").trim();
              const descripcion = String(o.descripcion ?? "").trim();
              const importe = Number(String(o.importe ?? "0").replace(",", ".")) || 0;
              return { tipo, descripcion, importe };
            })
            // Descartar filas vacías (sin tipo/descripción y sin importe).
            .filter((g) => g.tipo || g.descripcion || g.importe !== 0);
        }
      } catch (e) {
        console.error("[cierres:create] gastos parse:", e);
      }
    }

    const efectivo = Number(efectivoStr.replace(",", ".")) || 0;
    const contado = Number(contadoStr.replace(",", ".")) || 0;
    // El descuadre SIEMPRE se calcula: contado − efectivo esperado.
    // >0 sobra · <0 falta · 0 cuadra. No se acepta valor manual.
    const descuadre = Math.round((contado - efectivo) * 100) / 100;
    const cuadra = descuadre === 0;

    const { data: row, error: dbErr } = await supabase
      .from("cierres_semanales")
      .insert({
        empresa_id: empresaId,
        tipo,
        fecha,
        semana_iso: isoWeek(fecha),
        efectivo_retirado: efectivo,
        total_contado: contado,
        cuadra,
        descuadre,
        notas: notas || null,
        registrado_por: registradoPor || null,
        registrado_por_uid: user.id,
      })
      .select("id, created_at")
      .single();

    if (dbErr || !row) {
      console.error("[cierres:create] db:", dbErr?.message);
      return { ok: false, error: dbErr?.message ?? "No se pudo crear el cierre" };
    }

    const cierreId = row.id as string;
    let storagePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;
    let signedUrl: string | null = null;

    if (file && file.size > 0) {
      const safe = sanitizeFilename(file.name);
      const sp = `${empresaId}/${cierreId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(sp, file, { upsert: false, contentType: file.type || "application/octet-stream" });

      if (upErr) {
        console.error("[cierres:create] storage:", upErr.message);
      } else {
        storagePath = sp;
        fileName = file.name;
        fileSize = file.size;
        mimeType = file.type || null;

        const { error: updErr } = await supabase
          .from("cierres_semanales")
          .update({
            storage_path: storagePath,
            file_name: fileName,
            size_bytes: fileSize,
            mime_type: mimeType,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cierreId);
        if (updErr) console.error("[cierres:create] update path:", updErr.message);

        const signed = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
        signedUrl = signed.data?.signedUrl ?? null;
      }
    }

    // Insertar los gastos de la semana asociados al cierre.
    let gastosGuardados: CierreGasto[] = [];
    if (gastosInput.length > 0) {
      const { data: gRows, error: gErr } = await supabase
        .from("cierres_gastos")
        .insert(
          gastosInput.map((g) => ({
            cierre_id: cierreId,
            empresa_id: empresaId,
            tipo: g.tipo,
            descripcion: g.descripcion || null,
            importe: g.importe,
          })),
        )
        .select("id, tipo, descripcion, importe");
      if (gErr) {
        console.error("[cierres:create] gastos insert:", gErr.message);
      } else {
        gastosGuardados = (gRows ?? []).map((g) => ({
          id: g.id as string,
          tipo: (g.tipo as string | null) ?? "",
          descripcion: (g.descripcion as string | null) ?? "",
          importe: Number(g.importe ?? 0),
        }));
      }
    }

    return {
      ok: true,
      data: {
        id: cierreId,
        tipo,
        fecha,
        semana_iso: isoWeek(fecha),
        efectivo_retirado: efectivo,
        total_contado: contado,
        cuadra,
        descuadre,
        notas: notas || null,
        storage_path: storagePath,
        file_name: fileName,
        size_bytes: fileSize,
        mime_type: mimeType,
        registrado_por: registradoPor || null,
        url: signedUrl,
        gastos: gastosGuardados,
        total_gastos: gastosGuardados.reduce((s, g) => s + g.importe, 0),
        created_at: (row.created_at as string) ?? new Date().toISOString(),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:create] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCierre(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row } = await supabase
      .from("cierres_semanales")
      .select("storage_path")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    if (row?.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
    }

    const { error } = await supabase
      .from("cierres_semanales")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[cierres:delete] db:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:delete] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function getCierresConfig(): Promise<{ ok: true; data: CierresConfig } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("cierres_config")
      .select("modo, dia_semana")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error) {
      console.error("[cierres:cfg:get]", error.message);
      return { ok: false, error: error.message };
    }

    if (!data) {
      return { ok: true, data: { modo: "libre", dia_semana: null } };
    }

    return {
      ok: true,
      data: {
        modo: ((data.modo as string) ?? "libre") as CierreModo,
        dia_semana: (data.dia_semana as number | null) ?? null,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:cfg:get] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCierresConfig(input: { modo: CierreModo; dia_semana: number | null }): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const dia = input.modo === "fijo" ? input.dia_semana : null;

    const { error } = await supabase
      .from("cierres_config")
      .upsert(
        {
          empresa_id: empresaId,
          modo: input.modo,
          dia_semana: dia,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id" }
      );

    if (error) {
      console.error("[cierres:cfg:set]", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:cfg:set] excepción:", msg);
    return { ok: false, error: msg };
  }
}
