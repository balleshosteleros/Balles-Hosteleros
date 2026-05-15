"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import type {
  Turno,
  TurnoTramo,
  TurnoTono,
  Cuadrante,
} from "@/features/rrhh/data/horarios";

type Result<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

function rowToTurno(r: Record<string, unknown>): Turno {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    codigo: r.codigo as string,
    tramos: (r.tramos as TurnoTramo[]) ?? [],
    color: (r.color as TurnoTono) ?? "stone",
    esGuardia: !!r.es_guardia,
    cuadranteId: (r.cuadrante_id as string | null) ?? undefined,
    activo: !!r.activo,
    centro: (r.centro as string | null) ?? undefined,
    departamento: (r.departamento as string | null) ?? undefined,
  };
}

function rowToCuadrante(r: Record<string, unknown>): Cuadrante {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    empresaId: r.empresa_id as string,
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

export async function listTurnos(empresaIdOrSlug: string): Promise<Result<Turno[]>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("rrhh_turnos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToTurno) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] listTurnos:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function listCuadrantes(
  empresaIdOrSlug: string,
): Promise<Result<Cuadrante[]>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("rrhh_cuadrantes")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToCuadrante) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] listCuadrantes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export type TurnoInput = {
  nombre: string;
  codigo: string;
  tramos: TurnoTramo[];
  color: TurnoTono;
  esGuardia: boolean;
  cuadranteId?: string;
  activo?: boolean;
};

function makeTurnoId(empresaId: string) {
  return `t-${empresaId.slice(0, 4)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export async function createTurno(
  empresaIdOrSlug: string,
  input: TurnoInput,
) {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };

    const id = makeTurnoId(empresaId);
    const { error } = await supabase.from("rrhh_turnos").insert({
      id,
      empresa_id: empresaId,
      nombre: input.nombre.trim(),
      codigo: input.codigo.trim().toUpperCase(),
      tramos: input.tramos,
      color: input.color,
      es_guardia: input.esGuardia,
      cuadrante_id: input.cuadranteId ?? null,
      activo: input.activo ?? true,
    });
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] createTurno:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateTurno(id: string, patch: Partial<TurnoInput>) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.nombre !== undefined) payload.nombre = patch.nombre.trim();
    if (patch.codigo !== undefined) payload.codigo = patch.codigo.trim().toUpperCase();
    if (patch.tramos !== undefined) payload.tramos = patch.tramos;
    if (patch.color !== undefined) payload.color = patch.color;
    if (patch.esGuardia !== undefined) payload.es_guardia = patch.esGuardia;
    if (patch.cuadranteId !== undefined)
      payload.cuadrante_id = patch.cuadranteId ?? null;
    if (patch.activo !== undefined) payload.activo = patch.activo;

    const { error } = await supabase.from("rrhh_turnos").update(payload).eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] updateTurno:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteTurno(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("rrhh_turnos").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] deleteTurno:", msg);
    return { ok: false, error: msg };
  }
}
