"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrganigrama } from "@/features/direccion/actions/organigrama-actions";
import { orgChartsPorEmpresa, type AreaType, type OrgNode } from "@/features/direccion/data/direccion";
import { getEmpresaActivaForUser, getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";

/**
 * Fecha+hora de un instante UTC en la zona horaria de la empresa (Ajustes →
 * Configuración regional). El servidor corre en UTC; sin `timeZone` la hora
 * saldría desfasada. Se usa el NOMBRE de zona (no un desfase fijo), así el
 * horario de verano/invierno se aplica solo según la fecha del propio instante
 * y cada registro conserva siempre la hora real que tuvo. Devuelve "" si la
 * fecha no es válida.
 */
function fmtFechaHora(iso: string | null, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  como_nos_conocio: string | null;
  fase: string;
  estado: string;
  promovido_at: string | null;
  empleado_id: string | null;
  activo: boolean | null;
  created_at: string;
  visto_at: string | null;
  fase_actualizada_at: string | null;
  // Datos de la candidatura pública
  genero: string | null;
  ubicacion: string | null;
  disponibilidad: string | null;
  experiencia_previa: string | null;
  carta_presentacion: string | null;
  // Paso «Documentación»
  dni_nie: string | null;
  iban: string | null;
  num_seguridad_social: string | null;
  doc_dni_anverso_path: string | null;
  doc_dni_reverso_path: string | null;
  doc_iban_path: string | null;
  doc_ss_path: string | null;
  foto_perfil_path: string | null;
  direccion: string | null;
  fecha_nacimiento: string | null;
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

    const [vacRes, candRes, cuestRes, resenasRes] = await Promise.all([
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
          cv_url, notas, origen, canal_nombre, como_nos_conocio, fase, estado, promovido_at, empleado_id,
          activo, created_at, visto_at, fase_actualizada_at,
          genero, ubicacion, disponibilidad, experiencia_previa, carta_presentacion,
          dni_nie, iban, num_seguridad_social,
          doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path, doc_ss_path,
          foto_perfil_path, direccion, fecha_nacimiento,
          documentacion_completada_at
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false }),
      // Resultado del cuestionario de cada candidato (1 fila por candidato).
      supabase
        .from("candidato_cuestionario_respuestas")
        .select("candidato_id, aciertos, total_preguntas")
        .eq("empresa_id", empresaId),
      // Reseñas (entrevista): se agregan en mapas más abajo para la media y el
      // distintivo de «valoración completa».
      supabase
        .from("candidato_resenas")
        .select("candidato_id, puntuaciones")
        .eq("empresa_id", empresaId),
    ]);

    if (vacRes.error) throw vacRes.error;
    const vacantes = (vacRes.data ?? []) as unknown as VacanteRowReal[];
    const candidatos = ((candRes.data ?? []) as unknown as CandidatoRowReal[]);

    // ── Cuestionario: aciertos/total por candidato ──
    const cuestPorCandidato = new Map<string, { aciertos: number; total: number }>();
    for (const r of (cuestRes.data ?? []) as { candidato_id: string; aciertos: number | null; total_preguntas: number | null }[]) {
      if (!r.candidato_id) continue;
      cuestPorCandidato.set(r.candidato_id, {
        aciertos: r.aciertos ?? 0,
        total: r.total_preguntas ?? 0,
      });
    }

    // ── Reseñas: media de estrellas + si la entrevista está valorada ──
    // Valorada (completa) = existe ≥1 reseña con criterios puntuados. El
    // formulario de reseña ya obliga a puntuar TODOS los criterios para poder
    // guardar, así que una reseña guardada equivale a valoración completa.
    const resenaAcc = new Map<string, { suma: number; n: number }>();
    for (const r of (resenasRes.data ?? []) as { candidato_id: string; puntuaciones: { criterioId?: string; estrellas?: number }[] | null }[]) {
      if (!r.candidato_id) continue;
      const punts = Array.isArray(r.puntuaciones) ? r.puntuaciones : [];
      const valoradas = punts.filter((p) => (p?.estrellas ?? 0) > 0);
      const acc = resenaAcc.get(r.candidato_id) ?? { suma: 0, n: 0 };
      for (const p of valoradas) { acc.suma += p.estrellas ?? 0; acc.n += 1; }
      resenaAcc.set(r.candidato_id, acc);
    }
    const resenasPorCandidato = new Map<string, { media: number | null; completas: boolean }>();
    for (const [candId, acc] of resenaAcc) {
      resenasPorCandidato.set(candId, {
        media: acc.n > 0 ? acc.suma / acc.n : null,
        completas: acc.n > 0,
      });
    }

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
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
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
        candidatos: cands.map((c) => {
          const cuest = cuestPorCandidato.get(c.id);
          const resena = resenasPorCandidato.get(c.id);
          return {
          id: c.id,
          nombre: c.nombre,
          apellidos: c.apellidos ?? "",
          telefono: c.telefono ?? "",
          email: c.email,
          cvAdjunto: c.cv_url ?? undefined,
          fechaInscripcion: c.created_at?.slice(0, 10) ?? "",
          fechaInscripcionFull: fmtFechaHora(c.created_at ?? null, tz),
          origen: ORIGENES_VALIDOS.has(c.origen) ? c.origen : "otros",
          canal: c.canal_nombre ?? null,
          comoNosConocio: c.como_nos_conocio ?? null,
          notasInternas: c.notas ?? "",
          // Datos aportados en la candidatura pública (género, ubicación, disponibilidad)
          ubicacion: c.ubicacion ?? undefined,
          genero: c.genero === "masculino" || c.genero === "femenino" ? c.genero : undefined,
          disponibilidad:
            c.disponibilidad === "inmediato" || c.disponibilidad === "15_dias"
              ? c.disponibilidad
              : undefined,
          experienciaPrevia:
            c.experiencia_previa === "sin_experiencia" ||
            c.experiencia_previa === "menos_1" ||
            c.experiencia_previa === "de_1_a_5" ||
            c.experiencia_previa === "mas_5"
              ? c.experiencia_previa
              : undefined,
          // Carta de presentación escrita por el candidato (campo opcional).
          sobreTi: c.carta_presentacion ?? undefined,
          fase: ESTADOS_VALIDOS.has(c.estado) ? c.estado : "nuevo",
          vacanteId: v.id,
          reclutadorAsignado: "",
          historial: [] as never[],
          activo: c.activo ?? true,
          // Revisión (tick «visto») y antigüedad en la fase actual (contador de días).
          vistoAt: c.visto_at ?? null,
          faseActualizadaAt: c.fase_actualizada_at ?? c.created_at ?? null,
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
          fotoPerfilPath: c.foto_perfil_path ?? null,
          direccion: c.direccion ?? null,
          fechaNacimiento: c.fecha_nacimiento ?? null,
          documentacionCompletadaAt: c.documentacion_completada_at ?? null,
          // Cuestionario de la vacante (null si no lo ha respondido)
          cuestionarioAciertos: cuest ? cuest.aciertos : null,
          cuestionarioTotal: cuest ? cuest.total : null,
          // Reseñas (entrevista)
          resenaMedia: resena?.media ?? null,
          resenasCompletas: resena?.completas ?? false,
          };
        }),
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
