/**
 * Lectura pública de ofertas de empleo por slug de empresa (server-side).
 * Solo devuelve vacantes con estado_publicacion='publicada' AND visible_publicamente=true.
 * Usado por las rutas /empleo/[slug] y /empleo/[slug]/[oferta-id].
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";

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
  salario_rango: string | null;
  cuestionario: boolean;
  fecha_creacion: string;
  departamento_nombre: string | null;
  /** Área del departamento de la vacante: gobierna la columna del portal. */
  area: "OPERATIVA" | "ADMINISTRATIVA" | null;
  orden: number | null;
  puesto_nombre: string | null;
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
  salario_rango: string | null;
  cuestionario: boolean;
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
        tipo_jornada, salario_rango, cuestionario, fecha_creacion, orden,
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
        tipo_jornada, salario_rango, cuestionario, fecha_creacion, orden,
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

    return {
      empresa: rowToEmpresa(empresa),
      oferta: rowToOferta(ofertaRow),
    };
  } catch (err) {
    console.error("[empleo-fetch] fatal:", err);
    return null;
  }
}
