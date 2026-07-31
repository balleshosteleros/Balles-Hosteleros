"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { MAX_DOCUMENTOS_CIERRE } from "@/features/gerencia/types/cierres";
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

// Documento adjunto a un cierre/ingreso. Se admiten varios (máx. 3, controlado en UI/backend).
export interface CierreDocumento {
  path: string;
  name: string;
  size: number;
  mime: string | null;
  url: string | null;
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
  documentos: CierreDocumento[];
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

// Regla de cierre periódica (estilo Google Calendar): "cada N semanas, estos días".
export interface CierreProgramacion {
  id: string;
  nombre: string;
  intervalo_semanas: number;   // 1 = cada semana, 2 = quincenal, ...
  dias_semana: number[];       // 0=Lun .. 6=Dom (mismo orden que la UI)
  fecha_inicio: string;        // YYYY-MM-DD
  fecha_fin: string | null;    // null = sin fin
  activo: boolean;
}

export interface CierreProgramacionInput {
  id?: string;
  nombre: string;
  intervalo_semanas: number;
  dias_semana: number[];
  fecha_inicio: string;
  fecha_fin: string | null;
  activo: boolean;
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

// Normaliza el JSONB `documentos` a un array tipado. Si viene vacío, cae al
// documento único legacy (storage_path/file_name/...) para no perder adjuntos antiguos.
function normalizarDocumentos(
  raw: unknown,
  legacy: { path: string | null; name: string | null; size: number | null; mime: string | null },
): Array<{ path: string; name: string; size: number; mime: string | null }> {
  const out: Array<{ path: string; name: string; size: number; mime: string | null }> = [];
  if (Array.isArray(raw)) {
    for (const d of raw) {
      const o = (d ?? {}) as Record<string, unknown>;
      const path = typeof o.path === "string" ? o.path : "";
      if (!path) continue;
      out.push({
        path,
        name: typeof o.name === "string" && o.name ? o.name : "documento",
        size: Number(o.size ?? 0) || 0,
        mime: typeof o.mime === "string" ? o.mime : null,
      });
    }
  }
  if (out.length === 0 && legacy.path) {
    out.push({ path: legacy.path, name: legacy.name || "documento", size: legacy.size ?? 0, mime: legacy.mime });
  }
  return out;
}

// Genera URLs firmadas para cada documento.
async function firmarDocumentos(
  supabase: SupabaseClient,
  docs: Array<{ path: string; name: string; size: number; mime: string | null }>,
): Promise<CierreDocumento[]> {
  const out: CierreDocumento[] = [];
  for (const d of docs) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(d.path, SIGNED_URL_TTL_SECONDS);
    out.push({ ...d, url: signed.data?.signedUrl ?? null });
  }
  return out;
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
      .select("id, tipo, fecha, semana_iso, efectivo_retirado, total_contado, cuadra, descuadre, notas, storage_path, file_name, size_bytes, mime_type, documentos, registrado_por, created_at")
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
      const sp = r.storage_path as string | null;
      // Documentos adjuntos: el array JSONB `documentos`, con fallback al doc único legacy.
      const documentos = await firmarDocumentos(
        supabase,
        normalizarDocumentos(r.documentos, {
          path: sp,
          name: r.file_name as string | null,
          size: r.size_bytes as number | null,
          mime: r.mime_type as string | null,
        }),
      );
      // `url` = primer documento (compatibilidad con consumidores antiguos).
      const url = documentos[0]?.url ?? null;
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
        documentos,
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
    // Se admiten varios adjuntos: campo repetido "file" (además de "file" único legacy).
    const files = (formData.getAll("file") as unknown[])
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, MAX_DOCUMENTOS_CIERRE);

    if (!fecha) return { ok: false, error: "La fecha es obligatoria" };

    // Cierres e ingresos exigen al menos un justificante adjunto (la retirada no).
    if (tipo !== "retirada" && files.length === 0) {
      return { ok: false, error: `Debes adjuntar un documento para registrar ${tipo === "ingreso" ? "un ingreso" : "un cierre"}` };
    }

    // Gastos de la semana (registro informativo, no altera el descuadre).
    let gastosInput: CierreGasto[] = [];
    const gastosRaw = tipo === "cierre" ? ((formData.get("gastos") as string | null) || "") : "";
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
    // El total contado y el descuadre solo tienen sentido en el cierre semanal.
    // En retiradas/ingresos no hay descuadre: se guarda cuadrado (descuadre 0).
    const contado = tipo === "cierre" ? Number(contadoStr.replace(",", ".")) || 0 : 0;
    // Referencia = total cierre (lo que debe haber). Descuadre = retirado − cierre.
    // Si se retira MÁS que el cierre → sobra. Si se retira MENOS → falta.
    // >0 sobra · <0 falta · 0 cuadra. No se acepta valor manual.
    const descuadre = tipo === "cierre" ? Math.round((efectivo - contado) * 100) / 100 : 0;
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
    // Subir todos los adjuntos (máx. 3). Se recopilan en el array `documentos`.
    const documentosMeta: Array<{ path: string; name: string; size: number; mime: string | null }> = [];
    let idx = 0;
    for (const file of files) {
      const safe = sanitizeFilename(file.name);
      const sp = `${empresaId}/${cierreId}/${Date.now()}_${idx}_${safe}`;
      idx += 1;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(sp, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if (upErr) {
        console.error("[cierres:create] storage:", upErr.message);
        continue;
      }
      documentosMeta.push({ path: sp, name: file.name, size: file.size, mime: file.type || null });
    }

    if (documentosMeta.length > 0) {
      // El primer documento se refleja también en las columnas legacy por compatibilidad.
      const primero = documentosMeta[0];
      const { error: updErr } = await supabase
        .from("cierres_semanales")
        .update({
          documentos: documentosMeta,
          storage_path: primero.path,
          file_name: primero.name,
          size_bytes: primero.size,
          mime_type: primero.mime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cierreId);
      if (updErr) console.error("[cierres:create] update path:", updErr.message);
    }

    const documentos = await firmarDocumentos(supabase, documentosMeta);
    const primeroDoc = documentos[0] ?? null;
    const storagePath = primeroDoc ? documentosMeta[0].path : null;
    const fileName = primeroDoc?.name ?? null;
    const fileSize = primeroDoc?.size ?? null;
    const mimeType = primeroDoc?.mime ?? null;
    const signedUrl = primeroDoc?.url ?? null;

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
        documentos,
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
      .select("storage_path, documentos")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    // Recopilar todas las rutas a borrar (array `documentos` + doc legacy), sin duplicados.
    const paths = new Set<string>();
    if (Array.isArray(row?.documentos)) {
      for (const d of row!.documentos as unknown[]) {
        const p = (d as Record<string, unknown>)?.path;
        if (typeof p === "string" && p) paths.add(p);
      }
    }
    if (row?.storage_path) paths.add(row.storage_path as string);
    if (paths.size > 0) {
      await supabase.storage.from(BUCKET).remove([...paths]);
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

// ── Programaciones periódicas de cierre ──────────────────────

function normalizarDias(dias: unknown): number[] {
  if (!Array.isArray(dias)) return [];
  const set = new Set<number>();
  for (const d of dias) {
    const n = Number(d);
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export async function listCierresProgramaciones(): Promise<{ ok: true; data: CierreProgramacion[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("cierres_programaciones")
      .select("id, nombre, intervalo_semanas, dias_semana, fecha_inicio, fecha_fin, activo")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[cierres:prog:list]", error.message);
      return { ok: false, error: error.message };
    }

    const rows: CierreProgramacion[] = (data ?? []).map((r) => ({
      id: r.id as string,
      nombre: ((r.nombre as string | null) ?? "Cierre").trim() || "Cierre",
      intervalo_semanas: Number(r.intervalo_semanas ?? 1) || 1,
      dias_semana: normalizarDias(r.dias_semana),
      fecha_inicio: ((r.fecha_inicio as string) ?? "").slice(0, 10),
      fecha_fin: r.fecha_fin ? ((r.fecha_fin as string).slice(0, 10)) : null,
      activo: Boolean(r.activo),
    }));
    return { ok: true, data: rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:prog:list] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function upsertCierreProgramacion(input: CierreProgramacionInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const dias = normalizarDias(input.dias_semana);
    if (dias.length === 0) return { ok: false, error: "Elige al menos un día de la semana" };
    if (!input.fecha_inicio) return { ok: false, error: "La fecha de inicio es obligatoria" };
    const intervalo = Math.min(52, Math.max(1, Math.round(Number(input.intervalo_semanas) || 1)));
    if (input.fecha_fin && input.fecha_fin < input.fecha_inicio) {
      return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio" };
    }

    const payload = {
      empresa_id: empresaId,
      nombre: (input.nombre || "").trim() || "Cierre",
      intervalo_semanas: intervalo,
      dias_semana: dias,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin || null,
      activo: input.activo,
      updated_at: new Date().toISOString(),
    };

    const q = input.id
      ? supabase.from("cierres_programaciones").update(payload).eq("id", input.id).eq("empresa_id", empresaId)
      : supabase.from("cierres_programaciones").insert(payload);

    const { error } = await q;
    if (error) {
      console.error("[cierres:prog:upsert]", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:prog:upsert] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCierreProgramacion(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { error } = await supabase
      .from("cierres_programaciones")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[cierres:prog:delete]", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:prog:delete] excepción:", msg);
    return { ok: false, error: msg };
  }
}
