"use server";

import { revalidatePath } from "next/cache";
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
  orden: number | null;
  puesto_id: string | null;
  departamentos: { nombre: string; area: string | null } | null;
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
  canal_nombre: string | null;
  fase: string;
  estado: string;
  promovido_at: string | null;
  empleado_id: string | null;
  activo: boolean | null;
  created_at: string;
  // Paso «Documentación»
  dni_nie: string | null;
  iban: string | null;
  num_seguridad_social: string | null;
  doc_dni_anverso_path: string | null;
  doc_dni_reverso_path: string | null;
  doc_iban_path: string | null;
  doc_ss_path: string | null;
  documentacion_completada_at: string | null;
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
          cuestionario, favorita, orden, puesto_id,
          departamentos(nombre, area),
          puestos(nombre)
        `)
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("candidatos")
        .select(`
          id, empresa_id, vacante_id, nombre, apellidos, email, telefono,
          cv_url, notas, origen, canal_nombre, fase, estado, promovido_at, empleado_id,
          activo, created_at,
          dni_nie, iban, num_seguridad_social,
          doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path, doc_ss_path,
          documentacion_completada_at
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
      "nuevo", "elegido", "papelera", "entrevista", "documentacion", "teorica",
      "practica", "prueba", "empleado", "no_se_presenta", "suspenso_formacion",
    ]);
    const ORIGENES_VALIDOS = new Set([
      "web", "formulario", "redes_sociales", "recomendacion",
      "base_datos", "portal_empleo", "otros",
    ]);

    // ── El área (operativa/administrativa) de una vacante la define su
    // DEPARTAMENTO (`departamentos.area`), que es la fuente canónica del
    // proyecto. El organigrama solo se usa como respaldo para vacantes sin
    // departamento asignado, cruzando su `titulo` con el label del nodo.
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
      // 1º el área del departamento (canónica); 2º respaldo al organigrama.
      const areaDepto = v.departamentos?.area?.toLowerCase();
      const area: AreaType =
        areaDepto === "operativa" || areaDepto === "administrativa"
          ? (areaDepto as AreaType)
          : (nodo?.area as string) === "operativa"
            ? "operativa"
            : "administrativa";
      return {
        id: v.id,
        puesto: v.titulo,
        categoria: v.departamentos?.nombre ?? v.categoria ?? "Sin categoría",
        ubicacion: v.ubicacion ?? "",
        tipoJornada: v.tipo_jornada ?? "",
        estadoPublicacion: v.estado_publicacion,
        fechaCreacion: v.fecha_creacion,
        cuestionario: v.cuestionario,
        reclutadores: [] as string[],
        favorita: v.favorita,
        empresaId: v.empresa_id,
        puestoId: v.puesto_id ?? null,
        visiblePublicamente: v.visible_publicamente,
        orden: v.orden ?? null,
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
          canal: c.canal_nombre ?? null,
          notasInternas: c.notas ?? "",
          fase: ESTADOS_VALIDOS.has(c.estado) ? c.estado : "nuevo",
          vacanteId: v.id,
          reclutadorAsignado: "",
          historial: [] as never[],
          activo: c.activo ?? true,
          // Extras útiles para el botón "Crear en sistema" y avisos
          promovidoAt: c.promovido_at,
          empleadoId: c.empleado_id,
          // Paso «Documentación»
          dniNie: c.dni_nie ?? null,
          iban: c.iban ?? null,
          numSeguridadSocial: c.num_seguridad_social ?? null,
          docDniAnversoPath: c.doc_dni_anverso_path ?? null,
          docDniReversoPath: c.doc_dni_reverso_path ?? null,
          docIbanPath: c.doc_iban_path ?? null,
          docSsPath: c.doc_ss_path ?? null,
          documentacionCompletadaAt: c.documentacion_completada_at ?? null,
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
 * Regla del modelo: «todo PUESTO tiene su vacante». Garantiza que cada puesto
 * activo de la empresa tenga exactamente una vacante enlazada por `puesto_id`.
 * Idempotente y ADITIVO (nunca borra): crea las que falten —en borrador, para
 * no exponerlas en el portal público sin revisión— heredando el departamento
 * del puesto, y enlaza por nombre las vacantes homónimas que existieran sueltas.
 */
export async function asegurarVacantesPorPuesto(empresaSlug?: string | null) {
  try {
    const { supabase, user, empresaId: profileEmpresaId } = await getContext();
    const empresaId = empresaSlug
      ? (await getEmpresaIdFromSlug(supabase, empresaSlug)) ?? profileEmpresaId
      : profileEmpresaId;
    if (!empresaId) return { ok: false, created: 0 };

    const [puestosRes, vacantesRes] = await Promise.all([
      supabase
        .from("puestos")
        .select("id, nombre, departamento_id")
        .eq("empresa_id", empresaId)
        .eq("estado", "activo"),
      supabase
        .from("vacantes")
        .select("id, titulo, puesto_id")
        .eq("empresa_id", empresaId),
    ]);

    const puestos = (puestosRes.data ?? []) as Array<{
      id: string; nombre: string; departamento_id: string | null;
    }>;
    const vacantes = (vacantesRes.data ?? []) as Array<{
      id: string; titulo: string | null; puesto_id: string | null;
    }>;
    if (puestos.length === 0) return { ok: true, created: 0 };

    const norm = (s: string) => s.trim().toLowerCase();
    const puestoIdConVacante = new Set(
      vacantes.map((v) => v.puesto_id).filter(Boolean) as string[],
    );
    const vacantePorNombre = new Map<string, { id: string; puesto_id: string | null }>();
    for (const v of vacantes) vacantePorNombre.set(norm(v.titulo ?? ""), v);

    const aCrear: Array<Record<string, unknown>> = [];
    for (const p of puestos) {
      if (puestoIdConVacante.has(p.id)) continue; // ya tiene su vacante
      const homonima = vacantePorNombre.get(norm(p.nombre));
      if (homonima) {
        // Existe una vacante con el mismo nombre pero sin enlazar → enlazar.
        if (!homonima.puesto_id) {
          await supabase
            .from("vacantes")
            .update({ puesto_id: p.id, departamento_id: p.departamento_id })
            .eq("id", homonima.id);
        }
        continue;
      }
      aCrear.push({
        empresa_id: empresaId,
        titulo: p.nombre,
        puesto_id: p.id,
        departamento_id: p.departamento_id,
        tipo_jornada: "Jornada completa",
        tipo_contrato: "Indefinido",
        estado_publicacion: "borrador",
        visible_publicamente: false,
        cuestionario: false,
        favorita: false,
        creado_por: user?.id ?? null,
      });
    }

    if (aCrear.length > 0) {
      const { error } = await supabase.from("vacantes").insert(aCrear);
      if (error) throw error;
    }
    return { ok: true, created: aCrear.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] asegurarVacantesPorPuesto:", msg);
    return { ok: false, created: 0 };
  }
}

/* ─── URL personalizable del portal de empleo ─────────────────────────────
 * El portal de empleo público resuelve por `empresas.empleo_slug` (cae a
 * `slug` si está vacío). Es independiente del slug global — que es FK lógica
 * en accesos_apps / organigramas / logos — para que renombrar la URL de
 * empleo no rompa nada más. Único entre empresas (índice + validación aquí).
 * ------------------------------------------------------------------------- */

/** Normaliza una URL de empleo: quita acentos, deja [A-Za-z0-9-], conserva
 *  mayúsculas (para poder mostrar "Habana" tal cual el nombre comercial). */
function sanitizeEmpleoSlug(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** ¿Hay OTRA empresa usando este nombre (en empleo_slug o en su slug global)? */
async function empleoSlugOcupado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  valor: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("empresas")
    .select("id")
    .neq("id", empresaId)
    .or(`empleo_slug.ilike.${valor},slug.ilike.${valor}`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export interface EmpleoUrlConfig {
  empleoSlug: string;
  /** Nombre comercial — valor por defecto sugerido para la URL. */
  nombreComercial: string;
}

/** Lee la URL de empleo actual de la empresa activa (cae al nombre comercial). */
export async function getEmpleoUrlConfig(): Promise<EmpleoUrlConfig | null> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return null;
    const { data } = await supabase
      .from("empresas")
      .select("nombre, slug, empleo_slug")
      .eq("id", empresaId)
      .maybeSingle();
    if (!data) return null;
    const nombreComercial = (data.nombre as string | null) ?? "";
    const empleoSlug =
      (data.empleo_slug as string | null) ??
      (data.slug as string | null) ??
      sanitizeEmpleoSlug(nombreComercial);
    return { empleoSlug, nombreComercial };
  } catch (err) {
    console.error("[reclutamiento] getEmpleoUrlConfig:", err);
    return null;
  }
}

export type GuardarEmpleoUrlResult =
  | { ok: true; empleoSlug: string }
  | { ok: false; error: string; sugerencia?: string };

/** Guarda la URL de empleo de la empresa activa, garantizando unicidad. */
export async function updateEmpleoUrlSlug(raw: string): Promise<GuardarEmpleoUrlResult> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa." };

    const valor = sanitizeEmpleoSlug(raw);
    if (!valor) {
      return {
        ok: false,
        error: "Escribe un nombre válido (solo letras, números y guiones).",
      };
    }
    if (valor.length < 2 || valor.length > 60) {
      return { ok: false, error: "El nombre debe tener entre 2 y 60 caracteres." };
    }

    if (await empleoSlugOcupado(supabase, empresaId, valor)) {
      // Sugerimos la primera variante libre: nombre-2, nombre-3, …
      let sugerencia: string | undefined;
      for (let i = 2; i <= 9; i++) {
        const candidato = `${valor}-${i}`;
        if (!(await empleoSlugOcupado(supabase, empresaId, candidato))) {
          sugerencia = candidato;
          break;
        }
      }
      return {
        ok: false,
        error: `Otra empresa ya usa "${valor}" en su URL. Prueba con otro nombre.`,
        sugerencia,
      };
    }

    const { error } = await supabase
      .from("empresas")
      .update({ empleo_slug: valor })
      .eq("id", empresaId);
    if (error) {
      // Carrera con el índice único: lo tratamos como colisión.
      if (error.code === "23505") {
        return { ok: false, error: `Otra empresa ya usa "${valor}" en su URL. Prueba con otro nombre.` };
      }
      throw error;
    }

    revalidatePath(`/empleo/${valor}`);
    return { ok: true, empleoSlug: valor };
  } catch (err) {
    console.error("[reclutamiento] updateEmpleoUrlSlug:", err);
    return { ok: false, error: "No se pudo guardar la URL. Inténtalo de nuevo." };
  }
}
