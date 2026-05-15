"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import type { Descanso, DiaSemana } from "@/features/rrhh/data/horarios";

type Result<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

function rowToDescanso(r: Record<string, unknown>): Descanso {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    icono: r.icono as string,
    color: r.color as string,
    remunerado: !!r.remunerado,
    cuandoFichar: (r.cuando_fichar as "cualquier" | "intervalo") ?? "intervalo",
    intervaloInicio: (r.intervalo_inicio as string) ?? "12:00",
    intervaloFin: (r.intervalo_fin as string) ?? "16:00",
    duracionTipo:
      (r.duracion_tipo as "sin_limite" | "duracion") ?? "sin_limite",
    duracionMinutos: (r.duracion_minutos as number | null) ?? undefined,
    dias: (r.dias as DiaSemana[]) ?? [],
    turnos: (r.turnos as string[]) ?? [],
    activo: !!r.activo,
  };
}

async function resolveEmpresaUuid(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  idOrSlug: string,
): Promise<string | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug)) return idOrSlug;
  const { data } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", idOrSlug)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function listDescansos(
  empresaIdOrSlug: string,
): Promise<Result<Descanso[]>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("rrhh_descansos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToDescanso) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[descansos] listDescansos:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export type DescansoInput = {
  nombre: string;
  icono: string;
  color: string;
  remunerado: boolean;
  cuandoFichar: "cualquier" | "intervalo";
  intervaloInicio: string;
  intervaloFin: string;
  duracionTipo: "sin_limite" | "duracion";
  duracionMinutos?: number;
  dias: DiaSemana[];
  turnos: string[];
  activo?: boolean;
};

function makeDescansoId(empresaId: string) {
  return `d-${empresaId.slice(0, 4)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

// Crea el descanso en una o varias empresas. Cada copia es independiente
// (no se enlaza con un grupo_id). Devuelve los IDs creados por empresa.
export async function createDescanso(
  empresasIdOrSlug: string[],
  input: DescansoInput,
) {
  try {
    const { supabase } = await getAppContext();
    if (empresasIdOrSlug.length === 0)
      return { ok: false, error: "Selecciona al menos una empresa" };

    const createdIds: { empresaId: string; id: string }[] = [];
    for (const idOrSlug of empresasIdOrSlug) {
      const empresaId = await resolveEmpresaUuid(supabase, idOrSlug);
      if (!empresaId) continue;
      const id = makeDescansoId(empresaId);
      const { error } = await supabase.from("rrhh_descansos").insert({
        id,
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        icono: input.icono,
        color: input.color,
        remunerado: input.remunerado,
        cuando_fichar: input.cuandoFichar,
        intervalo_inicio: input.intervaloInicio,
        intervalo_fin: input.intervaloFin,
        duracion_tipo: input.duracionTipo,
        duracion_minutos: input.duracionMinutos ?? null,
        dias: input.dias,
        turnos: input.turnos,
        activo: input.activo ?? true,
      });
      if (error) throw error;
      createdIds.push({ empresaId, id });
    }
    revalidatePath("/rrhh/horarios");
    return { ok: true, ids: createdIds };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[descansos] createDescanso:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateDescanso(
  id: string,
  patch: Partial<DescansoInput>,
) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.nombre !== undefined) payload.nombre = patch.nombre.trim();
    if (patch.icono !== undefined) payload.icono = patch.icono;
    if (patch.color !== undefined) payload.color = patch.color;
    if (patch.remunerado !== undefined) payload.remunerado = patch.remunerado;
    if (patch.cuandoFichar !== undefined)
      payload.cuando_fichar = patch.cuandoFichar;
    if (patch.intervaloInicio !== undefined)
      payload.intervalo_inicio = patch.intervaloInicio;
    if (patch.intervaloFin !== undefined)
      payload.intervalo_fin = patch.intervaloFin;
    if (patch.duracionTipo !== undefined)
      payload.duracion_tipo = patch.duracionTipo;
    if (patch.duracionMinutos !== undefined)
      payload.duracion_minutos = patch.duracionMinutos ?? null;
    if (patch.dias !== undefined) payload.dias = patch.dias;
    if (patch.turnos !== undefined) payload.turnos = patch.turnos;
    if (patch.activo !== undefined) payload.activo = patch.activo;

    const { error } = await supabase
      .from("rrhh_descansos")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[descansos] updateDescanso:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteDescanso(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("rrhh_descansos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[descansos] deleteDescanso:", msg);
    return { ok: false, error: msg };
  }
}
