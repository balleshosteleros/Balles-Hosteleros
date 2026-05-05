"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: (data?.empresa_id ?? null) as string | null };
}

export interface VacanteInput {
  titulo: string;
  descripcion?: string | null;
  puesto_id?: string | null;
  departamento_id?: string | null;
  categoria?: string | null;
  ubicacion?: string | null;
  tipo_jornada?: string | null;
  salario_rango?: string | null;
  estado_publicacion?: "publicada" | "borrador" | "cerrada" | "archivada";
  visible_publicamente?: boolean;
  cuestionario?: boolean;
  favorita?: boolean;
}

export async function listVacantes() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] as never[] };

    const { data, error } = await supabase
      .from("vacantes")
      .select(`
        *,
        puestos(id,nombre),
        departamentos(id,nombre)
      `)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listVacantes:", err);
    return { ok: false, data: [] };
  }
}

export async function getVacanteById(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: null };

    const { data, error } = await supabase
      .from("vacantes")
      .select("*, puestos(id,nombre), departamentos(id,nombre)")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] getVacanteById:", err);
    return { ok: false, data: null };
  }
}

export async function createVacante(input: VacanteInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.titulo?.trim()) return { ok: false, error: "El título es obligatorio" };

    const { data, error } = await supabase
      .from("vacantes")
      .insert({
        empresa_id: empresaId,
        titulo: input.titulo.trim(),
        descripcion: input.descripcion ?? null,
        puesto_id: input.puesto_id ?? null,
        departamento_id: input.departamento_id ?? null,
        categoria: input.categoria ?? null,
        ubicacion: input.ubicacion ?? null,
        tipo_jornada: input.tipo_jornada ?? null,
        salario_rango: input.salario_rango ?? null,
        estado_publicacion: input.estado_publicacion ?? "borrador",
        visible_publicamente: input.visible_publicamente ?? false,
        cuestionario: input.cuestionario ?? false,
        favorita: input.favorita ?? false,
        creado_por: user?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateVacante(id: string, input: Partial<VacanteInput>) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { error } = await supabase
      .from("vacantes")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updateVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteVacante(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { error } = await supabase
      .from("vacantes")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] deleteVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function toggleVisibilidadVacante(id: string, visible: boolean) {
  return updateVacante(id, { visible_publicamente: visible });
}

export async function publicarVacante(id: string) {
  return updateVacante(id, { estado_publicacion: "publicada" });
}

export async function cerrarVacante(id: string) {
  return updateVacante(id, { estado_publicacion: "cerrada", visible_publicamente: false });
}

export async function listPuestosCatalogo() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("puestos")
      .select("id,nombre,departamento_id")
      .eq("empresa_id", empresaId)
      .eq("estado", "activo")
      .order("nombre");
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listPuestosCatalogo:", err);
    return { ok: false, data: [] };
  }
}

export async function listDepartamentosCatalogo() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("departamentos")
      .select("id,nombre")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listDepartamentosCatalogo:", err);
    return { ok: false, data: [] };
  }
}

export async function createPuesto(input: { nombre: string; departamento_id?: string | null; descripcion?: string | null }) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre?.trim()) return { ok: false, error: "El nombre es obligatorio" };

    const { data, error } = await supabase
      .from("puestos")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        departamento_id: input.departamento_id ?? null,
        descripcion: input.descripcion ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createPuesto:", msg);
    return { ok: false, error: msg };
  }
}
