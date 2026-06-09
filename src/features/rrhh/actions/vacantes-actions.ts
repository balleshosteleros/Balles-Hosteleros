"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
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
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };

    // El id es PK única; RLS se encarga de la autorización. No filtramos por
    // empresa_id porque el contexto seleccionado en cliente puede no coincidir
    // con el `profiles.empresa_id` por defecto.
    const { data, error } = await supabase
      .from("vacantes")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) {
      return { ok: false, error: "No se encontró la vacante o sin permisos" };
    }
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

    // Cronograma 1:1 con el puesto: se crea AL MOMENTO (idempotente).
    await crearCronogramaParaPuesto(data.id);

    revalidatePath("/rrhh/salarios");
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createPuesto:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Crea (si no existe) el cronograma operativo pendiente del puesto. Idempotente:
 * SOLO puede haber UN cronograma por puesto. Devuelve `yaExistia` si ya lo tenía.
 */
export async function crearCronogramaParaPuesto(puestoId: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: puesto } = await supabase
      .from("puestos")
      .select("nombre, departamentos(nombre)")
      .eq("id", puestoId)
      .maybeSingle();
    if (!puesto) return { ok: false, error: "Puesto no encontrado" };
    const rol = (puesto.nombre as string).trim();

    const { data: existe } = await supabase
      .from("cronogramas_operativos")
      .select("id")
      .eq("puesto_id", puestoId)
      .limit(1)
      .maybeSingle();
    if (existe?.id) return { ok: true, yaExistia: true, rol };

    const deptNombre = (puesto.departamentos as { nombre?: string } | null)?.nombre ?? "";
    const { error } = await supabase.from("cronogramas_operativos").insert({
      empresa_id: empresaId,
      puesto_id: puestoId,
      rol,
      departamento: deptNombre,
      tarea: "Añadir misión de " + rol,
      frecuencia: "OTRO",
      tiempo_requerido: "",
      id_visible: "1",
      orden: 1,
      parent_id: null,
    });
    if (error) throw error;

    revalidatePath("/direccion/cronogramas");
    return { ok: true, yaExistia: false, rol };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] crearCronogramaParaPuesto:", msg);
    return { ok: false, error: msg };
  }
}

/** Puestos de la empresa para el desplegable de "Nuevo cronograma". */
export async function listPuestosParaCronograma(): Promise<{
  ok: boolean;
  data: Array<{ id: string; nombre: string; departamento: string; tieneCronograma: boolean }>;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const [puestosRes, cronosRes] = await Promise.all([
      supabase.from("puestos").select("id, nombre, departamentos(nombre)").eq("empresa_id", empresaId).order("nombre"),
      supabase.from("cronogramas_operativos").select("puesto_id").eq("empresa_id", empresaId).not("puesto_id", "is", null),
    ]);
    const conCrono = new Set((cronosRes.data ?? []).map((c) => (c as { puesto_id: string }).puesto_id));
    const data = (puestosRes.data ?? []).map((p) => ({
      id: p.id as string,
      nombre: p.nombre as string,
      departamento: ((p as { departamentos?: { nombre?: string } | null }).departamentos)?.nombre ?? "",
      tieneCronograma: conCrono.has(p.id as string),
    }));
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] listPuestosParaCronograma:", err);
    return { ok: false, data: [] };
  }
}
