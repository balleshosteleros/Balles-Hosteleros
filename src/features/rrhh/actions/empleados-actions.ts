"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";

const FALLBACK_DEPARTAMENTOS = [
  "DIRECCIÓN", "SALA", "COCINA", "GERENCIA", "CAMAREROS",
  "CACHIMBEROS", "ARTISTAS", "MANTENIMIENTO", "RRPP", "ADMINISTRATIVO",
].map(nombre => ({ id: `mock-dep-${nombre.toLowerCase().replace(/\s+/g, "-")}`, nombre }));

const FALLBACK_PUESTOS = [
  "Director/a", "Gerente", "Jefe/a de sala", "Camarero/a", "Cocinero/a",
  "Ayudante de cocina", "Cachimbero/a", "Artista", "Técnico de mantenimiento",
  "RRPP", "Administrativo/a", "Responsable de cocina",
].map(nombre => ({ id: `mock-pue-${nombre.toLowerCase().replace(/[\s/]+/g, "-")}`, nombre }));

export async function listEmpleados() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };

    const { data, error } = await supabase
      .from("empleados")
      .select(`
        *,
        departamentos(nombre),
        puestos_trabajo(nombre)
      `)
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
  puestoId?: string;
  emailEmpresa?: string;
  telefono?: string;
  estado?: string;
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
      puesto_id: isRealId(input.puestoId) ? input.puestoId : null,
      email_empresa: input.emailEmpresa ?? null,
      telefono: input.telefono ?? null,
      estado: input.estado ?? "Activo",
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

export async function updateEmpleado(id: string, updates: any) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("empleados")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/rrhh/empleados");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updateEmpleado:", msg);
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

export async function listPuestos() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: FALLBACK_PUESTOS };
    const { data, error } = await supabase
      .from("puestos_trabajo")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;
    const result = data ?? [];
    return { ok: true, data: result.length > 0 ? result : FALLBACK_PUESTOS };
  } catch {
    return { ok: true, data: FALLBACK_PUESTOS };
  }
}
