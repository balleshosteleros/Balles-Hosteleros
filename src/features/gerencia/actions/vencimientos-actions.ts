"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { CATALOGO_VENCIMIENTOS, MESES_PERIODICIDAD, type PeriodicidadVencimiento } from "@/features/gerencia/data/catalogo-vencimientos";

export interface VencimientoRow {
  id: string;
  clave: string | null;
  nombre: string;
  ambito: string;
  periodicidad: string;
  fecha_ultima: string | null;
  fecha_vencimiento: string | null;
  responsable: string | null;
  proveedor: string | null;
  coste: number | null;
  notas: string | null;
  activo: boolean;
}

export interface HistorialRow {
  id: string;
  revision_id: string;
  fecha: string;
  resultado: string;
  realizado_por: string | null;
  observaciones: string | null;
  documento_url: string | null;
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/** Suma la periodicidad a una fecha para saber cuándo toca la siguiente. */
function calcularProximoVencimiento(desde: string, periodicidad: string): string | null {
  const meses = MESES_PERIODICIDAD[periodicidad as PeriodicidadVencimiento];
  if (meses === null || meses === undefined) return null;
  const fecha = new Date(`${desde}T00:00:00`);
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.toISOString().slice(0, 10);
}

export async function listVencimientos(): Promise<{ ok: boolean; data: VencimientoRow[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("revisiones")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as VencimientoRow[] };
  } catch (err) {
    console.error("[vencimientos] listVencimientos:", err);
    return { ok: false, data: [] };
  }
}

export async function listHistorial(revisionId: string): Promise<{ ok: boolean; data: HistorialRow[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("revisiones_historial")
      .select("*")
      .eq("revision_id", revisionId)
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as HistorialRow[] };
  } catch (err) {
    console.error("[vencimientos] listHistorial:", err);
    return { ok: false, data: [] };
  }
}

/**
 * Crea en la empresa las obligaciones del catálogo que todavía no existen.
 * Es idempotente: se puede llamar tantas veces como haga falta.
 */
export async function sembrarCatalogo(): Promise<{ ok: boolean; creadas: number; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, creadas: 0, error: "No autenticado" };

    const { data: existentes, error: errExist } = await supabase
      .from("revisiones")
      .select("clave")
      .eq("empresa_id", empresaId);
    if (errExist) throw errExist;

    const yaEstan = new Set((existentes ?? []).map((r) => r.clave));
    const nuevas = CATALOGO_VENCIMIENTOS.filter((c) => !yaEstan.has(c.clave)).map((c) => ({
      empresa_id: empresaId,
      clave: c.clave,
      nombre: c.nombre,
      ambito: c.ambito,
      periodicidad: c.periodicidad,
      fecha_ultima: null,
      fecha_vencimiento: null,
      responsable: null,
      proveedor: null,
      notas: null,
      activo: true,
    }));

    if (nuevas.length === 0) return { ok: true, creadas: 0 };

    const { error } = await supabase.from("revisiones").insert(nuevas);
    if (error) throw error;
    return { ok: true, creadas: nuevas.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] sembrarCatalogo:", msg);
    return { ok: false, creadas: 0, error: msg };
  }
}

export async function createVencimiento(input: {
  nombre: string;
  ambito: string;
  periodicidad: string;
  fecha_vencimiento?: string | null;
  responsable?: string | null;
  proveedor?: string | null;
  notas?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" };

    const { error } = await supabase.from("revisiones").insert({
      empresa_id: empresaId,
      clave: null,
      nombre: input.nombre.trim(),
      ambito: input.ambito,
      periodicidad: input.periodicidad,
      fecha_vencimiento: input.fecha_vencimiento || null,
      responsable: input.responsable || null,
      proveedor: input.proveedor || null,
      notas: input.notas || null,
      activo: true,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] createVencimiento:", msg);
    return { ok: false, error: msg };
  }
}


/**
 * Anota una revisión realizada: la guarda en el historial y recalcula
 * automáticamente cuándo toca la siguiente según su periodicidad.
 */
export async function registrarRevision(input: {
  revision_id: string;
  fecha: string;
  resultado: string;
  realizado_por?: string | null;
  observaciones?: string | null;
  documento_url?: string | null;
}): Promise<{ ok: boolean; proximaFecha?: string | null; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: revision, error: errRev } = await supabase
      .from("revisiones")
      .select("id, periodicidad")
      .eq("id", input.revision_id)
      .eq("empresa_id", empresaId)
      .single();
    if (errRev) throw errRev;

    const { error: errHist } = await supabase.from("revisiones_historial").insert({
      revision_id: input.revision_id,
      empresa_id: empresaId,
      fecha: input.fecha,
      resultado: input.resultado,
      realizado_por: input.realizado_por || null,
      observaciones: input.observaciones || null,
      documento_url: input.documento_url || null,
      created_by: user?.id ?? null,
    });
    if (errHist) throw errHist;

    const proximaFecha = calcularProximoVencimiento(input.fecha, revision.periodicidad);
    const { error: errUpd } = await supabase
      .from("revisiones")
      .update({
        fecha_ultima: input.fecha,
        fecha_vencimiento: proximaFecha,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.revision_id)
      .eq("empresa_id", empresaId);
    if (errUpd) throw errUpd;

    return { ok: true, proximaFecha };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] registrarRevision:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Documentos oficiales del vencimiento ───────────────────────────────────
// El acta del extintor, la licencia de terraza, la póliza... Suelen ser PDF
// escaneados y pesados, así que el navegador los sube DIRECTO al bucket con una
// URL firmada: así no pasan por la Server Action (limitada a 4,5 MB de body).

const BUCKET_DOCS = "vencimientos-docs";

export interface DocumentoVencimiento {
  id: string;
  path: string;
  nombre: string;
  tamano: number | null;
  mime: string | null;
  created_at: string;
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

export async function listDocumentos(
  vencimientoId: string,
): Promise<{ ok: boolean; data: DocumentoVencimiento[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("vencimientos_documentos")
      .select("id, path, nombre, tamano, mime, created_at")
      .eq("vencimiento_id", vencimientoId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as DocumentoVencimiento[] };
  } catch (err) {
    console.error("[vencimientos] listDocumentos:", err);
    return { ok: false, data: [] };
  }
}

/** URLs firmadas para que el navegador suba cada archivo directo al bucket. */
export async function crearUrlsSubidaDocumentos(
  vencimientoId: string,
  archivos: Array<{ name: string }>,
): Promise<{ ok: boolean; data?: Array<{ token: string; path: string }>; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!archivos?.length) return { ok: false, error: "No hay archivos que subir" };

    const salida: Array<{ token: string; path: string }> = [];
    for (const [i, a] of archivos.entries()) {
      const safe = sanitizeFilename(a.name || "documento");
      const path = `${empresaId}/${vencimientoId}/${Date.now()}_${i}_${safe}`;
      const { data, error } = await supabase.storage
        .from(BUCKET_DOCS)
        .createSignedUploadUrl(path);
      if (error || !data) {
        console.error("[vencimientos] signedUpload:", error?.message);
        return { ok: false, error: "No se pudo preparar la subida" };
      }
      salida.push({ token: data.token, path: data.path });
    }
    return { ok: true, data: salida };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] crearUrlsSubidaDocumentos:", msg);
    return { ok: false, error: msg };
  }
}

/** Registra en BD los archivos que el navegador ya subió al bucket. */
export async function guardarDocumentos(
  vencimientoId: string,
  docs: Array<{ path: string; nombre: string; tamano: number; mime: string | null }>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!docs?.length) return { ok: true };

    const { error } = await supabase.from("vencimientos_documentos").insert(
      docs.map((d) => ({
        vencimiento_id: vencimientoId,
        empresa_id: empresaId,
        path: d.path,
        nombre: d.nombre,
        tamano: d.tamano,
        mime: d.mime,
        subido_por: user?.id ?? null,
      })),
    );
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] guardarDocumentos:", msg);
    return { ok: false, error: msg };
  }
}

/** Enlace temporal para abrir o descargar un documento. */
export async function getUrlDocumento(
  documentoId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: doc, error: errDoc } = await supabase
      .from("vencimientos_documentos")
      .select("path")
      .eq("id", documentoId)
      .eq("empresa_id", empresaId)
      .single();
    if (errDoc || !doc) return { ok: false, error: "Documento no encontrado" };

    const { data, error } = await supabase.storage
      .from(BUCKET_DOCS)
      .createSignedUrl(doc.path as string, 300);
    if (error || !data) return { ok: false, error: "No se pudo abrir el documento" };
    return { ok: true, url: data.signedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] getUrlDocumento:", msg);
    return { ok: false, error: msg };
  }
}

export async function borrarDocumento(
  documentoId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: doc } = await supabase
      .from("vencimientos_documentos")
      .select("path")
      .eq("id", documentoId)
      .eq("empresa_id", empresaId)
      .single();

    const { error } = await supabase
      .from("vencimientos_documentos")
      .delete()
      .eq("id", documentoId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    // El fichero del bucket se borra después: si fallara, la fila ya no existe
    // y el huérfano no molesta a nadie.
    if (doc?.path) {
      await supabase.storage.from(BUCKET_DOCS).remove([doc.path as string]);
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] borrarDocumento:", msg);
    return { ok: false, error: msg };
  }
}
