"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";

export type EstadoEmpleado = "Activo" | "Baja temporal" | "Baja definitiva";

const ESTADOS_BAJA: EstadoEmpleado[] = ["Baja temporal", "Baja definitiva"];

const FALLBACK_DEPARTAMENTOS = [
  "DIRECCIÓN", "SALA", "COCINA", "GERENCIA", "CAMAREROS",
  "CACHIMBEROS", "ARTISTAS", "MANTENIMIENTO", "RRPP", "ADMINISTRATIVO",
].map(nombre => ({ id: `mock-dep-${nombre.toLowerCase().replace(/\s+/g, "-")}`, nombre }));

export async function listEmpleados() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };

    const { data, error } = await supabase
      .from("empleados")
      .select(`*, departamentos(nombre)`)
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listEmpleados:", err);
    return { ok: false, data: [] };
  }
}

export async function createEmpleado(input: {
  nombre: string;
  apellidos?: string;
  departamentoId?: string;
  puesto?: string;
  emailEmpresa?: string;
  emailPersonal?: string;
  telefono?: string;
}) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const isRealId = (id?: string) => id && !id.startsWith("mock-");
    const { error } = await supabase.from("empleados").insert({
      empresa_id: empresaId,
      nombre: input.nombre,
      apellidos: input.apellidos ?? null,
      departamento_id: isRealId(input.departamentoId) ? input.departamentoId : null,
      puesto: input.puesto ?? null,
      email_empresa: input.emailEmpresa ?? null,
      email_personal: input.emailPersonal ?? null,
      telefono: input.telefono ?? null,
      // Por construcción: alta = Activo. La baja es un cambio posterior con
      // fecha_baja obligatoria (lo bloquea el constraint empleados_estado_check).
      estado: "Activo",
    });

    if (error) throw error;
    revalidatePath("/rrhh/empleados");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

type UpdateEmpleadoInput = {
  nombre?: string;
  apellidos?: string;
  departamentoId?: string | null;
  puesto?: string | null;
  emailEmpresa?: string | null;
  emailPersonal?: string | null;
  telefono?: string | null;
  notas?: string | null;
};

export async function updateEmpleado(id: string, updates: UpdateEmpleadoInput) {
  try {
    const { supabase } = await getAppContext();
    const patch: Record<string, unknown> = {};
    if (updates.nombre !== undefined) patch.nombre = updates.nombre;
    if (updates.apellidos !== undefined) patch.apellidos = updates.apellidos;
    if (updates.departamentoId !== undefined) patch.departamento_id = updates.departamentoId;
    if (updates.puesto !== undefined) patch.puesto = updates.puesto;
    if (updates.emailEmpresa !== undefined) patch.email_empresa = updates.emailEmpresa;
    if (updates.emailPersonal !== undefined) patch.email_personal = updates.emailPersonal;
    if (updates.telefono !== undefined) patch.telefono = updates.telefono;
    if (updates.notas !== undefined) patch.notas = updates.notas;

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("empleados").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/empleados");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updateEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Cambia el estado del empleado. Validaciones (también las hace el constraint
 * `empleados_estado_check` en BD, esto es solo para dar errores legibles):
 *   - Para 'Baja temporal' / 'Baja definitiva' es obligatorio `fechaBaja`.
 *   - Para 'Activo' se limpia automáticamente la `fechaBaja`.
 *
 * Al guardar, el trigger `empleados_sync_estado_acceso` actualiza
 * automáticamente `profiles.estado_acceso` (Activo/Inactivo) si el empleado
 * tiene cuenta de portal vinculada.
 */
export async function setEmpleadoEstado(input: {
  id: string;
  estado: EstadoEmpleado;
  fechaBaja?: string | null;
}) {
  try {
    if (ESTADOS_BAJA.includes(input.estado) && !input.fechaBaja) {
      return {
        ok: false,
        error: "La fecha de baja es obligatoria para Baja temporal o Baja definitiva.",
      };
    }

    const { supabase } = await getAppContext();
    const patch: Record<string, unknown> = { estado: input.estado };
    patch.fecha_baja = input.estado === "Activo" ? null : input.fechaBaja ?? null;

    const { error } = await supabase.from("empleados").update(patch).eq("id", input.id);
    if (error) throw error;
    revalidatePath("/rrhh/empleados");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] setEmpleadoEstado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteEmpleado(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("empleados").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/empleados");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] deleteEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

export async function listDepartamentos() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: FALLBACK_DEPARTAMENTOS };
    const { data, error } = await supabase
      .from("departamentos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;
    const result = data ?? [];
    return { ok: true, data: result.length > 0 ? result : FALLBACK_DEPARTAMENTOS };
  } catch {
    return { ok: true, data: FALLBACK_DEPARTAMENTOS };
  }
}
