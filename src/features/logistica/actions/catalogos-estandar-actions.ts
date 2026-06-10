"use server";

import { revalidatePath } from "next/cache";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

/* =====================================================================
   Tipos comunes
   ===================================================================== */

export interface UnidadMedidaRow {
  id: string;
  empresa_id: string;
  codigo: string;
  label: string;
  orden: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormatoMedidaRow {
  id: string;
  empresa_id: string;
  unidad_id: string;
  nombre: string;
  orden: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface IvaRow {
  id: string;
  empresa_id: string;
  codigo: string;
  porcentaje: string;
  label: string | null;
  orden: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConservacionRow {
  id: string;
  empresa_id: string;
  nombre: string;
  rango_temp: string | null;
  orden: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

/* =====================================================================
   UNIDADES DE MEDIDA
   ===================================================================== */

export async function listUnidadesMedida() {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, data: [] as UnidadMedidaRow[], error: "Sin empresa activa" };
    const { data, error } = await supabase
      .from("unidades_medida")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as UnidadMedidaRow[] };
  } catch (err) {
    return { ok: false as const, data: [] as UnidadMedidaRow[], error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function createUnidadMedida(input: { codigo: string; label: string }) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const codigo = input.codigo.trim();
    const label = (input.label || codigo).trim();
    if (!codigo) return { ok: false as const, error: "El código es obligatorio" };

    const nextOrden = await getNextOrden(supabase, "unidades_medida", empresaId);

    const { data, error } = await supabase
      .from("unidades_medida")
      .insert({ empresa_id: empresaId, codigo, label, orden: nextOrden, activa: true })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: `Ya existe la unidad "${codigo}".` };
      throw error;
    }
    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as UnidadMedidaRow };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function updateUnidadMedida(id: string, patch: Partial<{ codigo: string; label: string; orden: number; activa: boolean }>) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.codigo !== undefined) updates.codigo = patch.codigo.trim();
    if (patch.label !== undefined) updates.label = patch.label.trim();
    if (patch.orden !== undefined) updates.orden = patch.orden;
    if (patch.activa !== undefined) updates.activa = patch.activa;

    const { data: before } = await supabase
      .from("unidades_medida")
      .select("codigo")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("unidades_medida")
      .update(updates)
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Ya existe una unidad con ese código." };
      throw error;
    }

    if (before?.codigo && patch.codigo !== undefined && patch.codigo.trim() && patch.codigo.trim() !== before.codigo) {
      const nuevoCodigo = patch.codigo.trim();
      await supabase.from("productos").update({ unidad: nuevoCodigo })
        .eq("empresa_id", empresaId).eq("unidad", before.codigo as string);
      await supabase.from("productos").update({ unidad_uso: nuevoCodigo })
        .eq("empresa_id", empresaId).eq("unidad_uso", before.codigo as string);
    }

    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as UnidadMedidaRow };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function deleteUnidadMedida(id: string) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const { data: row } = await supabase
      .from("unidades_medida")
      .select("codigo")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (row?.codigo) {
      const { count } = await supabase
        .from("productos").select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("unidad", row.codigo as string);
      if ((count ?? 0) > 0) {
        return { ok: false as const, error: `No se puede borrar: ${count} producto(s) usan la unidad "${row.codigo}".` };
      }
    }

    const { error } = await supabase.from("unidades_medida").delete()
      .eq("id", id).eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/logistica/productos");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/* =====================================================================
   FORMATOS DE MEDIDA (por unidad)
   ===================================================================== */

export async function listFormatosMedida(unidadId?: string) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, data: [] as FormatoMedidaRow[], error: "Sin empresa activa" };
    const query = supabase.from("formatos_medida").select("*")
      .eq("empresa_id", empresaId).order("orden", { ascending: true });
    if (unidadId) query.eq("unidad_id", unidadId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as FormatoMedidaRow[] };
  } catch (err) {
    return { ok: false as const, data: [] as FormatoMedidaRow[], error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function createFormatoMedida(input: { unidadId: string; nombre: string }) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false as const, error: "El nombre es obligatorio" };

    const nextOrden = await getNextOrden(supabase, "formatos_medida", empresaId, { unidad_id: input.unidadId });

    const { data, error } = await supabase.from("formatos_medida")
      .insert({ empresa_id: empresaId, unidad_id: input.unidadId, nombre, orden: nextOrden, activa: true })
      .select("*").single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: `Ya existe el formato "${nombre}" para esa unidad.` };
      throw error;
    }
    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as FormatoMedidaRow };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function updateFormatoMedida(id: string, patch: Partial<{ nombre: string; orden: number; activa: boolean }>) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.nombre !== undefined) updates.nombre = patch.nombre.trim();
    if (patch.orden !== undefined) updates.orden = patch.orden;
    if (patch.activa !== undefined) updates.activa = patch.activa;

    const { data: before } = await supabase.from("formatos_medida")
      .select("nombre").eq("id", id).eq("empresa_id", empresaId).maybeSingle();

    const { data, error } = await supabase.from("formatos_medida")
      .update(updates).eq("id", id).eq("empresa_id", empresaId).select("*").single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Ya existe un formato con ese nombre." };
      throw error;
    }

    if (before?.nombre && patch.nombre !== undefined && patch.nombre.trim() && patch.nombre.trim() !== before.nombre) {
      await supabase.from("productos").update({ formato: patch.nombre.trim() })
        .eq("empresa_id", empresaId).eq("formato", before.nombre as string);
    }

    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as FormatoMedidaRow };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function deleteFormatoMedida(id: string) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const { data: row } = await supabase.from("formatos_medida")
      .select("nombre").eq("id", id).eq("empresa_id", empresaId).maybeSingle();

    if (row?.nombre) {
      const { count } = await supabase.from("productos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("formato", row.nombre as string);
      if ((count ?? 0) > 0) {
        return { ok: false as const, error: `No se puede borrar: ${count} producto(s) usan el formato "${row.nombre}".` };
      }
    }

    const { error } = await supabase.from("formatos_medida").delete()
      .eq("id", id).eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/logistica/productos");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/* =====================================================================
   IVAS
   ===================================================================== */

export async function listIvas() {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, data: [] as IvaRow[], error: "Sin empresa activa" };
    const { data, error } = await supabase.from("ivas").select("*")
      .eq("empresa_id", empresaId).order("orden", { ascending: true });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as IvaRow[] };
  } catch (err) {
    return { ok: false as const, data: [] as IvaRow[], error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function createIva(input: { codigo: string; porcentaje: number; label?: string }) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const codigo = input.codigo.trim();
    if (!codigo) return { ok: false as const, error: "El código es obligatorio" };

    const nextOrden = await getNextOrden(supabase, "ivas", empresaId);

    const { data, error } = await supabase.from("ivas").insert({
      empresa_id: empresaId, codigo, porcentaje: input.porcentaje,
      label: input.label?.trim() || null, orden: nextOrden, activa: true,
    }).select("*").single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: `Ya existe el IVA "${codigo}".` };
      throw error;
    }
    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as IvaRow };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function updateIva(id: string, patch: Partial<{ codigo: string; porcentaje: number; label: string | null; orden: number; activa: boolean }>) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.codigo !== undefined) updates.codigo = patch.codigo.trim();
    if (patch.porcentaje !== undefined) updates.porcentaje = patch.porcentaje;
    if (patch.label !== undefined) updates.label = patch.label;
    if (patch.orden !== undefined) updates.orden = patch.orden;
    if (patch.activa !== undefined) updates.activa = patch.activa;

    const { data: before } = await supabase.from("ivas").select("codigo")
      .eq("id", id).eq("empresa_id", empresaId).maybeSingle();

    const { data, error } = await supabase.from("ivas").update(updates)
      .eq("id", id).eq("empresa_id", empresaId).select("*").single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Ya existe un IVA con ese código." };
      throw error;
    }

    if (before?.codigo && patch.codigo !== undefined && patch.codigo.trim() && patch.codigo.trim() !== before.codigo) {
      await supabase.from("productos").update({ iva: patch.codigo.trim() })
        .eq("empresa_id", empresaId).eq("iva", before.codigo as string);
    }

    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as IvaRow };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function deleteIva(id: string) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const { data: row } = await supabase.from("ivas").select("codigo")
      .eq("id", id).eq("empresa_id", empresaId).maybeSingle();

    if (row?.codigo) {
      const { count } = await supabase.from("productos").select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("iva", row.codigo as string);
      if ((count ?? 0) > 0) {
        return { ok: false as const, error: `No se puede borrar: ${count} producto(s) usan el IVA "${row.codigo}".` };
      }
    }

    const { error } = await supabase.from("ivas").delete()
      .eq("id", id).eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/logistica/productos");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/* =====================================================================
   CONSERVACIONES
   ===================================================================== */

export async function listConservaciones() {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, data: [] as ConservacionRow[], error: "Sin empresa activa" };
    const { data, error } = await supabase.from("conservaciones").select("*")
      .eq("empresa_id", empresaId).order("orden", { ascending: true });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as ConservacionRow[] };
  } catch (err) {
    return { ok: false as const, data: [] as ConservacionRow[], error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function createConservacion(input: { nombre: string; rangoTemp?: string }) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false as const, error: "El nombre es obligatorio" };

    const nextOrden = await getNextOrden(supabase, "conservaciones", empresaId);

    const { data, error } = await supabase.from("conservaciones").insert({
      empresa_id: empresaId, nombre, rango_temp: input.rangoTemp?.trim() || null,
      orden: nextOrden, activa: true,
    }).select("*").single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: `Ya existe la conservación "${nombre}".` };
      throw error;
    }
    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as ConservacionRow };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function updateConservacion(id: string, patch: Partial<{ nombre: string; rangoTemp: string | null; orden: number; activa: boolean }>) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.nombre !== undefined) updates.nombre = patch.nombre.trim();
    if (patch.rangoTemp !== undefined) updates.rango_temp = patch.rangoTemp;
    if (patch.orden !== undefined) updates.orden = patch.orden;
    if (patch.activa !== undefined) updates.activa = patch.activa;

    const { data: before } = await supabase.from("conservaciones").select("nombre")
      .eq("id", id).eq("empresa_id", empresaId).maybeSingle();

    const { data, error } = await supabase.from("conservaciones").update(updates)
      .eq("id", id).eq("empresa_id", empresaId).select("*").single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Ya existe una conservación con ese nombre." };
      throw error;
    }

    if (before?.nombre && patch.nombre !== undefined && patch.nombre.trim() && patch.nombre.trim() !== before.nombre) {
      await supabase.from("productos").update({ conservacion: patch.nombre.trim() })
        .eq("empresa_id", empresaId).eq("conservacion", before.nombre as string);
    }

    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as ConservacionRow };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function deleteConservacion(id: string) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const { data: row } = await supabase.from("conservaciones").select("nombre")
      .eq("id", id).eq("empresa_id", empresaId).maybeSingle();

    if (row?.nombre) {
      const { count } = await supabase.from("productos").select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId).eq("conservacion", row.nombre as string);
      if ((count ?? 0) > 0) {
        return { ok: false as const, error: `No se puede borrar: ${count} producto(s) usan la conservación "${row.nombre}".` };
      }
    }

    const { error } = await supabase.from("conservaciones").delete()
      .eq("id", id).eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/logistica/productos");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/* =====================================================================
   Helper compartido
   ===================================================================== */

async function getNextOrden(
  supabase: Awaited<ReturnType<typeof getLogisticaContext>>["supabase"],
  tabla: string,
  empresaId: string,
  extraFilter?: Record<string, string>,
): Promise<number> {
  const query = supabase.from(tabla).select("orden").eq("empresa_id", empresaId)
    .order("orden", { ascending: false }).limit(1);
  if (extraFilter) {
    for (const [k, v] of Object.entries(extraFilter)) query.eq(k, v);
  }
  const { data } = await query.maybeSingle();
  return ((data?.orden as number | undefined) ?? 0) + 1;
}
