"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { friendlyError } from "@/shared/lib/friendly-errors";
import type { ClaseEscuela, TipoClase } from "../types";

/**
 * CRUD de las CLASES de la escuela (el calendario del portal del alumno).
 *
 * Solo lo toca el back-office (PRODUCTO → ESCUELA) con el usuario autenticado:
 * la RLS por empresa hace el resto. El alumno las lee por otro camino
 * (`services/portal-alumno.ts`), y siempre en modo lectura.
 */

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;
  return { supabase, userId: user?.id ?? null, empresaId };
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
  publicado: boolean;
};

/** `11:00:00` de Postgres → `11:00`, que es lo que se enseña y se edita. */
function hhmm(hora: string | null | undefined): string {
  return (hora ?? "").slice(0, 5);
}

function toClase(r: ClaseRow): ClaseEscuela {
  return {
    id: r.id,
    titulo: r.titulo ?? "",
    descripcion: r.descripcion ?? "",
    tipo: (r.tipo as TipoClase) ?? "CLASE",
    fecha: r.fecha,
    horaInicio: hhmm(r.hora_inicio),
    horaFin: r.hora_fin ? hhmm(r.hora_fin) : undefined,
    enlace: r.enlace ?? undefined,
    grabacionUrl: r.grabacion_url ?? undefined,
    cover: r.cover ?? undefined,
    cursoId: r.curso_id ?? undefined,
    publicado: r.publicado ?? true,
  };
}

const esquemaClase = z.object({
  titulo: z.string().trim().min(1, "La clase necesita un título").max(200),
  descripcion: z.string().trim().max(4000).default(""),
  tipo: z.enum(["CLASE", "DIRECTO", "TALLER", "TUTORIA", "OTRO"]).default("CLASE"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida"),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  enlace: z.string().trim().url("El enlace no es válido").optional().or(z.literal("")),
  grabacionUrl: z.string().trim().url("El enlace de la grabación no es válido").optional().or(z.literal("")),
  cover: z.string().trim().optional().or(z.literal("")),
  cursoId: z.string().uuid().optional().or(z.literal("")),
  publicado: z.boolean().default(true),
});

export type EntradaClase = z.input<typeof esquemaClase>;

export async function listClases(): Promise<{ ok: boolean; data: ClaseEscuela[]; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("escuela_clases")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true });
    if (error) throw error;
    return { ok: true, data: ((data ?? []) as ClaseRow[]).map(toClase) };
  } catch (e) {
    console.error("[escuela] listClases:", e);
    return { ok: false, data: [], error: friendlyError(e, "listClases") };
  }
}

function aFila(v: z.output<typeof esquemaClase>) {
  return {
    titulo: v.titulo,
    descripcion: v.descripcion ?? "",
    tipo: v.tipo,
    fecha: v.fecha,
    hora_inicio: v.horaInicio,
    hora_fin: v.horaFin ? v.horaFin : null,
    enlace: v.enlace ? v.enlace : null,
    grabacion_url: v.grabacionUrl ? v.grabacionUrl : null,
    cover: v.cover ? v.cover : null,
    curso_id: v.cursoId ? v.cursoId : null,
    publicado: v.publicado,
  };
}

export async function crearClase(
  entrada: EntradaClase,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const parsed = esquemaClase.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  try {
    const { supabase, empresaId, userId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("escuela_clases")
      .insert({ ...aFila(parsed.data), empresa_id: empresaId, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data?.id as string };
  } catch (e) {
    console.error("[escuela] crearClase:", e);
    return { ok: false, error: friendlyError(e, "crearClase") };
  }
}

export async function actualizarClase(
  id: string,
  entrada: EntradaClase,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = esquemaClase.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("escuela_clases")
      .update(aFila(parsed.data))
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[escuela] actualizarClase:", e);
    return { ok: false, error: friendlyError(e, "actualizarClase") };
  }
}

export async function borrarClase(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("escuela_clases")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[escuela] borrarClase:", e);
    return { ok: false, error: friendlyError(e, "borrarClase") };
  }
}
