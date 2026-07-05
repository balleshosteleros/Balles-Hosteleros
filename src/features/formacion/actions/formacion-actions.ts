"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type {
  Curso,
  Seccion,
  Leccion,
  NovedadFormacion,
  PuestoRef,
} from "../types";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;
  return { supabase, userId: user?.id ?? null, empresaId };
}

// ─── Mappers BD → modelo del store ──────────────────────────────
type CursoRow = {
  id: string; empresa_id: string; puesto_id: string | null; ambito: string;
  titulo: string; descripcion: string | null; cover: string | null;
  categoria: string; orden: number; publicado: boolean;
  fecha_publicacion: string; autor: string;
};
function toCurso(r: CursoRow, puestoNombre: string | null): Curso {
  return {
    id: r.id,
    titulo: r.titulo,
    descripcion: r.descripcion ?? "",
    cover: r.cover ?? undefined,
    categoria: (r.categoria as Curso["categoria"]) ?? "otros",
    ambito: (r.ambito as Curso["ambito"]) ?? "general",
    puesto: puestoNombre ?? undefined,
    puestoId: r.puesto_id ?? undefined,
    empresaId: r.empresa_id,
    orden: r.orden ?? 0,
    fechaPublicacion: r.fecha_publicacion ?? "",
    autor: r.autor ?? "",
    publicado: r.publicado ?? true,
  };
}
type SeccionRow = { id: string; curso_id: string; titulo: string; orden: number; descripcion: string | null; publicado: boolean | null };
function toSeccion(r: SeccionRow): Seccion {
  return {
    id: r.id, cursoId: r.curso_id, titulo: r.titulo ?? "", orden: r.orden ?? 0,
    descripcion: r.descripcion ?? undefined,
    publicado: r.publicado ?? true,
  };
}
type LeccionRow = {
  id: string; curso_id: string; seccion_id: string; titulo: string;
  descripcion: string | null; video_url: string | null; documento_path: string | null;
  documento_nombre: string | null; documento_tipo: string | null; contenido: string | null;
  duracion_min: number; orden: number; created_at: string;
  publicado: boolean | null; cover: string | null;
};
function toLeccion(r: LeccionRow): Leccion {
  return {
    id: r.id,
    seccionId: r.seccion_id,
    cursoId: r.curso_id,
    titulo: r.titulo ?? "",
    descripcion: r.descripcion ?? "",
    url: r.video_url ?? "",
    duracionMin: r.duracion_min ?? 0,
    orden: r.orden ?? 0,
    fechaSubida: (r.created_at ?? "").slice(0, 10),
    publicado: r.publicado ?? true,
    cover: r.cover ?? undefined,
    contenido: r.contenido ?? undefined,
    documentoPath: r.documento_path ?? undefined,
    documentoNombre: r.documento_nombre ?? undefined,
    documentoTipo: r.documento_tipo ?? undefined,
    recursos: [],
  };
}
type NovedadRow = {
  id: string; tipo: string; titulo: string; descripcion: string | null;
  audiencia: unknown; fecha_publicacion: string; autor: string;
  curso_id: string | null; leccion_id: string | null; empresa_id: string;
};
function toNovedad(r: NovedadRow): NovedadFormacion {
  const aud = r.audiencia;
  return {
    id: r.id,
    tipo: (r.tipo as NovedadFormacion["tipo"]) ?? "aviso",
    titulo: r.titulo ?? "",
    descripcion: r.descripcion ?? "",
    audiencia: aud === "todos" || !Array.isArray(aud) ? "todos" : (aud as string[]),
    fechaPublicacion: r.fecha_publicacion ?? "",
    autor: r.autor ?? "",
    empresaId: r.empresa_id,
    cursoId: r.curso_id ?? undefined,
    leccionId: r.leccion_id ?? undefined,
  };
}

// ─── Puestos reales de la empresa ───────────────────────────────
export async function listPuestosFormacion(): Promise<{ ok: boolean; data: PuestoRef[] }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("puestos")
      .select("id, nombre, estado, departamento:departamentos(nombre)")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;
    const data2 = (data ?? [])
      .filter((p) => (p as { estado?: string }).estado !== "inactivo")
      .map((p) => {
        const dep = (p as { departamento?: unknown }).departamento;
        const depObj = (Array.isArray(dep) ? dep[0] : dep) as { nombre?: string } | null;
        return {
          id: p.id as string,
          nombre: (p.nombre as string) ?? "",
          departamento: depObj?.nombre ?? undefined,
        };
      });
    return { ok: true, data: data2 };
  } catch (err) {
    console.error("[formacion] listPuestosFormacion:", err);
    return { ok: false, data: [] };
  }
}

/**
 * Devuelve el id del curso de formación de un puesto (relación 1:1). Si aún no
 * existe (puesto nuevo sin sincronizar), lo crea al vuelo. Usado por el enlace
 * "Formación" de la ficha del puesto en RRHH.
 */
export async function getCursoDePuesto(
  puestoId: string,
): Promise<{ ok: boolean; cursoId?: string; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: existente } = await supabase
      .from("formacion_cursos")
      .select("id")
      .eq("puesto_id", puestoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (existente?.id) return { ok: true, cursoId: existente.id };

    // No existe: crearlo con el nombre del puesto.
    const { data: puesto } = await supabase
      .from("puestos")
      .select("nombre")
      .eq("id", puestoId)
      .maybeSingle();

    const id = crypto.randomUUID();
    const { error } = await supabase.from("formacion_cursos").insert({
      id,
      empresa_id: empresaId,
      puesto_id: puestoId,
      ambito: "puesto",
      titulo: puesto?.nombre ?? "Formación",
      categoria: "operativa",
      orden: 0,
      publicado: true,
      fecha_publicacion: new Date().toISOString().slice(0, 10),
      autor: "",
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, cursoId: id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

/** Nombres de los puestos reales del empleado autenticado (principal primero). */
export async function getMisPuestosNombres(): Promise<{ ok: boolean; data: string[] }> {
  try {
    const { supabase, userId, empresaId } = await ctx();
    if (!userId || !empresaId) return { ok: true, data: [] };
    // Solo la empresa activa: así el nombre puede caer al snapshot copiado
    // (puesto_nombre) si el puesto plantilla fue borrado, sin perder el scope.
    const { data: emps } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId);
    const ids = (emps ?? []).map((e) => e.id as string);
    if (ids.length === 0) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("empleado_puestos")
      .select("es_principal, puesto_nombre, puesto:puestos(nombre)")
      .in("empleado_id", ids)
      .order("es_principal", { ascending: false });
    if (error) throw error;
    const nombres: string[] = [];
    for (const r of data ?? []) {
      const p = (r as { puesto?: unknown }).puesto;
      const obj = (Array.isArray(p) ? p[0] : p) as { nombre?: string } | null;
      // Puesto vivo si existe; si fue borrado, el nombre copiado en el empleado.
      const nombre = obj?.nombre ?? (r as { puesto_nombre?: string | null }).puesto_nombre ?? null;
      if (nombre && !nombres.includes(nombre)) nombres.push(nombre);
    }
    return { ok: true, data: nombres };
  } catch (err) {
    console.error("[formacion] getMisPuestosNombres:", err);
    return { ok: false, data: [] };
  }
}

/**
 * Garantiza exactamente un curso por cada puesto real de la empresa.
 * Idempotente: crea los que falten (título = nombre del puesto). El
 * `unique(puesto_id)` evita duplicados ante concurrencia.
 */
export async function syncCursosPorPuesto(): Promise<{ ok: boolean; creados: number }> {
  try {
    const { supabase, userId, empresaId } = await ctx();
    if (!empresaId) return { ok: false, creados: 0 };

    const [{ data: puestos }, { data: cursos }] = await Promise.all([
      supabase.from("puestos").select("id, nombre, estado").eq("empresa_id", empresaId),
      supabase.from("formacion_cursos").select("puesto_id").eq("empresa_id", empresaId),
    ]);
    const conCurso = new Set(
      (cursos ?? []).map((c) => (c as { puesto_id: string | null }).puesto_id).filter(Boolean),
    );
    const faltan = (puestos ?? [])
      .filter((p) => (p as { estado?: string }).estado !== "inactivo")
      .filter((p) => !conCurso.has((p as { id: string }).id));

    if (faltan.length === 0) return { ok: true, creados: 0 };

    const filas = faltan.map((p, i) => ({
      empresa_id: empresaId,
      puesto_id: (p as { id: string }).id,
      ambito: "puesto",
      titulo: (p as { nombre: string }).nombre ?? "Puesto",
      descripcion: "",
      categoria: "operativa",
      orden: i + 1,
      publicado: true,
      autor: "Sistema",
      created_by: userId,
    }));
    const { error } = await supabase
      .from("formacion_cursos")
      .upsert(filas, { onConflict: "puesto_id", ignoreDuplicates: true });
    if (error) throw error;
    return { ok: true, creados: filas.length };
  } catch (err) {
    console.error("[formacion] syncCursosPorPuesto:", err);
    return { ok: false, creados: 0 };
  }
}

// ─── Carga completa del módulo ──────────────────────────────────
export interface FormacionData {
  cursos: Curso[];
  secciones: Seccion[];
  lecciones: Leccion[];
  novedades: NovedadFormacion[];
  progresoLeccionIds: string[];
}

export async function getFormacionData(): Promise<{ ok: boolean; data: FormacionData }> {
  const vacio: FormacionData = { cursos: [], secciones: [], lecciones: [], novedades: [], progresoLeccionIds: [] };
  try {
    const { supabase, userId, empresaId } = await ctx();
    if (!empresaId) return { ok: true, data: vacio };

    const [cursosR, seccionesR, leccionesR, novedadesR, puestosR, progresoR] = await Promise.all([
      supabase.from("formacion_cursos").select("*").eq("empresa_id", empresaId),
      supabase.from("formacion_secciones").select("*").eq("empresa_id", empresaId),
      supabase.from("formacion_lecciones").select("*").eq("empresa_id", empresaId),
      supabase.from("formacion_novedades").select("*").eq("empresa_id", empresaId),
      supabase.from("puestos").select("id, nombre").eq("empresa_id", empresaId),
      userId
        ? supabase.from("formacion_progreso").select("leccion_id").eq("user_id", userId)
        : Promise.resolve({ data: [] as { leccion_id: string }[] }),
    ]);

    const nombrePuesto = new Map<string, string>(
      (puestosR.data ?? []).map((p) => [p.id as string, (p.nombre as string) ?? ""]),
    );

    const data: FormacionData = {
      cursos: ((cursosR.data ?? []) as CursoRow[]).map((c) =>
        toCurso(c, c.puesto_id ? nombrePuesto.get(c.puesto_id) ?? null : null),
      ),
      secciones: ((seccionesR.data ?? []) as SeccionRow[]).map(toSeccion),
      lecciones: ((leccionesR.data ?? []) as LeccionRow[]).map(toLeccion),
      novedades: ((novedadesR.data ?? []) as NovedadRow[]).map(toNovedad),
      progresoLeccionIds: ((progresoR.data ?? []) as { leccion_id: string }[]).map((r) => r.leccion_id),
    };
    return { ok: true, data };
  } catch (err) {
    console.error("[formacion] getFormacionData:", err);
    return { ok: false, data: vacio };
  }
}

// ─── CRUD (reciben el objeto con id generado en cliente) ────────
export async function dbCreateCurso(c: Curso): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("formacion_cursos").insert({
      id: c.id, empresa_id: empresaId, puesto_id: c.puestoId ?? null, ambito: c.ambito,
      titulo: c.titulo, descripcion: c.descripcion, cover: c.cover ?? null,
      categoria: c.categoria, orden: c.orden, publicado: c.publicado,
      fecha_publicacion: c.fechaPublicacion || undefined, autor: c.autor, created_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail("dbCreateCurso", e); }
}
export async function dbUpdateCurso(id: string, patch: Partial<Curso>): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await ctx();
    const upd: Record<string, unknown> = {};
    if (patch.titulo !== undefined) upd.titulo = patch.titulo;
    if (patch.descripcion !== undefined) upd.descripcion = patch.descripcion;
    if (patch.cover !== undefined) upd.cover = patch.cover;
    if (patch.categoria !== undefined) upd.categoria = patch.categoria;
    if (patch.ambito !== undefined) upd.ambito = patch.ambito;
    if (patch.puestoId !== undefined) upd.puesto_id = patch.puestoId ?? null;
    if (patch.orden !== undefined) upd.orden = patch.orden;
    if (patch.publicado !== undefined) upd.publicado = patch.publicado;
    const { error } = await supabase.from("formacion_cursos").update(upd).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail("dbUpdateCurso", e); }
}
export async function dbDeleteCurso(id: string) {
  return del("formacion_cursos", id, "dbDeleteCurso");
}

export async function dbCreateSeccion(s: Seccion): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("formacion_secciones").insert({
      id: s.id, empresa_id: empresaId, curso_id: s.cursoId, titulo: s.titulo, orden: s.orden,
      descripcion: s.descripcion ?? null, publicado: s.publicado ?? true,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail("dbCreateSeccion", e); }
}
export async function dbUpdateSeccion(id: string, patch: Partial<Seccion>) {
  try {
    const { supabase } = await ctx();
    const upd: Record<string, unknown> = {};
    if (patch.titulo !== undefined) upd.titulo = patch.titulo;
    if (patch.orden !== undefined) upd.orden = patch.orden;
    if (patch.descripcion !== undefined) upd.descripcion = patch.descripcion ?? null;
    if (patch.publicado !== undefined) upd.publicado = patch.publicado;
    const { error } = await supabase.from("formacion_secciones").update(upd).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail("dbUpdateSeccion", e); }
}
export async function dbDeleteSeccion(id: string) {
  return del("formacion_secciones", id, "dbDeleteSeccion");
}

/**
 * Publica/despublica un TEMA y, en cascada, TODAS sus lecciones. El alumno
 * verá u ocultará el bloque entero. Devuelve ok para que el store refresque.
 */
export async function dbSetSeccionPublicada(
  seccionId: string,
  publicado: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await ctx();
    const { error: e1 } = await supabase
      .from("formacion_secciones").update({ publicado }).eq("id", seccionId);
    if (e1) throw e1;
    const { error: e2 } = await supabase
      .from("formacion_lecciones").update({ publicado }).eq("seccion_id", seccionId);
    if (e2) throw e2;
    return { ok: true };
  } catch (e) { return fail("dbSetSeccionPublicada", e); }
}

export async function dbCreateLeccion(l: Leccion): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("formacion_lecciones").insert({
      id: l.id, empresa_id: empresaId, curso_id: l.cursoId, seccion_id: l.seccionId,
      titulo: l.titulo, descripcion: l.descripcion, video_url: l.url,
      contenido: l.contenido ?? null,
      documento_path: l.documentoPath ?? null, documento_nombre: l.documentoNombre ?? null,
      documento_tipo: l.documentoTipo ?? null,
      publicado: l.publicado ?? true, cover: l.cover ?? null,
      duracion_min: l.duracionMin, orden: l.orden,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail("dbCreateLeccion", e); }
}
export async function dbUpdateLeccion(id: string, patch: Partial<Leccion>) {
  try {
    const { supabase } = await ctx();
    const upd: Record<string, unknown> = {};
    if (patch.titulo !== undefined) upd.titulo = patch.titulo;
    if (patch.descripcion !== undefined) upd.descripcion = patch.descripcion;
    if (patch.url !== undefined) upd.video_url = patch.url;
    if (patch.contenido !== undefined) upd.contenido = patch.contenido ?? null;
    if (patch.documentoPath !== undefined) upd.documento_path = patch.documentoPath ?? null;
    if (patch.documentoNombre !== undefined) upd.documento_nombre = patch.documentoNombre ?? null;
    if (patch.documentoTipo !== undefined) upd.documento_tipo = patch.documentoTipo ?? null;
    if (patch.publicado !== undefined) upd.publicado = patch.publicado;
    if (patch.cover !== undefined) upd.cover = patch.cover ?? null;
    if (patch.seccionId !== undefined) upd.seccion_id = patch.seccionId;
    if (patch.duracionMin !== undefined) upd.duracion_min = patch.duracionMin;
    if (patch.orden !== undefined) upd.orden = patch.orden;
    const { error } = await supabase.from("formacion_lecciones").update(upd).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail("dbUpdateLeccion", e); }
}
export async function dbDeleteLeccion(id: string) {
  return del("formacion_lecciones", id, "dbDeleteLeccion");
}

export async function dbCreateNovedad(n: NovedadFormacion): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("formacion_novedades").insert({
      id: n.id, empresa_id: empresaId, tipo: n.tipo, titulo: n.titulo, descripcion: n.descripcion,
      audiencia: n.audiencia, fecha_publicacion: n.fechaPublicacion || undefined, autor: n.autor,
      curso_id: n.cursoId ?? null, leccion_id: n.leccionId ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail("dbCreateNovedad", e); }
}
export async function dbUpdateNovedad(id: string, patch: Partial<NovedadFormacion>) {
  try {
    const { supabase } = await ctx();
    const upd: Record<string, unknown> = {};
    if (patch.tipo !== undefined) upd.tipo = patch.tipo;
    if (patch.titulo !== undefined) upd.titulo = patch.titulo;
    if (patch.descripcion !== undefined) upd.descripcion = patch.descripcion;
    if (patch.audiencia !== undefined) upd.audiencia = patch.audiencia;
    const { error } = await supabase.from("formacion_novedades").update(upd).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail("dbUpdateNovedad", e); }
}
export async function dbDeleteNovedad(id: string) {
  return del("formacion_novedades", id, "dbDeleteNovedad");
}

// ─── Progreso ───────────────────────────────────────────────────
export async function dbToggleCompletada(
  leccionId: string,
  completada: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId, empresaId } = await ctx();
    if (!userId || !empresaId) return { ok: false, error: "No autenticado" };
    if (completada) {
      const { data: lec } = await supabase
        .from("formacion_lecciones").select("curso_id").eq("id", leccionId).maybeSingle();
      const { error } = await supabase.from("formacion_progreso").upsert(
        { user_id: userId, empresa_id: empresaId, curso_id: (lec as { curso_id?: string })?.curso_id ?? null, leccion_id: leccionId },
        { onConflict: "user_id,leccion_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("formacion_progreso").delete().eq("user_id", userId).eq("leccion_id", leccionId);
      if (error) throw error;
    }
    return { ok: true };
  } catch (e) { return fail("dbToggleCompletada", e); }
}

// ─── Documento adjunto de una tarea ─────────────────────────────
/**
 * Sube un documento al bucket `formacion-docs` y devuelve su ruta + nombre.
 * No toca la fila de la lección: el path se incluye al crear/editar la tarea,
 * evitando carreras con la inserción optimista.
 */
export async function uploadFormacionDoc(
  formData: FormData,
): Promise<{ ok: boolean; path?: string; nombre?: string; error?: string }> {
  try {
    const { empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Archivo no válido" };

    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${empresaId}/lecciones/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage
      .from("formacion-docs")
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (error) throw error;
    return { ok: true, path, nombre: file.name };
  } catch (e) {
    const r = fail("uploadFormacionDoc", e);
    return { ok: false, error: r.error };
  }
}

export async function getDocumentoLeccionUrl(
  path: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    // La RLS de formacion_lecciones limita a la empresa del usuario: si no
    // existe una lección con ese documento accesible, no se firma (evita leer
    // documentos de otras empresas conociendo la ruta).
    const { data: lec } = await supabase
      .from("formacion_lecciones")
      .select("id")
      .eq("documento_path", path)
      .maybeSingle();
    if (!lec) return { ok: false, error: "Documento no disponible" };

    const admin = createAdminClient();
    const { data, error } = await admin.storage.from("formacion-docs").createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return { ok: true, url: data?.signedUrl };
  } catch (e) {
    const r = fail("getDocumentoLeccionUrl", e);
    return { ok: false, error: r.error };
  }
}

// ─── helpers ────────────────────────────────────────────────────
function fail(tag: string, e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "Error desconocido";
  console.error(`[formacion] ${tag}:`, msg);
  return { ok: false, error: msg };
}
async function del(tabla: string, id: string, tag: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await ctx();
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(tag, e); }
}
