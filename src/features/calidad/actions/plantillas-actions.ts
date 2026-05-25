"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { revalidatePath } from "next/cache";
import type {
  AuditoriaPlantilla,
  AuditoriaVersion,
  AuditoriaSeccion,
  AuditoriaPregunta,
  AuditoriaTipoPregunta,
} from "@/features/calidad/types/auditorias";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export interface PlantillaResumen extends AuditoriaPlantilla {
  version_vigente: number | null;
  estado_vigente: "borrador" | "publicada" | null;
  vigente_id: string | null;
  num_secciones: number;
  num_preguntas: number;
}

export async function listPlantillas(): Promise<PlantillaResumen[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data: plantillas, error } = await supabase
    .from("auditoria_plantillas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("numero_secuencial", { ascending: true });
  if (error || !plantillas) {
    console.error("[auditorias] listPlantillas:", error?.message);
    return [];
  }

  const ids = plantillas.map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: versiones } = await supabase
    .from("auditoria_plantilla_versiones")
    .select("*")
    .in("plantilla_id", ids);

  const versionIds = (versiones ?? []).map((v) => v.id);
  const { data: secciones } = versionIds.length
    ? await supabase.from("auditoria_secciones").select("id, version_id").in("version_id", versionIds)
    : { data: [] as Array<{ id: string; version_id: string }> };
  const seccionIds = (secciones ?? []).map((s) => s.id);
  const { data: preguntas } = seccionIds.length
    ? await supabase.from("auditoria_preguntas").select("seccion_id").in("seccion_id", seccionIds)
    : { data: [] as Array<{ seccion_id: string }> };

  const seccionesPorVersion = new Map<string, string[]>();
  for (const s of secciones ?? []) {
    const arr = seccionesPorVersion.get(s.version_id) ?? [];
    arr.push(s.id);
    seccionesPorVersion.set(s.version_id, arr);
  }
  const preguntasPorSeccion = new Map<string, number>();
  for (const p of preguntas ?? []) {
    preguntasPorSeccion.set(p.seccion_id, (preguntasPorSeccion.get(p.seccion_id) ?? 0) + 1);
  }

  return plantillas.map((p): PlantillaResumen => {
    const propias = (versiones ?? []).filter((v) => v.plantilla_id === p.id);
    const vigente = propias.find((v) => v.vigente);
    const elegida = vigente ?? propias.sort((a, b) => b.version - a.version)[0];
    const seccionesIds = elegida ? (seccionesPorVersion.get(elegida.id) ?? []) : [];
    const numSecciones = seccionesIds.length;
    const numPreguntas = seccionesIds.reduce((acc, sid) => acc + (preguntasPorSeccion.get(sid) ?? 0), 0);
    return {
      ...p,
      version_vigente: elegida?.version ?? null,
      estado_vigente: (elegida?.estado as "borrador" | "publicada" | undefined) ?? null,
      vigente_id: elegida?.id ?? null,
      num_secciones: numSecciones,
      num_preguntas: numPreguntas,
    };
  });
}

export interface PlantillaConVersion {
  plantilla: AuditoriaPlantilla;
  versiones: AuditoriaVersion[];
  versionActual: AuditoriaVersion;
  secciones: Array<AuditoriaSeccion & { preguntas: AuditoriaPregunta[] }>;
}

export async function getPlantillaConVersion(plantillaId: string, versionId?: string): Promise<PlantillaConVersion | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;

  const { data: plantilla } = await supabase
    .from("auditoria_plantillas")
    .select("*")
    .eq("id", plantillaId)
    .eq("empresa_id", empresaId)
    .single();
  if (!plantilla) return null;

  const { data: versiones } = await supabase
    .from("auditoria_plantilla_versiones")
    .select("*")
    .eq("plantilla_id", plantillaId)
    .order("version", { ascending: false });
  if (!versiones || versiones.length === 0) return null;

  const versionActual = versionId
    ? versiones.find((v) => v.id === versionId)
    : versiones.find((v) => v.vigente) ?? versiones.find((v) => v.estado === "borrador") ?? versiones[0];
  if (!versionActual) return null;

  const { data: secciones } = await supabase
    .from("auditoria_secciones")
    .select("*")
    .eq("version_id", versionActual.id)
    .order("orden", { ascending: true });
  const seccionIds = (secciones ?? []).map((s) => s.id);
  const { data: preguntas } = seccionIds.length
    ? await supabase
        .from("auditoria_preguntas")
        .select("*")
        .in("seccion_id", seccionIds)
        .order("orden", { ascending: true })
    : { data: [] as AuditoriaPregunta[] };

  const seccionesConPreguntas = (secciones ?? []).map((s) => ({
    ...s,
    preguntas: (preguntas ?? []).filter((p) => p.seccion_id === s.id),
  }));

  return {
    plantilla,
    versiones,
    versionActual,
    secciones: seccionesConPreguntas,
  };
}

export async function crearPlantilla(input: { nombre: string; descripcion?: string | null }): Promise<{ ok: true; plantillaId: string } | { ok: false; error: string }> {
  const { supabase, user, empresaId } = await ctx();
  if (!user || !empresaId) return { ok: false, error: "Sin sesión" };

  const { data: plantilla, error } = await supabase
    .from("auditoria_plantillas")
    .insert({ empresa_id: empresaId, nombre: input.nombre.trim() || "Nueva plantilla", descripcion: input.descripcion ?? null, created_by: user.id })
    .select("id")
    .single();
  if (error || !plantilla) return { ok: false, error: error?.message ?? "Error al crear plantilla" };

  const { error: errV } = await supabase
    .from("auditoria_plantilla_versiones")
    .insert({ plantilla_id: plantilla.id, version: 1, estado: "borrador", vigente: false });
  if (errV) return { ok: false, error: errV.message };

  revalidatePath("/calidad/auditorias");
  return { ok: true, plantillaId: plantilla.id };
}

export async function actualizarPlantilla(plantillaId: string, input: { nombre?: string; descripcion?: string | null }): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const patch: Record<string, unknown> = {};
  if (input.nombre !== undefined) patch.nombre = input.nombre;
  if (input.descripcion !== undefined) patch.descripcion = input.descripcion;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("auditoria_plantillas")
    .update(patch)
    .eq("id", plantillaId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/auditorias");
  return { ok: true };
}

export async function archivarPlantilla(plantillaId: string, archivada: boolean): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("auditoria_plantillas")
    .update({ archivada })
    .eq("id", plantillaId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/auditorias");
  return { ok: true };
}

export async function publicarVersion(versionId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("auditoria_plantilla_versiones")
    .update({ estado: "publicada", vigente: true, publicada_at: new Date().toISOString(), publicada_por: user.id })
    .eq("id", versionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/auditorias");
  return { ok: true };
}

export async function clonarPlantilla(plantillaId: string): Promise<{ ok: true; plantillaId: string } | { ok: false; error: string }> {
  const { supabase, user, empresaId } = await ctx();
  if (!user || !empresaId) return { ok: false, error: "Sin sesión" };

  const original = await getPlantillaConVersion(plantillaId);
  if (!original) return { ok: false, error: "Plantilla no encontrada" };

  const { data: nueva, error: errN } = await supabase
    .from("auditoria_plantillas")
    .insert({
      empresa_id: empresaId,
      nombre: `${original.plantilla.nombre} (copia)`,
      descripcion: original.plantilla.descripcion,
      clonada_de_plantilla_id: original.plantilla.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (errN || !nueva) return { ok: false, error: errN?.message ?? "Error al clonar" };

  const { data: nuevaVersion, error: errV } = await supabase
    .from("auditoria_plantilla_versiones")
    .insert({ plantilla_id: nueva.id, version: 1, estado: "borrador", vigente: false })
    .select("id")
    .single();
  if (errV || !nuevaVersion) return { ok: false, error: errV?.message ?? "Error al crear versión" };

  await clonarSeccionesYPreguntas(supabase, original.secciones, nuevaVersion.id);
  revalidatePath("/calidad/auditorias");
  return { ok: true, plantillaId: nueva.id };
}

export async function crearBorradorNuevaVersion(versionVigenteId: string): Promise<{ ok: true; versionId: string } | { ok: false; error: string }> {
  const { supabase, user } = await ctx();
  if (!user) return { ok: false, error: "Sin sesión" };

  const { data: vigente } = await supabase
    .from("auditoria_plantilla_versiones")
    .select("*")
    .eq("id", versionVigenteId)
    .single();
  if (!vigente) return { ok: false, error: "Versión no encontrada" };

  const original = await getPlantillaConVersion(vigente.plantilla_id, vigente.id);
  if (!original) return { ok: false, error: "No se pudo cargar la versión" };

  const { data: nueva, error: errV } = await supabase
    .from("auditoria_plantilla_versiones")
    .insert({ plantilla_id: vigente.plantilla_id, version: vigente.version + 1, estado: "borrador", vigente: false })
    .select("id")
    .single();
  if (errV || !nueva) return { ok: false, error: errV?.message ?? "Error al crear borrador" };

  await clonarSeccionesYPreguntas(supabase, original.secciones, nueva.id);
  revalidatePath("/calidad/auditorias");
  return { ok: true, versionId: nueva.id };
}

async function clonarSeccionesYPreguntas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  secciones: Array<AuditoriaSeccion & { preguntas: AuditoriaPregunta[] }>,
  destinoVersionId: string,
) {
  for (const s of secciones) {
    const { data: nuevaSeccion } = await supabase
      .from("auditoria_secciones")
      .insert({ version_id: destinoVersionId, orden: s.orden, titulo: s.titulo, descripcion: s.descripcion })
      .select("id")
      .single();
    if (!nuevaSeccion || s.preguntas.length === 0) continue;
    const filas = s.preguntas.map((p) => ({
      seccion_id: nuevaSeccion.id,
      orden: p.orden,
      numero_global: p.numero_global,
      tipo: p.tipo,
      texto: p.texto,
      obligatoria: p.obligatoria,
      peso: p.peso,
      escala_min: p.escala_min,
      escala_max: p.escala_max,
      etiqueta_min: p.etiqueta_min,
      etiqueta_max: p.etiqueta_max,
      opciones: p.opciones,
    }));
    await supabase.from("auditoria_preguntas").insert(filas);
  }
}

export async function crearSeccion(versionId: string): Promise<{ ok: true; seccionId: string } | { ok: false; error: string }> {
  const { supabase } = await ctx();
  const { data: existentes } = await supabase
    .from("auditoria_secciones")
    .select("orden")
    .eq("version_id", versionId)
    .order("orden", { ascending: false })
    .limit(1);
  const siguienteOrden = (existentes?.[0]?.orden ?? 0) + 1;

  const { data, error } = await supabase
    .from("auditoria_secciones")
    .insert({ version_id: versionId, orden: siguienteOrden, titulo: `Sección ${siguienteOrden}` })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Error al crear sección" };
  return { ok: true, seccionId: data.id };
}

export async function actualizarSeccion(seccionId: string, input: { titulo?: string; descripcion?: string | null }): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await ctx();
  const patch: Record<string, unknown> = {};
  if (input.titulo !== undefined) patch.titulo = input.titulo;
  if (input.descripcion !== undefined) patch.descripcion = input.descripcion;
  if (!Object.keys(patch).length) return { ok: true };
  const { error } = await supabase.from("auditoria_secciones").update(patch).eq("id", seccionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function eliminarSeccion(seccionId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("auditoria_secciones").delete().eq("id", seccionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function crearPregunta(seccionId: string, tipo: AuditoriaTipoPregunta): Promise<{ ok: true; preguntaId: string } | { ok: false; error: string }> {
  const { supabase } = await ctx();
  const { data: existentes } = await supabase
    .from("auditoria_preguntas")
    .select("orden, numero_global, seccion_id")
    .order("numero_global", { ascending: false })
    .limit(1);
  const siguienteNumeroGlobal = (existentes?.[0]?.numero_global ?? 0) + 1;

  const { data: mias } = await supabase
    .from("auditoria_preguntas")
    .select("orden")
    .eq("seccion_id", seccionId)
    .order("orden", { ascending: false })
    .limit(1);
  const siguienteOrden = (mias?.[0]?.orden ?? 0) + 1;

  const defaults = tipo === "observaciones"
    ? { peso: 0, texto: "Observaciones" }
    : tipo === "texto_largo"
    ? { peso: 0, texto: "Nueva pregunta de texto" }
    : { peso: 1, texto: "Nueva pregunta" };

  const { data, error } = await supabase
    .from("auditoria_preguntas")
    .insert({
      seccion_id: seccionId,
      orden: siguienteOrden,
      numero_global: siguienteNumeroGlobal,
      tipo,
      texto: defaults.texto,
      peso: defaults.peso,
      obligatoria: false,
      escala_min: 0,
      escala_max: 5,
      etiqueta_min: "Muy mal",
      etiqueta_max: "Muy bien",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Error al crear pregunta" };
  return { ok: true, preguntaId: data.id };
}

export async function actualizarPregunta(preguntaId: string, input: Partial<Pick<AuditoriaPregunta, "texto" | "obligatoria" | "peso" | "escala_min" | "escala_max" | "etiqueta_min" | "etiqueta_max" | "opciones" | "tipo">>): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("auditoria_preguntas").update(input).eq("id", preguntaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function eliminarPregunta(preguntaId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await ctx();
  const { error } = await supabase.from("auditoria_preguntas").delete().eq("id", preguntaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reordenarSecciones(versionId: string, idsOrdenadas: string[]): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await ctx();
  for (let i = 0; i < idsOrdenadas.length; i++) {
    await supabase.from("auditoria_secciones").update({ orden: i + 1 }).eq("id", idsOrdenadas[i]).eq("version_id", versionId);
  }
  return { ok: true };
}

export async function reordenarPreguntas(seccionId: string, idsOrdenadas: string[]): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await ctx();
  for (let i = 0; i < idsOrdenadas.length; i++) {
    await supabase.from("auditoria_preguntas").update({ orden: i + 1 }).eq("id", idsOrdenadas[i]).eq("seccion_id", seccionId);
  }
  return { ok: true };
}
