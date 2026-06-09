"use server";

// Colores por departamento (configurable por empresa). El color es la fuente
// única del tinte de los turnos en el cuadrante de horarios: todos los turnos y
// empleados de un mismo departamento comparten color. Se edita en
// Ajustes → RRHH → Horarios → Colores de departamento.

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import { COLOR_DEPARTAMENTO_FALLBACK } from "@/features/rrhh/data/horarios";

type Result<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

export interface DepartamentoColor {
  id: string;
  nombre: string;
  area: "OPERATIVA" | "ADMINISTRATIVA";
  color: string;
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

/** Departamentos activos de la empresa con su color (hex). */
export async function listDepartamentoColores(
  empresaIdOrSlug: string,
): Promise<Result<DepartamentoColor[]>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("departamentos")
      .select("id, nombre, area, color, estado")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;

    const out: DepartamentoColor[] = (data ?? [])
      .filter((d) => (d.estado as string | null) !== "Inactivo")
      .map((d) => ({
        id: d.id as string,
        nombre: (d.nombre as string) ?? "",
        area: ((d.area as string) ?? "ADMINISTRATIVA") as
          | "OPERATIVA"
          | "ADMINISTRATIVA",
        color: (d.color as string | null) || COLOR_DEPARTAMENTO_FALLBACK,
      }));
    return { ok: true, data: out };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[depto-colores] listDepartamentoColores:", msg);
    return { ok: false, data: [], error: msg };
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Actualiza el color de un departamento (solo de la empresa activa). */
export async function updateDepartamentoColor(
  departamentoId: string,
  color: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const hex = (color ?? "").trim().toLowerCase();
    if (!HEX_RE.test(hex)) {
      return { ok: false, error: "Color no válido. Usa un hex como #10b981." };
    }
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("departamentos")
      .update({ color: hex, updated_at: new Date().toISOString() })
      .eq("id", departamentoId);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[depto-colores] updateDepartamentoColor:", msg);
    return { ok: false, error: msg };
  }
}
