import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { zonaHorariaDeConfig } from "@/features/empresa/lib/empresa-server";
import type { ClaseEscuela, PerfilAlumno, TipoClase } from "../types";

/**
 * Lectura del PORTAL DEL ALUMNO.
 *
 * El alumno no tiene sesión de Supabase, así que aquí se usa service-role: no
 * pasa por RLS. A cambio, TODA consulta parte del id de alumno que trae la
 * cookie firmada, y nunca de nada que venga del navegador sin firmar. El portal
 * es de SOLO LECTURA salvo el progreso, que es lo único que el alumno escribe.
 */

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface MarcaEscuela {
  empresaId: string;
  nombre: string;
  logoUrl: string | null;
  isotipoUrl: string | null;
  color: string;
  colorSecundario: string;
  colorTexto: string;
  zonaHoraria: string;
}

export interface CursoPortal {
  id: string;
  titulo: string;
  descripcion: string;
  cover: string | null;
  totalLecciones: number;
  completadas: number;
  /** Lección por la que seguir: la primera sin completar. */
  seguirLeccionId: string | null;
}

export interface LeccionPortal {
  id: string;
  seccionId: string;
  titulo: string;
  descripcion: string;
  contenido: string;
  videoUrl: string;
  duracionMin: number;
  orden: number;
  completada: boolean;
}

export interface ModuloPortal {
  id: string;
  titulo: string;
  descripcion: string;
  orden: number;
  lecciones: LeccionPortal[];
}

export interface CursoDetallePortal {
  id: string;
  titulo: string;
  descripcion: string;
  cover: string | null;
  modulos: ModuloPortal[];
}

export interface AlumnoSesion {
  id: string;
  empresaId: string;
  nombre: string;
  email: string;
  accesoTotal: boolean;
}

/** Empresa dueña de la escuela: la matriz (la que gestiona el software). */
export async function getMarcaEscuela(): Promise<MarcaEscuela | null> {
  const { data } = await db()
    .from("empresas")
    .select("id, nombre, logo_url, isotipo_url, color, color_secundario, color_texto, config_operativa")
    .eq("es_matriz", true)
    .maybeSingle();
  if (!data) return null;
  const color = (data.color as string) || "#1e3a8a";
  return {
    empresaId: data.id as string,
    nombre: (data.nombre as string) ?? "Escuela",
    logoUrl: (data.logo_url as string) ?? null,
    isotipoUrl: (data.isotipo_url as string) ?? null,
    color,
    colorSecundario: (data.color_secundario as string) || color,
    colorTexto: (data.color_texto as string) || "#ffffff",
    zonaHoraria: zonaHorariaDeConfig(data.config_operativa),
  };
}

/** Alumno de la sesión. Devuelve null si ya no está de alta: la baja cierra. */
export async function getAlumno(alumnoId: string): Promise<AlumnoSesion | null> {
  const { data } = await db()
    .from("escuela_alumnos")
    .select("id, empresa_id, nombre, email, acceso_total, estado")
    .eq("id", alumnoId)
    .maybeSingle();
  if (!data || data.estado !== "ACTIVO") return null;
  return {
    id: data.id as string,
    empresaId: data.empresa_id as string,
    nombre: (data.nombre as string) ?? "",
    email: data.email as string,
    accesoTotal: (data.acceso_total as boolean) ?? true,
  };
}

/** Ficha del alumno: sus datos, tal cual están. Nada de esto lo edita él. */
export async function getPerfil(alumno: AlumnoSesion): Promise<PerfilAlumno> {
  const supa = db();
  const [{ data: fila }, { count: completadas }] = await Promise.all([
    supa
      .from("escuela_alumnos")
      .select("telefono, created_at, empresa_cliente_id")
      .eq("id", alumno.id)
      .maybeSingle(),
    supa
      .from("escuela_progreso")
      .select("id", { count: "exact", head: true })
      .eq("alumno_id", alumno.id),
  ]);

  let empresaClienteNombre: string | undefined;
  if (fila?.empresa_cliente_id) {
    const { data: emp } = await supa
      .from("empresas")
      .select("nombre")
      .eq("id", fila.empresa_cliente_id as string)
      .maybeSingle();
    empresaClienteNombre = (emp?.nombre as string) ?? undefined;
  }

  const cursos = await getCursosAlumno(alumno);
  return {
    nombre: alumno.nombre,
    email: alumno.email,
    telefono: (fila?.telefono as string) ?? undefined,
    empresaClienteNombre,
    altaEl: (fila?.created_at as string) ?? "",
    cursosActivos: cursos.length,
    leccionesCompletadas: completadas ?? 0,
  };
}

/** Ids de los cursos que puede ver este alumno. */
async function cursoIdsVisibles(alumno: AlumnoSesion): Promise<string[]> {
  const supa = db();
  const { data: cursos } = await supa
    .from("formacion_cursos")
    .select("id")
    .eq("empresa_id", alumno.empresaId)
    .eq("ambito", "escuela")
    .eq("publicado", true);
  const publicados = ((cursos ?? []) as { id: string }[]).map((c) => c.id);
  if (alumno.accesoTotal) return publicados;

  const { data: matriculas } = await supa
    .from("escuela_matriculas")
    .select("curso_id")
    .eq("alumno_id", alumno.id);
  const matriculado = new Set(((matriculas ?? []) as { curso_id: string }[]).map((m) => m.curso_id));
  return publicados.filter((id) => matriculado.has(id));
}

export async function getCursosAlumno(alumno: AlumnoSesion): Promise<CursoPortal[]> {
  const supa = db();
  const visibles = await cursoIdsVisibles(alumno);
  if (!visibles.length) return [];

  const [{ data: cursos }, { data: modulos }, { data: lecciones }, { data: progreso }] = await Promise.all([
    supa
      .from("formacion_cursos")
      .select("id, titulo, descripcion, cover, orden")
      .in("id", visibles)
      .order("orden", { ascending: true }),
    supa.from("formacion_secciones").select("id, curso_id, orden, publicado").in("curso_id", visibles),
    supa
      .from("formacion_lecciones")
      .select("id, curso_id, seccion_id, orden")
      .in("curso_id", visibles),
    supa.from("escuela_progreso").select("leccion_id").eq("alumno_id", alumno.id),
  ]);

  // Un módulo despublicado esconde sus lecciones también en el recuento: si no,
  // el alumno vería un porcentaje que nunca podría completar.
  const modulosOcultos = new Set(
    ((modulos ?? []) as { id: string; publicado: boolean | null }[])
      .filter((m) => m.publicado === false)
      .map((m) => m.id),
  );
  const ordenModulo = new Map(
    ((modulos ?? []) as { id: string; orden: number }[]).map((m) => [m.id, m.orden ?? 0]),
  );
  const hechas = new Set(((progreso ?? []) as { leccion_id: string }[]).map((p) => p.leccion_id));

  return ((cursos ?? []) as { id: string; titulo: string; descripcion: string | null; cover: string | null }[]).map(
    (c) => {
      const suyas = ((lecciones ?? []) as { id: string; curso_id: string; seccion_id: string; orden: number }[])
        .filter((l) => l.curso_id === c.id && !modulosOcultos.has(l.seccion_id))
        .sort(
          (a, b) =>
            (ordenModulo.get(a.seccion_id) ?? 0) - (ordenModulo.get(b.seccion_id) ?? 0) ||
            (a.orden ?? 0) - (b.orden ?? 0),
        );
      const completadas = suyas.filter((l) => hechas.has(l.id)).length;
      const siguiente = suyas.find((l) => !hechas.has(l.id)) ?? suyas[0];
      return {
        id: c.id,
        titulo: c.titulo,
        descripcion: c.descripcion ?? "",
        cover: c.cover ?? null,
        totalLecciones: suyas.length,
        completadas,
        seguirLeccionId: siguiente?.id ?? null,
      };
    },
  );
}

export async function getCursoDetalle(
  alumno: AlumnoSesion,
  cursoId: string,
): Promise<CursoDetallePortal | null> {
  const visibles = await cursoIdsVisibles(alumno);
  if (!visibles.includes(cursoId)) return null;

  const supa = db();
  const [{ data: curso }, { data: modulos }, { data: lecciones }, { data: progreso }] = await Promise.all([
    supa.from("formacion_cursos").select("id, titulo, descripcion, cover").eq("id", cursoId).maybeSingle(),
    supa
      .from("formacion_secciones")
      .select("id, titulo, descripcion, orden, publicado")
      .eq("curso_id", cursoId)
      .order("orden", { ascending: true }),
    supa
      .from("formacion_lecciones")
      .select("id, seccion_id, titulo, descripcion, contenido, video_url, duracion_min, orden")
      .eq("curso_id", cursoId)
      .order("orden", { ascending: true }),
    supa.from("escuela_progreso").select("leccion_id").eq("alumno_id", alumno.id),
  ]);
  if (!curso) return null;

  const hechas = new Set(((progreso ?? []) as { leccion_id: string }[]).map((p) => p.leccion_id));
  type LeccionRow = {
    id: string;
    seccion_id: string;
    titulo: string;
    descripcion: string | null;
    contenido: string | null;
    video_url: string | null;
    duracion_min: number | null;
    orden: number | null;
  };

  const modulosPortal: ModuloPortal[] = (
    (modulos ?? []) as { id: string; titulo: string; descripcion: string | null; orden: number; publicado: boolean | null }[]
  )
    .filter((m) => m.publicado !== false)
    .map((m) => ({
      id: m.id,
      titulo: m.titulo ?? "",
      descripcion: m.descripcion ?? "",
      orden: m.orden ?? 0,
      lecciones: ((lecciones ?? []) as LeccionRow[])
        .filter((l) => l.seccion_id === m.id)
        .map((l) => ({
          id: l.id,
          seccionId: l.seccion_id,
          titulo: l.titulo ?? "",
          descripcion: l.descripcion ?? "",
          contenido: l.contenido ?? "",
          videoUrl: l.video_url ?? "",
          duracionMin: l.duracion_min ?? 0,
          orden: l.orden ?? 0,
          completada: hechas.has(l.id),
        })),
    }));

  return {
    id: curso.id as string,
    titulo: curso.titulo as string,
    descripcion: (curso.descripcion as string) ?? "",
    cover: (curso.cover as string) ?? null,
    modulos: modulosPortal,
  };
}

type ClaseRow = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  enlace: string | null;
  grabacion_url: string | null;
  cover: string | null;
  curso_id: string | null;
};

/** Clases publicadas. El alumno las ve, no las toca. */
export async function getClasesAlumno(alumno: AlumnoSesion): Promise<ClaseEscuela[]> {
  const { data } = await db()
    .from("escuela_clases")
    .select("*")
    .eq("empresa_id", alumno.empresaId)
    .eq("publicado", true)
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true });

  return ((data ?? []) as ClaseRow[]).map((r) => ({
    id: r.id,
    titulo: r.titulo ?? "",
    descripcion: r.descripcion ?? "",
    tipo: (r.tipo as TipoClase) ?? "CLASE",
    fecha: r.fecha,
    horaInicio: (r.hora_inicio ?? "").slice(0, 5),
    horaFin: r.hora_fin ? r.hora_fin.slice(0, 5) : undefined,
    enlace: r.enlace ?? undefined,
    grabacionUrl: r.grabacion_url ?? undefined,
    cover: r.cover ?? undefined,
    cursoId: r.curso_id ?? undefined,
    publicado: true,
  }));
}

/** Lo único que el alumno escribe: haber visto una lección. */
export async function marcarLeccion(
  alumno: AlumnoSesion,
  leccionId: string,
  completada: boolean,
): Promise<boolean> {
  const supa = db();
  const { data: leccion } = await supa
    .from("formacion_lecciones")
    .select("id, curso_id")
    .eq("id", leccionId)
    .maybeSingle();
  if (!leccion) return false;

  const visibles = await cursoIdsVisibles(alumno);
  if (!visibles.includes(leccion.curso_id as string)) return false;

  if (!completada) {
    await supa.from("escuela_progreso").delete().eq("alumno_id", alumno.id).eq("leccion_id", leccionId);
    return true;
  }
  const { error } = await supa.from("escuela_progreso").upsert(
    {
      empresa_id: alumno.empresaId,
      alumno_id: alumno.id,
      curso_id: leccion.curso_id as string,
      leccion_id: leccionId,
    },
    { onConflict: "alumno_id,leccion_id" },
  );
  return !error;
}

export async function registrarAcceso(alumnoId: string): Promise<void> {
  await db().from("escuela_alumnos").update({ ultimo_acceso_at: new Date().toISOString() }).eq("id", alumnoId);
}
