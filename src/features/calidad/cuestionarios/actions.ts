"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type {
  CampanaDetalle,
  CampanaResumen,
  EnvioCompleto,
  EnvioFila,
  EstadoPunto,
  EstadoReunion,
  PlantillaCuestionario,
  PuntoTimeline,
} from "./types";
import { rangoSemestre } from "./types";
import type {
  BloqueCuestionario,
  CategoriaCuestionario,
} from "@/features/calidad/data/cuestionarios";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

type PlantillaRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  duracion_minutos: number;
  intentos_max: number;
  nota_corte: number;
  mostrar_resultados: boolean;
  aleatorizar_preguntas: boolean;
  mensaje_inicial: string;
  mensaje_aprobado: string;
  mensaje_no_aprobado: string;
  bloques: BloqueCuestionario[];
  archivada: boolean;
  created_at: string;
  updated_at: string;
};

function mapPlantilla(row: PlantillaRow): PlantillaCuestionario {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? "",
    categoria: row.categoria as CategoriaCuestionario,
    duracionMinutos: row.duracion_minutos,
    intentosMax: row.intentos_max,
    notaCorte: row.nota_corte,
    mostrarResultados: row.mostrar_resultados,
    aleatorizarPreguntas: row.aleatorizar_preguntas,
    mensajeInicial: row.mensaje_inicial,
    mensajeAprobado: row.mensaje_aprobado,
    mensajeNoAprobado: row.mensaje_no_aprobado,
    bloques: row.bloques ?? [],
    archivada: row.archivada,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── PLANTILLAS ─────────────────────────────────────────────

export async function listPlantillas(): Promise<PlantillaCuestionario[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("cuestionario_plantillas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[cuestionarios] listPlantillas:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapPlantilla(r as PlantillaRow));
}

export async function getPlantilla(id: string): Promise<PlantillaCuestionario | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;
  const { data, error } = await supabase
    .from("cuestionario_plantillas")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !data) return null;
  return mapPlantilla(data as PlantillaRow);
}

const crearPlantillaSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre obligatorio").max(160),
  descripcion: z.string().max(800).optional().default(""),
  categoria: z
    .enum(["evaluacion", "formacion", "conocimiento", "induccion"])
    .default("evaluacion"),
});

export async function crearPlantilla(
  input: z.infer<typeof crearPlantillaSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = crearPlantillaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  const { supabase, user, empresaId } = await ctx();
  if (!user || !empresaId) return { ok: false, error: "Sin sesión" };
  const { data, error } = await supabase
    .from("cuestionario_plantillas")
    .insert({
      empresa_id: empresaId,
      nombre: parsed.data.nombre,
      descripcion: parsed.data.descripcion,
      categoria: parsed.data.categoria,
      bloques: [],
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Error" };
  revalidatePath("/calidad/cuestionarios");
  return { ok: true, id: data.id };
}

const updatePlantillaSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().trim().min(1).max(160).optional(),
  descripcion: z.string().max(800).optional(),
  categoria: z.enum(["evaluacion", "formacion", "conocimiento", "induccion"]).optional(),
  duracionMinutos: z.number().int().min(1).max(240).optional(),
  intentosMax: z.number().int().min(1).max(10).optional(),
  notaCorte: z.number().int().min(0).max(100).optional(),
  mostrarResultados: z.boolean().optional(),
  aleatorizarPreguntas: z.boolean().optional(),
  mensajeInicial: z.string().max(1000).optional(),
  mensajeAprobado: z.string().max(1000).optional(),
  mensajeNoAprobado: z.string().max(1000).optional(),
  bloques: z.array(z.unknown()).optional(),
  archivada: z.boolean().optional(),
});

export async function updatePlantilla(
  input: z.infer<typeof updatePlantillaSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updatePlantillaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const patch: Record<string, unknown> = {};
  if (parsed.data.nombre !== undefined) patch.nombre = parsed.data.nombre;
  if (parsed.data.descripcion !== undefined) patch.descripcion = parsed.data.descripcion;
  if (parsed.data.categoria !== undefined) patch.categoria = parsed.data.categoria;
  if (parsed.data.duracionMinutos !== undefined) patch.duracion_minutos = parsed.data.duracionMinutos;
  if (parsed.data.intentosMax !== undefined) patch.intentos_max = parsed.data.intentosMax;
  if (parsed.data.notaCorte !== undefined) patch.nota_corte = parsed.data.notaCorte;
  if (parsed.data.mostrarResultados !== undefined) patch.mostrar_resultados = parsed.data.mostrarResultados;
  if (parsed.data.aleatorizarPreguntas !== undefined) patch.aleatorizar_preguntas = parsed.data.aleatorizarPreguntas;
  if (parsed.data.mensajeInicial !== undefined) patch.mensaje_inicial = parsed.data.mensajeInicial;
  if (parsed.data.mensajeAprobado !== undefined) patch.mensaje_aprobado = parsed.data.mensajeAprobado;
  if (parsed.data.mensajeNoAprobado !== undefined) patch.mensaje_no_aprobado = parsed.data.mensajeNoAprobado;
  if (parsed.data.bloques !== undefined) patch.bloques = parsed.data.bloques;
  if (parsed.data.archivada !== undefined) patch.archivada = parsed.data.archivada;

  const { error } = await supabase
    .from("cuestionario_plantillas")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/cuestionarios");
  return { ok: true };
}

export async function deletePlantilla(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  // bloquear si tiene campañas
  const { count } = await supabase
    .from("cuestionario_campanas")
    .select("id", { count: "exact", head: true })
    .eq("plantilla_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "La plantilla tiene campañas asociadas. Archívala en su lugar." };
  }
  const { error } = await supabase
    .from("cuestionario_plantillas")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/cuestionarios");
  return { ok: true };
}

// ─── CAMPAÑAS ────────────────────────────────────────────────

type CampanaRow = {
  id: string;
  empresa_id: string;
  plantilla_id: string;
  periodo: string;
  periodo_inicio: string;
  periodo_fin: string;
  estado: string;
  created_at: string;
  plantilla?: { nombre: string } | null;
};

export async function listCampanas(): Promise<CampanaResumen[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data: campanas, error } = await supabase
    .from("cuestionario_campanas")
    .select("id, empresa_id, plantilla_id, periodo, periodo_inicio, periodo_fin, estado, created_at, plantilla:cuestionario_plantillas!inner(nombre)")
    .eq("empresa_id", empresaId)
    .order("periodo_inicio", { ascending: false });

  if (error) {
    console.error("[cuestionarios] listCampanas:", error.message);
    return [];
  }

  const ids = (campanas ?? []).map((c) => c.id);
  if (ids.length === 0) return [];

  // Agregados por campaña
  const { data: envios } = await supabase
    .from("cuestionario_envios")
    .select("campana_id, respondido_at, reunion_estado")
    .in("campana_id", ids);

  const agg = new Map<
    string,
    { total: number; respondidos: number; reunionesHechas: number }
  >();
  for (const e of envios ?? []) {
    const cur = agg.get(e.campana_id) ?? { total: 0, respondidos: 0, reunionesHechas: 0 };
    cur.total += 1;
    if (e.respondido_at) cur.respondidos += 1;
    if (e.reunion_estado === "realizada") cur.reunionesHechas += 1;
    agg.set(e.campana_id, cur);
  }

  return (campanas ?? []).map((c) => {
    const row = c as unknown as CampanaRow;
    const a = agg.get(row.id) ?? { total: 0, respondidos: 0, reunionesHechas: 0 };
    return {
      id: row.id,
      empresaId: row.empresa_id,
      plantillaId: row.plantilla_id,
      plantillaNombre: row.plantilla?.nombre ?? "(sin plantilla)",
      periodo: row.periodo,
      periodoInicio: row.periodo_inicio,
      periodoFin: row.periodo_fin,
      estado: row.estado as CampanaResumen["estado"],
      createdAt: row.created_at,
      totalEnvios: a.total,
      envioRespondidos: a.respondidos,
      envioReunionesHechas: a.reunionesHechas,
    };
  });
}

const crearCampanaSchema = z.object({
  plantillaId: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-S[12]$/, "Periodo inválido"),
});

export async function crearCampana(
  input: z.infer<typeof crearCampanaSchema>,
): Promise<{ ok: true; id: string; envios: number } | { ok: false; error: string }> {
  const parsed = crearCampanaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  const { supabase, user, empresaId } = await ctx();
  if (!user || !empresaId) return { ok: false, error: "Sin sesión" };

  const { inicio, fin } = rangoSemestre(parsed.data.periodo);

  // 1. Insertar campaña
  const { data: nueva, error: errCampana } = await supabase
    .from("cuestionario_campanas")
    .insert({
      empresa_id: empresaId,
      plantilla_id: parsed.data.plantillaId,
      periodo: parsed.data.periodo,
      periodo_inicio: inicio,
      periodo_fin: fin,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (errCampana || !nueva) {
    if (errCampana?.code === "23505") {
      return { ok: false, error: `Ya existe una campaña para ${parsed.data.periodo}.` };
    }
    return { ok: false, error: errCampana?.message ?? "Error creando campaña" };
  }

  // 2. Explosión a envíos: 1 por empleado activo
  const { data: empleados } = await supabase
    .from("empleados")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo");

  if (empleados && empleados.length > 0) {
    const filas = empleados.map((e) => ({
      campana_id: nueva.id,
      empresa_id: empresaId,
      empleado_id: e.id,
    }));
    const { error: errEnvios } = await supabase.from("cuestionario_envios").insert(filas);
    if (errEnvios) {
      // rollback manual de la campaña
      await supabase.from("cuestionario_campanas").delete().eq("id", nueva.id);
      return { ok: false, error: `Error generando envíos: ${errEnvios.message}` };
    }
  }

  revalidatePath("/calidad/cuestionarios");
  return { ok: true, id: nueva.id, envios: empleados?.length ?? 0 };
}

export async function sincronizarEmpleados(
  campanaId: string,
): Promise<{ ok: true; nuevos: number } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const { data: campana } = await supabase
    .from("cuestionario_campanas")
    .select("id, empresa_id")
    .eq("id", campanaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!campana) return { ok: false, error: "Campaña no encontrada" };

  const { data: yaEnviados } = await supabase
    .from("cuestionario_envios")
    .select("empleado_id")
    .eq("campana_id", campanaId);

  const yaSet = new Set((yaEnviados ?? []).map((r) => r.empleado_id));

  const { data: empleados } = await supabase
    .from("empleados")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo");

  const nuevos = (empleados ?? []).filter((e) => !yaSet.has(e.id));
  if (nuevos.length === 0) {
    return { ok: true, nuevos: 0 };
  }

  const { error } = await supabase.from("cuestionario_envios").insert(
    nuevos.map((e) => ({
      campana_id: campanaId,
      empresa_id: empresaId,
      empleado_id: e.id,
    })),
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/calidad/cuestionarios/${campanaId}`);
  return { ok: true, nuevos: nuevos.length };
}

export async function cerrarCampana(
  campanaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("cuestionario_campanas")
    .update({ estado: "cerrada" })
    .eq("id", campanaId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/cuestionarios");
  return { ok: true };
}

// ─── DETALLE DE CAMPAÑA ──────────────────────────────────────

type EnvioRow = {
  id: string;
  campana_id: string;
  empleado_id: string;
  respuestas: Record<string, string | string[]> | null;
  respondido_at: string | null;
  puntuacion: number | null;
  nota_sobre: number | null;
  aprobado: boolean | null;
  reunion_fecha: string | null;
  reunion_estado: EstadoReunion;
  reunion_notas: string | null;
  empleado: { id: string; nombre: string; apellidos: string | null; puesto: string | null } | null;
};

type PuntoRow = {
  id: string;
  envio_id: string;
  texto: string;
  estado_seguimiento: EstadoPunto;
  orden: number;
  created_at: string;
  cerrado_at: string | null;
};

export async function getCampanaDetalle(
  campanaId: string,
): Promise<CampanaDetalle | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;

  const { data: campana } = await supabase
    .from("cuestionario_campanas")
    .select("id, empresa_id, plantilla_id, periodo, periodo_inicio, periodo_fin, estado, created_at, plantilla:cuestionario_plantillas!inner(nombre)")
    .eq("id", campanaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!campana) return null;
  const cRow = campana as unknown as CampanaRow;

  const { data: enviosRaw } = await supabase
    .from("cuestionario_envios")
    .select(
      "id, campana_id, empleado_id, respuestas, respondido_at, puntuacion, nota_sobre, aprobado, reunion_fecha, reunion_estado, reunion_notas, empleado:empleados!inner(id, nombre, apellidos, puesto)",
    )
    .eq("campana_id", campanaId)
    .order("created_at", { ascending: true });

  const envios = (enviosRaw ?? []) as unknown as EnvioRow[];

  const envioIds = envios.map((e) => e.id);
  const puntosPorEnvio = new Map<string, { id: string; texto: string; estado: EstadoPunto }[]>();
  if (envioIds.length > 0) {
    const { data: puntosRaw } = await supabase
      .from("cuestionario_puntos")
      .select("id, envio_id, texto, estado_seguimiento, orden, created_at, cerrado_at")
      .in("envio_id", envioIds)
      .order("orden", { ascending: true });
    for (const p of (puntosRaw ?? []) as unknown as PuntoRow[]) {
      const cur = puntosPorEnvio.get(p.envio_id) ?? [];
      cur.push({ id: p.id, texto: p.texto, estado: p.estado_seguimiento });
      puntosPorEnvio.set(p.envio_id, cur);
    }
  }

  const envioFilas: EnvioFila[] = envios.map((e) => {
    const empleadoNombre = e.empleado
      ? `${e.empleado.nombre}${e.empleado.apellidos ? " " + e.empleado.apellidos : ""}`.trim()
      : "(empleado desconocido)";
    return {
      id: e.id,
      campanaId: e.campana_id,
      empleadoId: e.empleado_id,
      empleadoNombre,
      empleadoPuesto: e.empleado?.puesto ?? null,
      respondido: !!e.respondido_at,
      respondidoAt: e.respondido_at,
      reunionEstado: e.reunion_estado,
      reunionFecha: e.reunion_fecha,
      reunionNotas: e.reunion_notas,
      puntos: puntosPorEnvio.get(e.id) ?? [],
    };
  });

  const totalEnvios = envioFilas.length;
  const respondidos = envioFilas.filter((e) => e.respondido).length;
  const reunionesHechas = envioFilas.filter((e) => e.reunionEstado === "realizada").length;

  return {
    campana: {
      id: cRow.id,
      empresaId: cRow.empresa_id,
      plantillaId: cRow.plantilla_id,
      plantillaNombre: cRow.plantilla?.nombre ?? "(sin plantilla)",
      periodo: cRow.periodo,
      periodoInicio: cRow.periodo_inicio,
      periodoFin: cRow.periodo_fin,
      estado: cRow.estado as CampanaResumen["estado"],
      createdAt: cRow.created_at,
      totalEnvios,
      envioRespondidos: respondidos,
      envioReunionesHechas: reunionesHechas,
    },
    envios: envioFilas,
  };
}

export async function getEnvioCompleto(envioId: string): Promise<EnvioCompleto | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;

  const { data: envioRaw } = await supabase
    .from("cuestionario_envios")
    .select(
      "id, campana_id, empleado_id, respuestas, respondido_at, puntuacion, nota_sobre, aprobado, reunion_fecha, reunion_estado, reunion_notas, empleado:empleados!inner(id, nombre, apellidos, puesto)",
    )
    .eq("id", envioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!envioRaw) return null;
  const e = envioRaw as unknown as EnvioRow;

  const { data: puntosRaw } = await supabase
    .from("cuestionario_puntos")
    .select("id, envio_id, texto, estado_seguimiento, orden, created_at, cerrado_at")
    .eq("envio_id", envioId)
    .order("orden", { ascending: true });

  const puntos = ((puntosRaw ?? []) as unknown as PuntoRow[]).map((p) => ({
    id: p.id,
    texto: p.texto,
    estado: p.estado_seguimiento,
  }));

  const empleadoNombre = e.empleado
    ? `${e.empleado.nombre}${e.empleado.apellidos ? " " + e.empleado.apellidos : ""}`.trim()
    : "(empleado desconocido)";

  return {
    id: e.id,
    campanaId: e.campana_id,
    empleadoId: e.empleado_id,
    empleadoNombre,
    empleadoPuesto: e.empleado?.puesto ?? null,
    respondido: !!e.respondido_at,
    respondidoAt: e.respondido_at,
    reunionEstado: e.reunion_estado,
    reunionFecha: e.reunion_fecha,
    reunionNotas: e.reunion_notas,
    respuestas: e.respuestas,
    puntuacion: e.puntuacion,
    notaSobre: e.nota_sobre,
    aprobado: e.aprobado,
    puntos,
  };
}

// ─── REUNIÓN ─────────────────────────────────────────────────

const updateReunionSchema = z.object({
  envioId: z.string().uuid(),
  fecha: z.string().nullable().optional(),
  estado: z.enum(["pendiente", "realizada", "cancelada", "no_aplica"]).optional(),
  notas: z.string().max(5000).nullable().optional(),
});

export async function updateReunion(
  input: z.infer<typeof updateReunionSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateReunionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const patch: Record<string, unknown> = { reunion_at: new Date().toISOString() };
  if (parsed.data.fecha !== undefined) patch.reunion_fecha = parsed.data.fecha;
  if (parsed.data.estado !== undefined) patch.reunion_estado = parsed.data.estado;
  if (parsed.data.notas !== undefined) patch.reunion_notas = parsed.data.notas;

  const { error, data } = await supabase
    .from("cuestionario_envios")
    .update(patch)
    .eq("id", parsed.data.envioId)
    .eq("empresa_id", empresaId)
    .select("campana_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data?.campana_id) revalidatePath(`/calidad/cuestionarios/${data.campana_id}`);
  return { ok: true };
}

// ─── PUNTOS ──────────────────────────────────────────────────

const crearPuntoSchema = z.object({
  envioId: z.string().uuid(),
  texto: z.string().trim().min(1, "Texto obligatorio").max(500),
});

export async function crearPunto(
  input: z.infer<typeof crearPuntoSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = crearPuntoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  const { supabase, user, empresaId } = await ctx();
  if (!user || !empresaId) return { ok: false, error: "Sin sesión" };

  // Resolver max(orden) actual para el envío
  const { data: maxOrden } = await supabase
    .from("cuestionario_puntos")
    .select("orden")
    .eq("envio_id", parsed.data.envioId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("cuestionario_puntos")
    .insert({
      envio_id: parsed.data.envioId,
      empresa_id: empresaId,
      texto: parsed.data.texto,
      orden: ((maxOrden?.orden ?? -1) as number) + 1,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "Error" };

  // Revalidar la página de detalle: buscar campana_id del envío
  const { data: envio } = await supabase
    .from("cuestionario_envios")
    .select("campana_id")
    .eq("id", parsed.data.envioId)
    .maybeSingle();
  if (envio?.campana_id) revalidatePath(`/calidad/cuestionarios/${envio.campana_id}`);

  return { ok: true, id: data.id };
}

const updatePuntoSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["pendiente", "en_curso", "cerrado"]).optional(),
  texto: z.string().trim().min(1).max(500).optional(),
});

export async function updatePunto(
  input: z.infer<typeof updatePuntoSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updatePuntoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const patch: Record<string, unknown> = {};
  if (parsed.data.estado !== undefined) {
    patch.estado_seguimiento = parsed.data.estado;
    patch.cerrado_at = parsed.data.estado === "cerrado" ? new Date().toISOString() : null;
  }
  if (parsed.data.texto !== undefined) patch.texto = parsed.data.texto;

  const { error, data } = await supabase
    .from("cuestionario_puntos")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("empresa_id", empresaId)
    .select("envio_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  if (data?.envio_id) {
    const { data: envio } = await supabase
      .from("cuestionario_envios")
      .select("campana_id")
      .eq("id", data.envio_id)
      .maybeSingle();
    if (envio?.campana_id) revalidatePath(`/calidad/cuestionarios/${envio.campana_id}`);
  }
  return { ok: true };
}

export async function deletePunto(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error, data } = await supabase
    .from("cuestionario_puntos")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .select("envio_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data?.envio_id) {
    const { data: envio } = await supabase
      .from("cuestionario_envios")
      .select("campana_id")
      .eq("id", data.envio_id)
      .maybeSingle();
    if (envio?.campana_id) revalidatePath(`/calidad/cuestionarios/${envio.campana_id}`);
  }
  return { ok: true };
}

// ─── TIMELINE DE PUNTOS ──────────────────────────────────────

export async function listPuntosTimeline(
  campanaId?: string,
): Promise<PuntoTimeline[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  let query = supabase
    .from("cuestionario_puntos")
    .select(
      "id, envio_id, texto, estado_seguimiento, created_at, cerrado_at, envio:cuestionario_envios!inner(campana_id, empleado_id, empleado:empleados!inner(nombre, apellidos), campana:cuestionario_campanas!inner(periodo))",
    )
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (campanaId) {
    query = query.eq("envio.campana_id", campanaId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[cuestionarios] listPuntosTimeline:", error.message);
    return [];
  }

  type Row = {
    id: string;
    envio_id: string;
    texto: string;
    estado_seguimiento: EstadoPunto;
    created_at: string;
    cerrado_at: string | null;
    envio: {
      campana_id: string;
      empleado_id: string;
      empleado: { nombre: string; apellidos: string | null };
      campana: { periodo: string };
    } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const empleado = r.envio?.empleado;
    const empleadoNombre = empleado
      ? `${empleado.nombre}${empleado.apellidos ? " " + empleado.apellidos : ""}`.trim()
      : "(empleado desconocido)";
    return {
      id: r.id,
      envioId: r.envio_id,
      empleadoId: r.envio?.empleado_id ?? "",
      empleadoNombre,
      texto: r.texto,
      estado: r.estado_seguimiento,
      createdAt: r.created_at,
      cerradoAt: r.cerrado_at,
      campanaId: r.envio?.campana_id ?? "",
      campanaPeriodo: r.envio?.campana?.periodo ?? "",
    };
  });
}
