"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  bloqueLocalInicial,
  bloqueOcupacionInicial,
  crearFacturacionInicial,
  imagenMarcaInicial,
  normalizeBloqueOcupacion,
  normalizeFacturacion,
  propuestaGastronomicaInicial,
  type BloqueLocal,
  type BloqueOcupacion,
  type CategoriaFotoLocal,
  type DatosProyecto,
  type EstadoActividad,
  type EstadoViabilidad,
  type EstructuraCostes,
  type EstructuraFacturacion,
  type FotoEstudio,
  type ImagenMarcaEstudio,
  type LineaProcedencia,
  type LineaDestino,
  type LineaAmortizacion,
  type PropuestaGastronomica,
} from "@/features/direccion/data/aperturas";

const BUCKET = "estudios-apertura-fotos";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const MAX_FOTO_BYTES = 10 * 1024 * 1024; // 10 MB

/* Categorías válidas para subpath en bucket. */
const CATEGORIAS_FOTO_VALIDAS = new Set<string>([
  "fachada", "interior", "barra", "terraza", "cocina",
  "aseos", "almacen", "parking", "otras",
  "marca", "gastronomia",
]);

export type EstudioRow = {
  id: string;
  nombre: string;
  ciudad: string;
  zona: string;
  datos: DatosProyecto;
  facturacion: EstructuraFacturacion;
  costes: EstructuraCostes;
  procedencia: LineaProcedencia[];
  destinos: LineaDestino[];
  amortizacion: LineaAmortizacion[];
  foto_path: string | null;
  foto_url: string | null;
  viabilidad: EstadoViabilidad;
  actividad: EstadoActividad;
  creado: string;
  local: BloqueLocal;
  imagen_marca: ImagenMarcaEstudio;
  propuesta_gastronomica: PropuestaGastronomica;
  ocupacion: BloqueOcupacion;
};

const SELECT_COLS = "id, nombre, ciudad, zona, datos, facturacion, costes, procedencia, destinos, amortizacion, foto_path, viabilidad, actividad, creado, created_at, local, imagen_marca, propuesta_gastronomica, ocupacion";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/png":  return "png";
    case "image/jpeg": return "jpg";
    case "image/webp": return "webp";
    case "image/gif":  return "gif";
    case "image/heic": return "heic";
    case "image/heif": return "heif";
    default: return "bin";
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/* Refirma todos los path → url de un BloqueLocal o ImagenMarcaEstudio o
   PropuestaGastronomica. Mutación profunda devolviendo nuevo objeto. */
async function firmaUrlsLocal(supabase: SupabaseClient, local: BloqueLocal): Promise<BloqueLocal> {
  const next: BloqueLocal = {
    caracteristicas: local.caracteristicas,
    ubicacion: local.ubicacion,
    fotos: {
      fachada: [], interior: [], barra: [], terraza: [], cocina: [],
      aseos: [], almacen: [], parking: [], otras: [],
    },
  };
  for (const cat of Object.keys(next.fotos) as CategoriaFotoLocal[]) {
    const fotos = local.fotos?.[cat] ?? [];
    next.fotos[cat] = await Promise.all(fotos.map(async (f) => ({
      ...f,
      url: f.path ? (await supabase.storage.from(BUCKET).createSignedUrl(f.path, SIGNED_URL_TTL_SECONDS)).data?.signedUrl ?? undefined : undefined,
    })));
  }
  return next;
}

async function firmaUrlsMarca(supabase: SupabaseClient, marca: ImagenMarcaEstudio): Promise<ImagenMarcaEstudio> {
  let logoUrl: string | undefined;
  if (marca.logoPath) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(marca.logoPath, SIGNED_URL_TTL_SECONDS);
    logoUrl = signed.data?.signedUrl ?? undefined;
  }
  return { ...marca, logoUrl };
}

async function firmaUrlsGastronomia(supabase: SupabaseClient, prop: PropuestaGastronomica): Promise<PropuestaGastronomica> {
  const platos = await Promise.all((prop.platos ?? []).map(async (p) => {
    if (!p.foto?.path) return p;
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(p.foto.path, SIGNED_URL_TTL_SECONDS);
    return { ...p, foto: { ...p.foto, url: signed.data?.signedUrl ?? undefined } };
  }));
  return { ...prop, platos };
}

async function rowToEstudio(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<EstudioRow> {
  const fotoPath = (row.foto_path as string | null) ?? null;
  let fotoUrl: string | null = null;
  if (fotoPath) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(fotoPath, SIGNED_URL_TTL_SECONDS);
    fotoUrl = signed.data?.signedUrl ?? null;
  }

  const localRaw = (row.local as BloqueLocal | null) ?? null;
  const local = localRaw && typeof localRaw === "object" && Object.keys(localRaw).length > 0
    ? { ...bloqueLocalInicial(), ...localRaw, fotos: { ...bloqueLocalInicial().fotos, ...(localRaw.fotos ?? {}) } }
    : bloqueLocalInicial();

  const marcaRaw = (row.imagen_marca as ImagenMarcaEstudio | null) ?? null;
  const marca = marcaRaw && typeof marcaRaw === "object" && Object.keys(marcaRaw).length > 0
    ? { ...imagenMarcaInicial(), ...marcaRaw }
    : imagenMarcaInicial();

  const propRaw = (row.propuesta_gastronomica as PropuestaGastronomica | null) ?? null;
  const prop = propRaw && typeof propRaw === "object" && Object.keys(propRaw).length > 0
    ? { ...propuestaGastronomicaInicial(), ...propRaw }
    : propuestaGastronomicaInicial();

  return {
    id: row.id as string,
    nombre: row.nombre as string,
    ciudad: (row.ciudad as string) ?? "",
    zona: (row.zona as string) ?? "",
    datos: (row.datos as DatosProyecto) ?? ({} as DatosProyecto),
    facturacion: normalizeFacturacion(row.facturacion),
    costes: (row.costes as EstructuraCostes) ?? ({} as EstructuraCostes),
    procedencia: (row.procedencia as LineaProcedencia[]) ?? [],
    destinos: (row.destinos as LineaDestino[]) ?? [],
    amortizacion: (row.amortizacion as LineaAmortizacion[]) ?? [],
    foto_path: fotoPath,
    foto_url: fotoUrl,
    viabilidad: ((row.viabilidad as EstadoViabilidad) ?? "viable"),
    actividad: ((row.actividad as EstadoActividad) ?? "activo"),
    creado: (row.creado as string) ?? "",
    local: await firmaUrlsLocal(supabase, local),
    imagen_marca: await firmaUrlsMarca(supabase, marca),
    propuesta_gastronomica: await firmaUrlsGastronomia(supabase, prop),
    ocupacion: normalizeBloqueOcupacion(row.ocupacion),
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    if (e.message) {
      const parts = [e.message];
      if (e.code) parts.push(`(code ${e.code})`);
      if (e.details) parts.push(`— ${e.details}`);
      return parts.join(" ");
    }
    try { return JSON.stringify(err); } catch { /* noop */ }
  }
  return "Error desconocido";
}

export async function listEstudiosApertura(): Promise<{ ok: boolean; data: EstudioRow[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data, error } = await supabase
      .from("estudios_apertura")
      .select(SELECT_COLS)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[estudios-apertura] list query:", { empresaId, error });
      return { ok: false, data: [], error: describeError(error) };
    }

    const estudios: EstudioRow[] = [];
    for (const row of data ?? []) {
      estudios.push(await rowToEstudio(supabase, row as Record<string, unknown>));
    }
    return { ok: true, data: estudios };
  } catch (err: unknown) {
    const msg = describeError(err);
    console.error("[estudios-apertura] list:", msg, err);
    return { ok: false, data: [], error: msg };
  }
}

export async function createEstudioApertura(input: {
  datos: DatosProyecto;
  facturacion?: EstructuraFacturacion;
  costes: EstructuraCostes;
  procedencia?: LineaProcedencia[];
  destinos?: LineaDestino[];
  amortizacion?: LineaAmortizacion[];
}): Promise<{ ok: true; data: EstudioRow } | { ok: false; error: string }> {
  try {
    const nombre = (input.datos?.nombre ?? "").trim();
    if (!nombre) return { ok: false, error: "El nombre del proyecto es obligatorio" };

    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("estudios_apertura")
      .insert({
        empresa_id: empresaId,
        nombre,
        ciudad: input.datos.ciudad ?? "",
        zona: input.datos.zona ?? "",
        datos: input.datos,
        facturacion: input.facturacion ?? crearFacturacionInicial(),
        costes: input.costes,
        procedencia: input.procedencia ?? [],
        destinos: input.destinos ?? [],
        amortizacion: input.amortizacion ?? [],
        local: bloqueLocalInicial(),
        imagen_marca: imagenMarcaInicial(),
        propuesta_gastronomica: propuestaGastronomicaInicial(),
        ocupacion: bloqueOcupacionInicial(),
        created_by: user.id,
      })
      .select(SELECT_COLS)
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear el estudio" };

    const estudio = await rowToEstudio(supabase, data as Record<string, unknown>);
    return { ok: true, data: estudio };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[estudios-apertura] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateEstudioApertura(
  id: string,
  patch: Partial<{
    datos: DatosProyecto;
    facturacion: EstructuraFacturacion;
    costes: EstructuraCostes;
    procedencia: LineaProcedencia[];
    destinos: LineaDestino[];
    amortizacion: LineaAmortizacion[];
    viabilidad: EstadoViabilidad;
    actividad: EstadoActividad;
    local: BloqueLocal;
    imagen_marca: ImagenMarcaEstudio;
    propuesta_gastronomica: PropuestaGastronomica;
    ocupacion: BloqueOcupacion;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const update: Record<string, unknown> = {};
    if (patch.datos) {
      update.datos = patch.datos;
      update.nombre = patch.datos.nombre ?? "";
      update.ciudad = patch.datos.ciudad ?? "";
      update.zona = patch.datos.zona ?? "";
    }
    if (patch.facturacion) update.facturacion = patch.facturacion;
    if (patch.costes) update.costes = patch.costes;
    if (patch.procedencia) update.procedencia = patch.procedencia;
    if (patch.destinos) update.destinos = patch.destinos;
    if (patch.amortizacion) update.amortizacion = patch.amortizacion;
    if (patch.viabilidad) update.viabilidad = patch.viabilidad;
    if (patch.actividad) update.actividad = patch.actividad;
    if (patch.local) update.local = patch.local;
    if (patch.imagen_marca) update.imagen_marca = patch.imagen_marca;
    if (patch.propuesta_gastronomica) update.propuesta_gastronomica = patch.propuesta_gastronomica;
    if (patch.ocupacion) update.ocupacion = patch.ocupacion;

    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase
      .from("estudios_apertura")
      .update(update)
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[estudios-apertura] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteEstudioApertura(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row, error: selErr } = await supabase
      .from("estudios_apertura")
      .select("foto_path, local, imagen_marca, propuesta_gastronomica")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (selErr) return { ok: false, error: selErr.message };

    // Borrar todas las fotos asociadas (foto principal + galería local + logo + platos)
    const paths: string[] = [];
    if (row?.foto_path) paths.push(row.foto_path as string);
    const local = (row?.local as BloqueLocal | null) ?? null;
    if (local?.fotos) {
      for (const cat of Object.keys(local.fotos) as CategoriaFotoLocal[]) {
        for (const f of local.fotos[cat] ?? []) if (f.path) paths.push(f.path);
      }
    }
    const marca = (row?.imagen_marca as ImagenMarcaEstudio | null) ?? null;
    if (marca?.logoPath) paths.push(marca.logoPath);
    const prop = (row?.propuesta_gastronomica as PropuestaGastronomica | null) ?? null;
    if (prop?.platos) {
      for (const p of prop.platos) if (p.foto?.path) paths.push(p.foto.path);
    }
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
    }

    const { error: delErr } = await supabase
      .from("estudios_apertura")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (delErr) return { ok: false, error: delErr.message };
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[estudios-apertura] delete:", msg);
    return { ok: false, error: msg };
  }
}

/** Foto principal del estudio (la portada usada en la lista). */
export async function uploadFotoEstudio(input: {
  estudioId: string;
  fileBase64: string;
  fileType: string;
  fileSize: number;
}): Promise<{ ok: true; foto_url: string; foto_path: string } | { ok: false; error: string }> {
  try {
    if (!ALLOWED_MIME.has(input.fileType)) {
      return { ok: false, error: "Tipo de imagen no permitido (PNG, JPG, WebP, GIF, HEIC)" };
    }
    if (input.fileSize <= 0) return { ok: false, error: "Archivo vacío" };
    if (input.fileSize > MAX_FOTO_BYTES) {
      return { ok: false, error: `Imagen demasiado grande. Máximo ${MAX_FOTO_BYTES / 1024 / 1024} MB.` };
    }

    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row, error: selErr } = await supabase
      .from("estudios_apertura")
      .select("id, foto_path")
      .eq("id", input.estudioId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (selErr) return { ok: false, error: selErr.message };
    if (!row) return { ok: false, error: "Estudio no encontrado en la empresa activa" };

    const oldPath = (row.foto_path as string | null) ?? null;
    const ext = mimeToExt(input.fileType);
    const fotoPath = `${empresaId}/${input.estudioId}_${Date.now()}.${ext}`;

    const base64 = input.fileBase64.includes(",")
      ? input.fileBase64.split(",")[1]
      : input.fileBase64;
    const buffer = Buffer.from(base64, "base64");

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(fotoPath, buffer, { contentType: input.fileType, upsert: true });

    if (upErr) return { ok: false, error: upErr.message };

    const { data: updated, error: dbErr } = await supabase
      .from("estudios_apertura")
      .update({ foto_path: fotoPath })
      .eq("id", input.estudioId)
      .eq("empresa_id", empresaId)
      .select("id")
      .maybeSingle();

    if (dbErr || !updated) {
      // El UPDATE no afectó a ninguna fila (RLS o empresa_id desincronizada).
      await supabase.storage.from(BUCKET).remove([fotoPath]);
      return { ok: false, error: dbErr?.message ?? "No se pudo asociar la foto al estudio (permisos o empresa)" };
    }

    if (oldPath && oldPath !== fotoPath) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }

    const signed = await supabase.storage.from(BUCKET).createSignedUrl(fotoPath, SIGNED_URL_TTL_SECONDS);
    return { ok: true, foto_url: signed.data?.signedUrl ?? "", foto_path: fotoPath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[estudios-apertura] uploadFoto:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteFotoEstudio(estudioId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row } = await supabase
      .from("estudios_apertura")
      .select("foto_path")
      .eq("id", estudioId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (row?.foto_path) {
      await supabase.storage.from(BUCKET).remove([row.foto_path as string]);
    }

    const { error } = await supabase
      .from("estudios_apertura")
      .update({ foto_path: null })
      .eq("id", estudioId)
      .eq("empresa_id", empresaId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[estudios-apertura] deleteFoto:", msg);
    return { ok: false, error: msg };
  }
}

/* ──────────────────────────────────────────────────────────────
 * Subida genérica de fotos para Local / Marca / Gastronomía.
 * `categoria` ∈ {fachada,interior,terraza,cocina,otras,marca,gastronomia}
 * Devuelve { id, path, url } y NO toca la fila — el caller persiste el
 * objeto FotoEstudio dentro del JSONB que corresponda.
 * ────────────────────────────────────────────────────────────── */
export async function uploadFotoCategoria(input: {
  estudioId: string;
  categoria: string;
  fileBase64: string;
  fileType: string;
  fileSize: number;
}): Promise<{ ok: true; foto: FotoEstudio } | { ok: false; error: string }> {
  try {
    if (!CATEGORIAS_FOTO_VALIDAS.has(input.categoria)) {
      return { ok: false, error: "Categoría de foto no válida" };
    }
    if (!ALLOWED_MIME.has(input.fileType)) {
      return { ok: false, error: "Tipo de imagen no permitido (PNG, JPG, WebP, GIF, HEIC)" };
    }
    if (input.fileSize <= 0) return { ok: false, error: "Archivo vacío" };
    if (input.fileSize > MAX_FOTO_BYTES) {
      return { ok: false, error: `Imagen demasiado grande. Máximo ${MAX_FOTO_BYTES / 1024 / 1024} MB.` };
    }

    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row, error: selErr } = await supabase
      .from("estudios_apertura")
      .select("id")
      .eq("id", input.estudioId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (selErr || !row) return { ok: false, error: "Estudio no encontrado" };

    const ext = mimeToExt(input.fileType);
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path = `${empresaId}/${input.estudioId}/${input.categoria}/${fileId}.${ext}`;

    const base64 = input.fileBase64.includes(",")
      ? input.fileBase64.split(",")[1]
      : input.fileBase64;
    const buffer = Buffer.from(base64, "base64");

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: input.fileType, upsert: true });

    if (upErr) return { ok: false, error: upErr.message };

    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return {
      ok: true,
      foto: {
        id: fileId,
        path,
        url: signed.data?.signedUrl ?? undefined,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[estudios-apertura] uploadFotoCategoria:", msg);
    return { ok: false, error: msg };
  }
}

/* Borra un único objeto del bucket (utilidad usada al quitar fotos
   individuales de Local / Marca / Gastronomía). */
export async function deleteFotoStorage(input: {
  estudioId: string;
  path: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    if (!input.path.startsWith(`${empresaId}/${input.estudioId}/`)) {
      return { ok: false, error: "Path no permitido" };
    }

    const { error } = await supabase.storage.from(BUCKET).remove([input.path]);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[estudios-apertura] deleteFotoStorage:", msg);
    return { ok: false, error: msg };
  }
}
