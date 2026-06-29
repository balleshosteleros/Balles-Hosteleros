/**
 * Lectura pública de ofertas de empleo por slug de empresa (server-side).
 * Solo devuelve vacantes con estado_publicacion='publicada' AND visible_publicamente=true.
 * Usado por las rutas /empleo/[slug] y /empleo/[slug]/[oferta-id].
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { PreguntaCuestionario } from "@/features/rrhh/data/cuestionario-vacante";
import {
  normalizarCamposFormulario,
  type CamposFormularioConfig,
} from "@/features/rrhh/data/campos-candidatura";

export interface CuestionarioPublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  preguntas: PreguntaCuestionario[];
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface EmpresaPublica {
  id: string;
  slug: string;
  /** URL personalizable del portal de empleo. Cae a `slug` si no se ha definido. */
  empleo_slug: string;
  nombre: string;
  logo_url: string | null;
  color: string | null;
  color_secundario: string | null;
  color_texto: string | null;
}

export interface OfertaPublica {
  id: string;
  empresa_id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  ubicacion: string | null;
  tipo_jornada: string | null;
  tipo_contrato: string | null;
  salario_rango: string | null;
  cuestionario: boolean;
  fecha_creacion: string;
  departamento_nombre: string | null;
  /** Área del departamento de la vacante: gobierna la columna del portal. */
  area: "OPERATIVA" | "ADMINISTRATIVA" | null;
  orden: number | null;
  puesto_nombre: string | null;
  /** Cuestionario obligatorio asociado (solo se rellena en el detalle de oferta). */
  cuestionarioPlantilla?: CuestionarioPublico | null;
}

export interface EmpleoPortal {
  empresa: EmpresaPublica;
  ofertas: OfertaPublica[];
}

export interface EmpleoOfertaDetalle {
  empresa: EmpresaPublica;
  oferta: OfertaPublica;
}

interface EmpresaRow {
  id: string;
  slug: string;
  empleo_slug: string | null;
  nombre: string;
  logo_url: string | null;
  color: string | null;
  color_secundario: string | null;
  color_texto: string | null;
}

const EMPRESA_COLS = "id, slug, empleo_slug, nombre, logo_url, color, color_secundario, color_texto";

/**
 * Resuelve la empresa pública por su URL de empleo personalizada (`empleo_slug`)
 * y, si no la encuentra, cae al `slug` global. Insensible a mayúsculas para que
 * `/empleo/Habana` y `/empleo/habana` resuelvan igual. Sanea el comodín de ilike.
 */
async function findEmpresaPublica(
  supabase: ReturnType<typeof serviceClient>,
  slug: string,
): Promise<EmpresaRow | null> {
  const safe = slug.replace(/[%_]/g, "");
  if (!safe) return null;

  const porEmpleo = await supabase
    .from("empresas")
    .select(EMPRESA_COLS)
    .ilike("empleo_slug", safe)
    .maybeSingle<EmpresaRow>();
  if (porEmpleo.data) return porEmpleo.data;

  const porSlug = await supabase
    .from("empresas")
    .select(EMPRESA_COLS)
    .ilike("slug", safe)
    .maybeSingle<EmpresaRow>();
  return porSlug.data ?? null;
}

interface VacanteRow {
  id: string;
  empresa_id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  ubicacion: string | null;
  tipo_jornada: string | null;
  tipo_contrato: string | null;
  salario_rango: string | null;
  cuestionario: boolean;
  cuestionario_plantilla_id: string | null;
  fecha_creacion: string;
  orden: number | null;
  visible_publicamente: boolean;
  estado_publicacion: string;
  departamento_id: string | null;
  puesto_id: string | null;
  departamentos: { nombre: string; area: string | null } | null;
  puestos: { nombre: string } | null;
}

function rowToEmpresa(r: EmpresaRow): EmpresaPublica {
  return {
    id: r.id,
    slug: r.slug,
    empleo_slug: r.empleo_slug ?? r.slug,
    nombre: r.nombre,
    logo_url: r.logo_url,
    color: r.color,
    color_secundario: r.color_secundario,
    color_texto: r.color_texto,
  };
}

function rowToOferta(r: VacanteRow): OfertaPublica {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    titulo: r.titulo,
    descripcion: r.descripcion,
    categoria: r.categoria,
    ubicacion: r.ubicacion,
    tipo_jornada: r.tipo_jornada,
    tipo_contrato: r.tipo_contrato,
    salario_rango: r.salario_rango,
    cuestionario: r.cuestionario,
    fecha_creacion: r.fecha_creacion,
    departamento_nombre: r.departamentos?.nombre ?? null,
    area:
      r.departamentos?.area === "OPERATIVA" || r.departamentos?.area === "ADMINISTRATIVA"
        ? r.departamentos.area
        : null,
    orden: r.orden ?? null,
    puesto_nombre: r.puestos?.nombre ?? null,
  };
}

export async function fetchPortalEmpleoPorSlug(slug: string): Promise<EmpleoPortal | null> {
  try {
    const supabase = serviceClient();

    const empresa = await findEmpresaPublica(supabase, slug);
    if (!empresa) return null;

    const { data: ofertasRows, error: ofertasErr } = await supabase
      .from("vacantes")
      .select(`
        id, empresa_id, titulo, descripcion, categoria, ubicacion,
        tipo_jornada, tipo_contrato, salario_rango, cuestionario, fecha_creacion, orden,
        visible_publicamente, estado_publicacion,
        departamento_id, puesto_id,
        departamentos(nombre, area),
        puestos(nombre)
      `)
      .eq("empresa_id", empresa.id)
      .eq("visible_publicamente", true)
      .eq("estado_publicacion", "publicada")
      .order("orden", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (ofertasErr) {
      console.error("[empleo-fetch] vacantes error:", ofertasErr.message);
      return { empresa: rowToEmpresa(empresa), ofertas: [] };
    }

    return {
      empresa: rowToEmpresa(empresa),
      ofertas: ((ofertasRows ?? []) as unknown as VacanteRow[]).map(rowToOferta),
    };
  } catch (err) {
    console.error("[empleo-fetch] fatal:", err);
    return null;
  }
}

export async function fetchOfertaPublica(
  slug: string,
  ofertaId: string,
): Promise<EmpleoOfertaDetalle | null> {
  try {
    const supabase = serviceClient();

    const empresa = await findEmpresaPublica(supabase, slug);
    if (!empresa) return null;

    const { data: ofertaRow, error: ofertaErr } = await supabase
      .from("vacantes")
      .select(`
        id, empresa_id, titulo, descripcion, categoria, ubicacion,
        tipo_jornada, tipo_contrato, salario_rango, cuestionario, cuestionario_plantilla_id,
        fecha_creacion, orden,
        visible_publicamente, estado_publicacion,
        departamento_id, puesto_id,
        departamentos(nombre, area),
        puestos(nombre)
      `)
      .eq("id", ofertaId)
      .eq("empresa_id", empresa.id)
      .eq("visible_publicamente", true)
      .eq("estado_publicacion", "publicada")
      .maybeSingle<VacanteRow>();

    if (ofertaErr || !ofertaRow) return null;

    const oferta = rowToOferta(ofertaRow);

    // Cuestionario obligatorio (si la vacante lo tiene asignado).
    if (ofertaRow.cuestionario_plantilla_id) {
      const { data: cuest } = await supabase
        .from("reclutamiento_plantillas_cuestionario")
        .select("id, nombre, descripcion, preguntas, activa")
        .eq("id", ofertaRow.cuestionario_plantilla_id)
        .eq("empresa_id", empresa.id)
        .maybeSingle();
      if (cuest && cuest.activa && Array.isArray(cuest.preguntas) && cuest.preguntas.length > 0) {
        // SEGURIDAD: nunca enviamos al navegador qué opción es la correcta
        // (el candidato podría verlo en el código). La nota se calcula en el
        // servidor (/api/empleo/candidatura) leyendo la plantilla desde la BD.
        const preguntasPublicas: PreguntaCuestionario[] = (cuest.preguntas as PreguntaCuestionario[]).map(
          (p) => ({
            ...p,
            opciones: p.opciones.map((o) => ({ id: o.id, texto: o.texto, correcta: false })),
          }),
        );
        oferta.cuestionarioPlantilla = {
          id: cuest.id as string,
          nombre: cuest.nombre as string,
          descripcion: (cuest.descripcion as string | null) ?? null,
          preguntas: preguntasPublicas,
        };
      }
    }

    return {
      empresa: rowToEmpresa(empresa),
      oferta,
    };
  } catch (err) {
    console.error("[empleo-fetch] fatal:", err);
    return null;
  }
}

/**
 * Lista los orígenes activos del catálogo «¿Por dónde nos has conocido?» de la
 * empresa (`reclutamiento_origenes`), para el desplegable obligatorio del
 * formulario público. Service client porque el portal es público (sin sesión).
 * Devuelve solo los NOMBRES, en su orden de configuración.
 */
export async function fetchOrigenesPublicos(empresaId: string): Promise<string[]> {
  try {
    const supabase = serviceClient();
    const { data, error } = await supabase
      .from("reclutamiento_origenes")
      .select("nombre, orden")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error || !data) return [];
    return data.map((r) => r.nombre as string);
  } catch (err) {
    console.error("[empleo-fetch] fetchOrigenesPublicos:", err);
    return [];
  }
}

/**
 * Lee la config de campos del formulario de candidatura de la empresa
 * (`reclutamiento_config.campos_formulario`). Service client (portal público).
 * Devuelve siempre las 7 claves normalizadas (defaults si no hay fila).
 */
export async function fetchCamposFormularioPublico(
  empresaId: string,
): Promise<CamposFormularioConfig> {
  try {
    const supabase = serviceClient();
    const { data } = await supabase
      .from("reclutamiento_config")
      .select("campos_formulario")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    return normalizarCamposFormulario(data?.campos_formulario);
  } catch (err) {
    console.error("[empleo-fetch] fetchCamposFormularioPublico:", err);
    return normalizarCamposFormulario(null);
  }
}

// ─── Paso «Documentación»: resolución del candidato por token ──────────────────

export interface DocumentacionPublica {
  empresa: EmpresaPublica;
  candidatoNombre: string;
  /** Token tal cual (lo reenvía el formulario al enviar). */
  token: string;
  /** true si el candidato ya completó su documentación (vista de "ya enviada"). */
  yaCompletada: boolean;
}

/**
 * Resuelve la página pública de documentación a partir del token personal del
 * candidato (`candidatos.documentacion_token`). Devuelve la marca de la empresa
 * propietaria para pintar el shell, el nombre del candidato (saludo) y si ya
 * había completado la documentación. Null si el token no existe.
 */
export async function fetchDocumentacionPorToken(
  token: string,
): Promise<DocumentacionPublica | null> {
  try {
    const safe = token.trim();
    if (!safe) return null;
    const supabase = serviceClient();

    const { data: cand } = await supabase
      .from("candidatos")
      .select("nombre, apellidos, empresa_id, documentacion_completada_at")
      .eq("documentacion_token", safe)
      .maybeSingle();
    if (!cand) return null;

    const { data: emp } = await supabase
      .from("empresas")
      .select(EMPRESA_COLS)
      .eq("id", cand.empresa_id as string)
      .maybeSingle<EmpresaRow>();
    if (!emp) return null;

    const nombre = [(cand.nombre as string | null) ?? "", (cand.apellidos as string | null) ?? ""]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      empresa: rowToEmpresa(emp),
      candidatoNombre: nombre,
      token: safe,
      yaCompletada: !!cand.documentacion_completada_at,
    };
  } catch (err) {
    console.error("[empleo-fetch] documentacion fatal:", err);
    return null;
  }
}
