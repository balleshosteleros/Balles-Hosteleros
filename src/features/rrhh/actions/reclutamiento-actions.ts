"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganigrama } from "@/features/direccion/actions/organigrama-actions";
import { orgChartsPorEmpresa, type AreaType, type OrgNode } from "@/features/direccion/data/direccion";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/**
 * Resuelve el slug ("habana", "bacanal") desde el UUID de empresa, que es
 * lo que indexa los organigramas. Devuelve null si no existe.
 */
async function getEmpresaSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("empresas")
    .select("slug")
    .eq("id", empresaId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

/**
 * Resuelve el UUID desde el slug. Sirve cuando la vista pasa el slug
 * seleccionado en el contexto de empresa para sobrescribir el de profile.
 */
async function getEmpresaIdFromSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function listCandidatos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("candidatos")
      .select("*, vacantes(id,titulo,puesto_id,departamento_id)")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[reclutamiento] listCandidatos:", err);
    return { ok: false, data: [] };
  }
}

interface VacanteRowReal {
  id: string;
  empresa_id: string;
  titulo: string;
  categoria: string | null;
  ubicacion: string | null;
  tipo_jornada: string | null;
  estado_publicacion: string;
  visible_publicamente: boolean;
  fecha_creacion: string;
  cuestionario: boolean;
  favorita: boolean;
  departamentos: { nombre: string } | null;
  puestos: { nombre: string } | null;
}

interface CandidatoRowReal {
  id: string;
  empresa_id: string;
  vacante_id: string | null;
  nombre: string;
  apellidos: string | null;
  email: string;
  telefono: string | null;
  cv_url: string | null;
  notas: string | null;
  origen: string;
  fase: string;
  estado: string;
  promovido_at: string | null;
  empleado_id: string | null;
  created_at: string;
}

/**
 * Devuelve vacantes + candidatos asociados con la forma legacy
 * que consume ReclutamientoView (VacanteCard, KanbanPipeline, AllCandidatosView).
 * Mapea estructura real Supabase → tipo `Vacante` heredado.
 */
export async function listVacantesConCandidatos(empresaSlug?: string | null) {
  try {
    const { supabase, empresaId: profileEmpresaId } = await getContext();
    // Si la vista pasa un slug (selector de empresa del cliente), prevalece sobre el del profile.
    const empresaId = empresaSlug
      ? (await getEmpresaIdFromSlug(supabase, empresaSlug)) ?? profileEmpresaId
      : profileEmpresaId;
    if (!empresaId) return { ok: false, data: [] };

    const [vacRes, candRes] = await Promise.all([
      supabase
        .from("vacantes")
        .select(`
          id, empresa_id, titulo, categoria, ubicacion, tipo_jornada,
          estado_publicacion, visible_publicamente, fecha_creacion,
          cuestionario, favorita,
          departamentos(nombre),
          puestos(nombre)
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidatos")
        .select(`
          id, empresa_id, vacante_id, nombre, apellidos, email, telefono,
          cv_url, notas, origen, fase, estado, promovido_at, empleado_id,
          created_at
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false }),
    ]);

    if (vacRes.error) throw vacRes.error;
    const vacantes = (vacRes.data ?? []) as unknown as VacanteRowReal[];
    const candidatos = ((candRes.data ?? []) as unknown as CandidatoRowReal[]);

    const candidatosByVacante = new Map<string, CandidatoRowReal[]>();
    for (const c of candidatos) {
      const k = c.vacante_id ?? "_sin_vacante";
      if (!candidatosByVacante.has(k)) candidatosByVacante.set(k, []);
      candidatosByVacante.get(k)!.push(c);
    }

    const ESTADOS_VALIDOS = new Set([
      "nuevo", "elegido", "papelera", "entrevista", "teorica",
      "practica", "prueba", "empleado", "no_se_presenta", "suspenso_formacion",
    ]);
    const ORIGENES_VALIDOS = new Set([
      "web", "formulario", "redes_sociales", "recomendacion",
      "base_datos", "portal_empleo", "otros",
    ]);
    const JORNADAS_VALIDAS = new Set(["completa", "parcial", "temporal", "indefinido", "practicas"]);

    // ── Cada vacante toma su área del nodo del organigrama cuyo label
    // coincide con el `titulo` (case-insensitive). Si no hay match, cae
    // en "administrativa" por defecto.
    const slugResuelto = empresaSlug ?? (await getEmpresaSlug(supabase, empresaId));
    const organigrama = slugResuelto
      ? ((await getOrganigrama(slugResuelto)) ?? orgChartsPorEmpresa[slugResuelto] ?? null)
      : null;
    const nodos: OrgNode[] = organigrama?.nodes ?? [];
    const norm = (s: string) => s.trim().toLowerCase();
    const nodoPorTitulo = new Map<string, OrgNode>();
    for (const n of nodos) nodoPorTitulo.set(norm(n.label), n);

    const data = vacantes.map((v) => {
      const cands = candidatosByVacante.get(v.id) ?? [];
      const nodo = nodoPorTitulo.get(norm(v.titulo));
      const area: AreaType = (nodo?.area as string) === "operativa" ? "operativa" : "administrativa";
      return {
        id: v.id,
        puesto: v.titulo,
        categoria: v.departamentos?.nombre ?? v.categoria ?? "Sin categoría",
        ubicacion: v.ubicacion ?? "",
        tipoJornada: JORNADAS_VALIDAS.has(v.tipo_jornada ?? "") ? v.tipo_jornada : "completa",
        estadoPublicacion: v.estado_publicacion,
        fechaCreacion: v.fecha_creacion,
        cuestionario: v.cuestionario,
        reclutadores: [] as string[],
        favorita: v.favorita,
        empresaId: v.empresa_id,
        visiblePublicamente: v.visible_publicamente,
        area,
        organigramaNodeId: nodo?.id ?? null,
        candidatos: cands.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          apellidos: c.apellidos ?? "",
          telefono: c.telefono ?? "",
          email: c.email,
          cvAdjunto: c.cv_url ?? undefined,
          fechaInscripcion: c.created_at?.slice(0, 10) ?? "",
          origen: ORIGENES_VALIDOS.has(c.origen) ? c.origen : "otros",
          notasInternas: c.notas ?? "",
          fase: ESTADOS_VALIDOS.has(c.estado) ? c.estado : "nuevo",
          vacanteId: v.id,
          reclutadorAsignado: "",
          historial: [] as never[],
          // Extras útiles para el botón "Crear en sistema" y avisos
          promovidoAt: c.promovido_at,
          empleadoId: c.empleado_id,
        })),
      };
    });

    return { ok: true, data };
  } catch (err) {
    console.error("[reclutamiento] listVacantesConCandidatos:", err);
    return { ok: false, data: [] };
  }
}

export async function createCandidato(input: {
  nombre: string;
  apellidos?: string;
  email: string;
  telefono?: string;
  dni_nie?: string;
  vacante_id?: string;
  cv_url?: string;
  carta_presentacion?: string;
  origen?: "web" | "formulario" | "redes_sociales" | "recomendacion" | "base_datos" | "portal_empleo" | "otros";
  notas?: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("candidatos")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        apellidos: input.apellidos ?? null,
        email: input.email,
        telefono: input.telefono ?? null,
        dni_nie: input.dni_nie ?? null,
        vacante_id: input.vacante_id ?? null,
        cv_url: input.cv_url ?? null,
        carta_presentacion: input.carta_presentacion ?? null,
        origen: input.origen ?? "formulario",
        notas: input.notas ?? null,
        fase: "nuevo",
        estado: "nuevo",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] createCandidato:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCandidato(
  id: string,
  input: {
    nombre?: string;
    apellidos?: string;
    email?: string;
    telefono?: string;
    dni_nie?: string;
    vacante_id?: string;
    cv_url?: string;
    notas?: string;
    fase?: string;
    estado?: string;
    puntuacion?: number;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("candidatos")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] updateCandidato:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCandidato(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("candidatos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] deleteCandidato:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Crea una vacante (en estado borrador) por cada nodo del organigrama de la
 * empresa actual que aún no tenga una vacante con ese título. Idempotente:
 * llamarlo varias veces no duplica ofertas.
 */
export async function seedVacantesDesdeOrganigrama(empresaSlug?: string | null) {
  try {
    const { supabase, user, empresaId: profileEmpresaId } = await getContext();
    const empresaId = empresaSlug
      ? (await getEmpresaIdFromSlug(supabase, empresaSlug)) ?? profileEmpresaId
      : profileEmpresaId;
    if (!empresaId) return { ok: false, created: 0 };

    const slug = empresaSlug ?? (await getEmpresaSlug(supabase, empresaId));
    const organigrama = slug
      ? ((await getOrganigrama(slug)) ?? orgChartsPorEmpresa[slug] ?? null)
      : null;
    const nodos: OrgNode[] = organigrama?.nodes ?? [];
    if (nodos.length === 0) return { ok: true, created: 0 };

    const { data: existentes, error: errExist } = await supabase
      .from("vacantes")
      .select("titulo")
      .eq("empresa_id", empresaId);
    if (errExist) throw errExist;

    const norm = (s: string) => s.trim().toLowerCase();
    const titulosExistentes = new Set(
      ((existentes ?? []) as Array<{ titulo: string | null }>).map((r) =>
        norm(r.titulo ?? ""),
      ),
    );

    const aCrear = nodos.filter((n) => !titulosExistentes.has(norm(n.label)));
    if (aCrear.length === 0) return { ok: true, created: 0 };

    const rows = aCrear.map((n) => ({
      empresa_id: empresaId,
      titulo: n.label,
      tipo_jornada: "completa",
      estado_publicacion: "borrador",
      visible_publicamente: false,
      cuestionario: false,
      favorita: false,
      creado_por: user?.id ?? null,
    }));

    const { error } = await supabase.from("vacantes").insert(rows);
    if (error) throw error;
    return { ok: true, created: aCrear.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] seedVacantesDesdeOrganigrama:", msg);
    return { ok: false, created: 0 };
  }
}
