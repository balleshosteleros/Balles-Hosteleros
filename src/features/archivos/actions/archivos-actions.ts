"use server";

/**
 * PRP-079 — Archivos: el Drive propio del software.
 *
 * Reglas de visibilidad (decisión de Iván, 2026-08-27):
 *  · Una carpeta raíz por departamento, creada automáticamente por la BD.
 *  · La carpeta SOLO aparece si el rol tiene ese departamento visible. Si no,
 *    no sale en la lista: no existe para ese usuario (ni en gris ni con
 *    candado).
 *  · Ver, descargar, subir y crear subcarpetas: todo el que vea el
 *    departamento. BORRAR un archivo: solo quien lo subió (o DIRECCIÓN).
 *
 * El filtro por departamento se resuelve SIEMPRE en servidor con
 * `bh_departamentos_usuario`, que lee `empresa_roles.permisos[].ver` — la misma
 * fuente de verdad que el resto del software. La RLS aísla la empresa, pero NO
 * el departamento: por eso nunca se confía en el cliente para esto.
 *
 * OJO con los nombres: `bh_departamentos_usuario` devuelve claves CANÓNICAS
 * (bh_canon), donde "RECURSOS HUMANOS" es "RRHH" y "LOGÍSTICA" es "LOGISTICA".
 * Por eso `carpetas_documentos.departamento` guarda la clave canónica y
 * `nombre` el texto legible. Comparar contra el nombre largo hacía que RRHH no
 * viera su propia carpeta.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { presignPutR2, deleteObjectR2 } from "@/shared/lib/r2";
import {
  MAX_BYTES_ARCHIVO,
  MIME_PERMITIDOS,
  type Archivo,
  type Carpeta,
  type ContenidoCarpeta,
  type PresignOutput,
  type RegistrarArchivoInput,
} from "@/features/archivos/types";

type Ctx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  empresaId: string;
  /** Departamentos visibles para el rol, en clave canónica. */
  departamentos: string[];
  esDireccion: boolean;
};

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

const fallo = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Contexto de la petición: usuario, empresa activa y departamentos visibles. */
async function getContext(): Promise<Ctx | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return null;

  const { data } = await supabase.rpc("bh_departamentos_usuario", {
    p_empresa: empresaId,
  });
  const departamentos = Array.isArray(data)
    ? [...new Set((data as string[]).filter(Boolean).map(normalizar))]
    : [];

  return {
    supabase,
    userId: user.id,
    empresaId,
    departamentos,
    esDireccion: departamentos.includes("DIRECCION"),
  };
}

/** Sin acentos ni mayúsculas, para comparar claves de departamento. */
function normalizar(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

function veDepartamento(ctx: Ctx, departamento: string): boolean {
  return ctx.departamentos.includes(normalizar(departamento));
}

/** Nombre seguro para usarlo como segmento de ruta en R2. */
function sanitizar(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

/* ─────────────────────────────────────────────────────────────────────────
 * LECTURA
 * ────────────────────────────────────────────────────────────────────────*/

type FilaCarpeta = {
  id: string;
  nombre: string;
  parent_id: string | null;
  departamento: string | null;
  es_raiz: boolean;
  created_at: string;
};

const aCarpeta = (f: FilaCarpeta): Carpeta => ({
  id: f.id,
  nombre: f.nombre,
  parentId: f.parent_id,
  departamento: f.departamento ?? "",
  esRaiz: f.es_raiz,
  createdAt: f.created_at,
});

const COLS_CARPETA = "id, nombre, parent_id, departamento, es_raiz, created_at";
const COLS_ARCHIVO =
  "id, carpeta_id, departamento, nombre, r2_key, miniatura_key, tipo_mime, tamano_bytes, ancho, alto, duracion_seg, subido_por, created_at";

/**
 * Carpetas raíz VISIBLES: una por departamento que el rol pueda ver. Las demás
 * ni se devuelven.
 */
export async function listCarpetasRaiz(): Promise<Res<Carpeta[]>> {
  try {
    const ctx = await getContext();
    if (!ctx) return fallo("No autenticado");
    if (ctx.departamentos.length === 0) return { ok: true, data: [] };

    const { data, error } = await ctx.supabase
      .from("carpetas_documentos")
      .select(COLS_CARPETA)
      .eq("empresa_id", ctx.empresaId)
      .eq("es_raiz", true)
      .order("nombre");
    if (error) throw error;

    const visibles = (data as FilaCarpeta[])
      .filter((c) => c.departamento && veDepartamento(ctx, c.departamento))
      .map(aCarpeta);

    return { ok: true, data: visibles };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] listCarpetasRaiz:", msg);
    return fallo(msg);
  }
}

/**
 * Contenido de una carpeta: miga de pan, subcarpetas y archivos. Comprueba que
 * el usuario ve el departamento al que pertenece la carpeta.
 */
export async function getContenidoCarpeta(
  carpetaId: string,
): Promise<Res<ContenidoCarpeta>> {
  try {
    const ctx = await getContext();
    if (!ctx) return fallo("No autenticado");

    const { data: carpetaRow, error: errCarpeta } = await ctx.supabase
      .from("carpetas_documentos")
      .select(COLS_CARPETA)
      .eq("empresa_id", ctx.empresaId)
      .eq("id", carpetaId)
      .maybeSingle();
    if (errCarpeta) throw errCarpeta;
    if (!carpetaRow) return fallo("La carpeta no existe");

    const carpeta = aCarpeta(carpetaRow as FilaCarpeta);
    if (!veDepartamento(ctx, carpeta.departamento)) {
      return fallo("No tienes acceso a esta carpeta");
    }

    // Miga de pan: se sube por `parent_id` hasta la raíz. El tope evita un
    // bucle infinito si un dato corrupto encadenara carpetas en ciclo.
    const ruta: Carpeta[] = [];
    let actual: Carpeta = carpeta;
    for (let i = 0; i < 20 && actual.parentId; i++) {
      const { data: padre } = await ctx.supabase
        .from("carpetas_documentos")
        .select(COLS_CARPETA)
        .eq("empresa_id", ctx.empresaId)
        .eq("id", actual.parentId)
        .maybeSingle();
      if (!padre) break;
      actual = aCarpeta(padre as FilaCarpeta);
      ruta.unshift(actual);
    }

    const [{ data: subs }, { data: archivos }] = await Promise.all([
      ctx.supabase
        .from("carpetas_documentos")
        .select(COLS_CARPETA)
        .eq("empresa_id", ctx.empresaId)
        .eq("parent_id", carpetaId)
        .order("nombre"),
      ctx.supabase
        .from("documentos")
        .select(COLS_ARCHIVO)
        .eq("empresa_id", ctx.empresaId)
        .eq("carpeta_id", carpetaId)
        .not("r2_key", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    return {
      ok: true,
      data: {
        carpeta,
        ruta,
        subcarpetas: ((subs ?? []) as FilaCarpeta[]).map(aCarpeta),
        archivos: ((archivos ?? []) as Record<string, unknown>[]).map((a) => ({
          id: a.id as string,
          carpetaId: a.carpeta_id as string,
          departamento: (a.departamento as string) ?? "",
          nombre: a.nombre as string,
          r2Key: a.r2_key as string,
          miniaturaKey: (a.miniatura_key as string) ?? null,
          mime: (a.tipo_mime as string) ?? "application/octet-stream",
          tamanoBytes: Number(a.tamano_bytes ?? 0),
          ancho: (a.ancho as number) ?? null,
          alto: (a.alto as number) ?? null,
          duracionSeg: (a.duracion_seg as number) ?? null,
          subidoPor: (a.subido_por as string) ?? null,
          // Borrar: solo el dueño del archivo, o DIRECCIÓN.
          puedeBorrar: ctx.esDireccion || a.subido_por === ctx.userId,
          createdAt: a.created_at as string,
        })),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] getContenidoCarpeta:", msg);
    return fallo(msg);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * SUBCARPETAS
 * ────────────────────────────────────────────────────────────────────────*/

/** Crea una subcarpeta. Hereda el departamento de la carpeta padre. */
export async function createSubcarpeta(
  parentId: string,
  nombre: string,
): Promise<Res<Carpeta>> {
  try {
    const ctx = await getContext();
    if (!ctx) return fallo("No autenticado");

    const limpio = nombre.trim();
    if (!limpio) return fallo("El nombre no puede estar vacío");

    const { data: padre } = await ctx.supabase
      .from("carpetas_documentos")
      .select("id, departamento")
      .eq("empresa_id", ctx.empresaId)
      .eq("id", parentId)
      .maybeSingle();
    if (!padre) return fallo("La carpeta no existe");

    const departamento = (padre.departamento as string) ?? "";
    if (!veDepartamento(ctx, departamento)) {
      return fallo("No tienes acceso a esta carpeta");
    }

    const { data, error } = await ctx.supabase
      .from("carpetas_documentos")
      .insert({
        empresa_id: ctx.empresaId,
        parent_id: parentId,
        nombre: limpio,
        departamento,
        es_raiz: false,
        created_by: ctx.userId,
      })
      .select(COLS_CARPETA)
      .single();

    if (error) {
      // Índice único (empresa_id, parent_id, lower(nombre)).
      if (error.code === "23505") return fallo("Ya existe una carpeta con ese nombre");
      throw error;
    }

    return { ok: true, data: aCarpeta(data as FilaCarpeta) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] createSubcarpeta:", msg);
    return fallo(msg);
  }
}

/** Renombra una subcarpeta. Las raíz de departamento no se tocan. */
export async function renameCarpeta(
  carpetaId: string,
  nombre: string,
): Promise<Res<null>> {
  try {
    const ctx = await getContext();
    if (!ctx) return fallo("No autenticado");

    const limpio = nombre.trim();
    if (!limpio) return fallo("El nombre no puede estar vacío");

    const { data: carpeta } = await ctx.supabase
      .from("carpetas_documentos")
      .select("id, departamento, es_raiz")
      .eq("empresa_id", ctx.empresaId)
      .eq("id", carpetaId)
      .maybeSingle();
    if (!carpeta) return fallo("La carpeta no existe");
    if (carpeta.es_raiz) return fallo("Las carpetas de departamento no se pueden renombrar");
    if (!veDepartamento(ctx, (carpeta.departamento as string) ?? "")) {
      return fallo("No tienes acceso a esta carpeta");
    }

    const { error } = await ctx.supabase
      .from("carpetas_documentos")
      .update({ nombre: limpio })
      .eq("empresa_id", ctx.empresaId)
      .eq("id", carpetaId);
    if (error) {
      if (error.code === "23505") return fallo("Ya existe una carpeta con ese nombre");
      throw error;
    }

    return { ok: true, data: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] renameCarpeta:", msg);
    return fallo(msg);
  }
}

/** Borra una subcarpeta VACÍA. Las raíz de departamento nunca se borran. */
export async function deleteCarpeta(carpetaId: string): Promise<Res<null>> {
  try {
    const ctx = await getContext();
    if (!ctx) return fallo("No autenticado");

    const { data: carpeta } = await ctx.supabase
      .from("carpetas_documentos")
      .select("id, departamento, es_raiz, created_by")
      .eq("empresa_id", ctx.empresaId)
      .eq("id", carpetaId)
      .maybeSingle();
    if (!carpeta) return fallo("La carpeta no existe");
    if (carpeta.es_raiz) return fallo("Las carpetas de departamento no se pueden borrar");
    if (!veDepartamento(ctx, (carpeta.departamento as string) ?? "")) {
      return fallo("No tienes acceso a esta carpeta");
    }
    if (!ctx.esDireccion && carpeta.created_by !== ctx.userId) {
      return fallo("Solo puede borrarla quien la creó");
    }

    // Debe estar vacía: ni archivos ni subcarpetas.
    const [{ count: nArchivos }, { count: nSubs }] = await Promise.all([
      ctx.supabase
        .from("documentos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", ctx.empresaId)
        .eq("carpeta_id", carpetaId),
      ctx.supabase
        .from("carpetas_documentos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", ctx.empresaId)
        .eq("parent_id", carpetaId),
    ]);
    if ((nArchivos ?? 0) > 0 || (nSubs ?? 0) > 0) {
      return fallo("La carpeta no está vacía");
    }

    const { error } = await ctx.supabase
      .from("carpetas_documentos")
      .delete()
      .eq("empresa_id", ctx.empresaId)
      .eq("id", carpetaId);
    if (error) throw error;

    return { ok: true, data: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] deleteCarpeta:", msg);
    return fallo(msg);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * SUBIDA
 * ────────────────────────────────────────────────────────────────────────*/

/**
 * Paso 1 de la subida: valida permiso, tipo, tamaño y cuota, y devuelve URLs
 * firmadas para que el navegador suba el archivo y su miniatura DIRECTAMENTE a
 * R2. El archivo nunca pasa por el servidor, así que no hay límite de body ni
 * cuello de botella: es lo que hace que subir 200 fotos sea rápido.
 */
export async function presignSubida(
  carpetaId: string,
  nombre: string,
  mime: string,
  tamanoBytes: number,
): Promise<Res<PresignOutput>> {
  try {
    const ctx = await getContext();
    if (!ctx) return fallo("No autenticado");

    if (!MIME_PERMITIDOS.test(mime)) {
      return fallo("Solo se admiten fotos y vídeos");
    }
    if (!tamanoBytes || tamanoBytes <= 0) return fallo("Archivo vacío");
    if (tamanoBytes > MAX_BYTES_ARCHIVO) {
      const gb = (MAX_BYTES_ARCHIVO / 1024 ** 3).toFixed(0);
      return fallo(`El archivo supera el máximo de ${gb} GB`);
    }

    const { data: carpeta } = await ctx.supabase
      .from("carpetas_documentos")
      .select("id, departamento")
      .eq("empresa_id", ctx.empresaId)
      .eq("id", carpetaId)
      .maybeSingle();
    if (!carpeta) return fallo("La carpeta no existe");

    const departamento = (carpeta.departamento as string) ?? "";
    if (!veDepartamento(ctx, departamento)) {
      return fallo("No tienes acceso a esta carpeta");
    }

    // Cuota por empresa (500 GB por defecto), igual que las grabaciones.
    const admin = createAdminClient();
    const { data: usage } = await admin
      .from("storage_usage_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", ctx.empresaId)
      .maybeSingle();

    const usados = Number(usage?.bytes_used ?? 0);
    const limite = Number(usage?.bytes_limit ?? 500 * 1024 ** 3);
    if (usados + tamanoBytes > limite) {
      const usadosGb = (usados / 1024 ** 3).toFixed(2);
      const limiteGb = (limite / 1024 ** 3).toFixed(1);
      return fallo(
        `Sin espacio: ${usadosGb} GB de ${limiteGb} GB. Borra archivos antiguos o amplía el plan.`,
      );
    }

    const archivoId = crypto.randomUUID();
    const carpetaFisica = sanitizar(departamento) || "_sin_departamento";
    const base = `empresa_${ctx.empresaId}/archivos/${carpetaFisica}/${archivoId}`;
    const ext = sanitizar(nombre).split(".").pop() ?? "bin";

    const r2Key = `${base}.${ext}`;
    const miniaturaKey = `${base}_thumb.jpg`;

    return {
      ok: true,
      data: {
        uploadUrl: presignPutR2(r2Key, mime),
        r2Key,
        miniaturaUploadUrl: presignPutR2(miniaturaKey, "image/jpeg"),
        miniaturaKey,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] presignSubida:", msg);
    return fallo(msg);
  }
}

/** Paso 2: registra en la base de datos el archivo ya subido a R2. */
export async function registrarArchivo(
  input: RegistrarArchivoInput,
): Promise<Res<Archivo>> {
  try {
    const ctx = await getContext();
    if (!ctx) return fallo("No autenticado");

    const { data: carpeta } = await ctx.supabase
      .from("carpetas_documentos")
      .select("id, departamento")
      .eq("empresa_id", ctx.empresaId)
      .eq("id", input.carpetaId)
      .maybeSingle();
    if (!carpeta) return fallo("La carpeta no existe");

    const departamento = (carpeta.departamento as string) ?? "";
    if (!veDepartamento(ctx, departamento)) {
      return fallo("No tienes acceso a esta carpeta");
    }

    // La clave firmada se generó para esta empresa: si no encaja, se rechaza.
    if (!input.r2Key.startsWith(`empresa_${ctx.empresaId}/archivos/`)) {
      return fallo("Ruta de archivo no válida");
    }

    const { data, error } = await ctx.supabase
      .from("documentos")
      .insert({
        empresa_id: ctx.empresaId,
        carpeta_id: input.carpetaId,
        departamento,
        nombre: input.nombre,
        r2_key: input.r2Key,
        miniatura_key: input.miniaturaKey,
        tipo_mime: input.mime,
        tamano_bytes: input.tamanoBytes,
        ancho: input.ancho ?? null,
        alto: input.alto ?? null,
        duracion_seg: input.duracionSeg ?? null,
        subido_por: ctx.userId,
        created_by: ctx.userId,
      })
      .select(COLS_ARCHIVO)
      .single();
    if (error) throw error;

    const fila = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        id: fila.id as string,
        carpetaId: fila.carpeta_id as string,
        departamento: (fila.departamento as string) ?? "",
        nombre: fila.nombre as string,
        r2Key: fila.r2_key as string,
        miniaturaKey: (fila.miniatura_key as string) ?? null,
        mime: (fila.tipo_mime as string) ?? "application/octet-stream",
        tamanoBytes: Number(fila.tamano_bytes ?? 0),
        ancho: (fila.ancho as number) ?? null,
        alto: (fila.alto as number) ?? null,
        duracionSeg: (fila.duracion_seg as number) ?? null,
        subidoPor: (fila.subido_por as string) ?? null,
        puedeBorrar: true,
        createdAt: fila.created_at as string,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] registrarArchivo:", msg);
    return fallo(msg);
  }
}

/**
 * Borra un archivo. Solo quien lo subió, o DIRECCIÓN: es la memoria de la
 * empresa y nadie debe poder vaciar por error el trabajo de otro.
 */
export async function deleteArchivo(archivoId: string): Promise<Res<null>> {
  try {
    const ctx = await getContext();
    if (!ctx) return fallo("No autenticado");

    const { data: archivo } = await ctx.supabase
      .from("documentos")
      .select("id, departamento, r2_key, miniatura_key, subido_por")
      .eq("empresa_id", ctx.empresaId)
      .eq("id", archivoId)
      .maybeSingle();
    if (!archivo) return fallo("El archivo no existe");

    if (!veDepartamento(ctx, (archivo.departamento as string) ?? "")) {
      return fallo("No tienes acceso a este archivo");
    }
    if (!ctx.esDireccion && archivo.subido_por !== ctx.userId) {
      return fallo("Solo puede borrarlo quien lo subió");
    }

    // Primero la fila: si fallara el borrado en R2, no queda un archivo
    // fantasma visible en la galería apuntando a un objeto inexistente.
    const { error } = await ctx.supabase
      .from("documentos")
      .delete()
      .eq("empresa_id", ctx.empresaId)
      .eq("id", archivoId);
    if (error) throw error;

    await Promise.allSettled([
      deleteObjectR2(archivo.r2_key as string),
      archivo.miniatura_key
        ? deleteObjectR2(archivo.miniatura_key as string)
        : Promise.resolve(),
    ]);

    return { ok: true, data: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] deleteArchivo:", msg);
    return fallo(msg);
  }
}
