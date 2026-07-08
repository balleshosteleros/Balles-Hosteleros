/**
 * Lectura PÚBLICA (sin sesión) del curso de formación de un candidato a partir
 * de su token personal (`candidatos.formacion_token`).
 *
 * En la fase «Formación» del onboarding el candidato aún no tiene cuenta, así que
 * accede por `/formacion/<token>`. El curso se deriva del puesto de su vacante
 * (candidato → vacante → puesto → curso; relación 1 puesto = 1 curso). Usa un
 * cliente con service-role para saltar RLS; NO expone datos de otras empresas
 * porque parte de un token único del candidato.
 *
 * Devuelve solo lo necesario para el visor de SOLO LECTURA: no marca progreso,
 * no incluye cuestionarios ni interacción (esas viven en el área autenticada).
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface LeccionPublica {
  id: string;
  seccionId: string;
  titulo: string;
  descripcion: string;
  videoUrl: string;
  duracionMin: number;
  orden: number;
  contenido: string | null;
  /** URL firmada del documento (1h) si la lección lleva documento adjunto. */
  documentoUrl: string | null;
  documentoNombre: string | null;
  documentoTipo: string | null;
}

export interface SeccionPublica {
  id: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  lecciones: LeccionPublica[];
}

export interface EmpresaMarcaPublica {
  id: string;
  slug: string;
  empleo_slug: string;
  nombre: string;
  logo_url: string | null;
  color: string | null;
  color_secundario: string | null;
  color_texto: string | null;
}

export interface FormacionPublica {
  empresa: EmpresaMarcaPublica;
  candidatoNombre: string;
  cursoTitulo: string;
  cursoDescripcion: string;
  puestoNombre: string | null;
  secciones: SeccionPublica[];
  /** true si el enlace ha caducado (pasados los días desde el envío). */
  caducada: boolean;
  /** true si el candidato no tiene puesto/curso resoluble todavía. */
  sinCurso: boolean;
}

const EMPRESA_COLS =
  "id, slug, empleo_slug, nombre, logo_url, color, color_secundario, color_texto";

type EmpresaRow = {
  id: string;
  slug: string | null;
  empleo_slug: string | null;
  nombre: string | null;
  logo_url: string | null;
  color: string | null;
  color_secundario: string | null;
  color_texto: string | null;
};

function rowToEmpresa(r: EmpresaRow): EmpresaMarcaPublica {
  const slug = r.slug ?? "";
  return {
    id: r.id,
    slug,
    empleo_slug: r.empleo_slug ?? slug,
    nombre: r.nombre ?? "",
    logo_url: r.logo_url,
    color: r.color,
    color_secundario: r.color_secundario,
    color_texto: r.color_texto,
  };
}

/**
 * Resuelve la página pública de formación a partir del token del candidato.
 * Null si el token no existe. Si el candidato no tiene curso (sin puesto), o el
 * enlace caducó, devuelve el objeto con los flags correspondientes para que la
 * página muestre el mensaje adecuado sin filtrar contenido.
 */
export async function fetchFormacionPorToken(
  token: string,
): Promise<FormacionPublica | null> {
  try {
    const safe = token.trim();
    if (!safe) return null;
    const supabase = serviceClient();

    // 1. Token → candidato (nombre, empresa, vacante, caducidad).
    const { data: cand } = await supabase
      .from("candidatos")
      .select("nombre, apellidos, empresa_id, vacante_id, formacion_token_expira_en")
      .eq("formacion_token", safe)
      .maybeSingle();
    if (!cand) return null;

    const empresaId = cand.empresa_id as string;

    const { data: emp } = await supabase
      .from("empresas")
      .select(EMPRESA_COLS)
      .eq("id", empresaId)
      .maybeSingle<EmpresaRow>();
    if (!emp) return null;

    const nombre = [(cand.nombre as string | null) ?? "", (cand.apellidos as string | null) ?? ""]
      .filter(Boolean)
      .join(" ")
      .trim();

    const empresa = rowToEmpresa(emp);
    const expira = cand.formacion_token_expira_en as string | null;
    const caducada = !!expira && new Date(expira).getTime() < Date.now();

    const vacio = (extra: Partial<FormacionPublica>): FormacionPublica => ({
      empresa,
      candidatoNombre: nombre,
      cursoTitulo: "",
      cursoDescripcion: "",
      puestoNombre: null,
      secciones: [],
      caducada,
      sinCurso: false,
      ...extra,
    });

    if (caducada) return vacio({ caducada: true });

    // 2. Candidato → vacante → puesto.
    const vacanteId = cand.vacante_id as string | null;
    let puestoId: string | null = null;
    let puestoNombre: string | null = null;
    if (vacanteId) {
      const { data: vac } = await supabase
        .from("vacantes")
        .select("puesto_id")
        .eq("id", vacanteId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      puestoId = (vac?.puesto_id as string | null) ?? null;
    }
    if (!puestoId) return vacio({ sinCurso: true });

    const { data: pue } = await supabase
      .from("puestos")
      .select("nombre")
      .eq("id", puestoId)
      .maybeSingle();
    puestoNombre = (pue?.nombre as string | null) ?? null;

    // 3. Puesto → curso (1:1). Si aún no existe, no hay contenido que mostrar.
    const { data: curso } = await supabase
      .from("formacion_cursos")
      .select("id, titulo, descripcion")
      .eq("puesto_id", puestoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!curso) return vacio({ sinCurso: true, puestoNombre });

    const cursoId = curso.id as string;

    // 4. Secciones + lecciones PUBLICADAS del curso.
    const [seccionesR, leccionesR] = await Promise.all([
      supabase
        .from("formacion_secciones")
        .select("id, titulo, descripcion, orden, publicado")
        .eq("curso_id", cursoId)
        .eq("empresa_id", empresaId),
      supabase
        .from("formacion_lecciones")
        .select(
          "id, seccion_id, titulo, descripcion, video_url, documento_path, documento_nombre, documento_tipo, contenido, duracion_min, orden, publicado",
        )
        .eq("curso_id", cursoId)
        .eq("empresa_id", empresaId),
    ]);

    const secRows = (seccionesR.data ?? []).filter(
      (s) => (s as { publicado?: boolean | null }).publicado !== false,
    );
    const lecRows = (leccionesR.data ?? []).filter(
      (l) => (l as { publicado?: boolean | null }).publicado !== false,
    );

    // Firma las URLs de documentos adjuntos (bucket privado) en paralelo.
    const admin = serviceClient();
    const docUrlPorLeccion = new Map<string, string>();
    await Promise.all(
      lecRows
        .filter((l) => (l as { documento_path?: string | null }).documento_path)
        .map(async (l) => {
          const path = (l as { documento_path: string }).documento_path;
          const { data } = await admin.storage
            .from("formacion-docs")
            .createSignedUrl(path, 60 * 60);
          if (data?.signedUrl) docUrlPorLeccion.set(l.id as string, data.signedUrl);
        }),
    );

    const secciones: SeccionPublica[] = secRows
      .map((s) => {
        const sid = s.id as string;
        const lecciones: LeccionPublica[] = lecRows
          .filter((l) => (l.seccion_id as string) === sid)
          .map((l) => ({
            id: l.id as string,
            seccionId: sid,
            titulo: (l.titulo as string | null) ?? "",
            descripcion: (l.descripcion as string | null) ?? "",
            videoUrl: (l.video_url as string | null) ?? "",
            duracionMin: (l.duracion_min as number | null) ?? 0,
            orden: (l.orden as number | null) ?? 0,
            contenido: (l.contenido as string | null) ?? null,
            documentoUrl: docUrlPorLeccion.get(l.id as string) ?? null,
            documentoNombre: (l.documento_nombre as string | null) ?? null,
            documentoTipo: (l.documento_tipo as string | null) ?? null,
          }))
          .sort((a, b) => a.orden - b.orden);
        return {
          id: sid,
          titulo: (s.titulo as string | null) ?? "",
          descripcion: (s.descripcion as string | null) ?? null,
          orden: (s.orden as number | null) ?? 0,
          lecciones,
        };
      })
      .sort((a, b) => a.orden - b.orden);

    return {
      empresa,
      candidatoNombre: nombre,
      cursoTitulo: (curso.titulo as string | null) ?? "Formación",
      cursoDescripcion: (curso.descripcion as string | null) ?? "",
      puestoNombre,
      secciones,
      caducada: false,
      sinCurso: secciones.length === 0,
    };
  } catch (err) {
    console.error("[formacion-publica] fetchFormacionPorToken fatal:", err);
    return null;
  }
}
