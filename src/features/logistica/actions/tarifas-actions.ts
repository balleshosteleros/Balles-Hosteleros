"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

export type Tarifa = {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string | null;
  esDefault: boolean;
  activa: boolean;
  orden: number;
};

export type ProductoTarifaPrecio = {
  id: string;
  productoId: string;
  tarifaId: string;
  precio: number;
  iva: string | null;
};

type TarifaRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  es_default: boolean;
  activa: boolean;
  orden: number;
};

type PtpRow = {
  id: string;
  producto_id: string;
  tarifa_id: string;
  precio: number | string;
  iva: string | null;
};

function mapTarifa(r: TarifaRow): Tarifa {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    esDefault: r.es_default,
    activa: r.activa,
    orden: r.orden,
  };
}

function mapPtp(r: PtpRow): ProductoTarifaPrecio {
  return {
    id: r.id,
    productoId: r.producto_id,
    tarifaId: r.tarifa_id,
    precio: Number(r.precio ?? 0),
    iva: r.iva,
  };
}

export async function listTarifas(opts?: { soloActivas?: boolean }): Promise<{
  ok: boolean;
  data: Tarifa[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, data: [], error: "No se encontró la empresa" };

    let q = supabase
      .from("tarifas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (opts?.soloActivas) q = q.eq("activa", true);

    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: ((data as TarifaRow[]) ?? []).map(mapTarifa) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tarifas] listTarifas:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function createTarifa(input: {
  nombre: string;
  descripcion?: string | null;
  activa?: boolean;
}): Promise<{ ok: boolean; data?: Tarifa; error?: string }> {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };

    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No se encontró la empresa" };

    const { data, error } = await supabase
      .from("tarifas")
      .insert({
        empresa_id: empresaId,
        nombre,
        descripcion: input.descripcion ?? null,
        activa: input.activa ?? true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, data: mapTarifa(data as TarifaRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tarifas] createTarifa:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateTarifa(
  id: string,
  patch: { nombre?: string; descripcion?: string | null; activa?: boolean; orden?: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getLogisticaContext();
    const update: Record<string, unknown> = {};
    if (patch.nombre !== undefined) update.nombre = patch.nombre.trim();
    if (patch.descripcion !== undefined) update.descripcion = patch.descripcion;
    if (patch.activa !== undefined) update.activa = patch.activa;
    if (patch.orden !== undefined) update.orden = patch.orden;

    const { error } = await supabase.from("tarifas").update(update).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tarifas] updateTarifa:", msg);
    return { ok: false, error: msg };
  }
}

export async function setTarifaDefault(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No se encontró la empresa" };

    // Quita default de todas y ponla solo en la elegida
    const { error: e1 } = await supabase
      .from("tarifas")
      .update({ es_default: false })
      .eq("empresa_id", empresaId);
    if (e1) throw e1;

    const { error: e2 } = await supabase
      .from("tarifas")
      .update({ es_default: true, activa: true })
      .eq("id", id);
    if (e2) throw e2;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tarifas] setTarifaDefault:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteTarifa(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getLogisticaContext();

    const { data: t } = await supabase
      .from("tarifas")
      .select("es_default")
      .eq("id", id)
      .maybeSingle();
    if (t?.es_default) {
      return { ok: false, error: "No se puede eliminar la tarifa default. Marca otra como default primero." };
    }

    const { error } = await supabase.from("tarifas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tarifas] deleteTarifa:", msg);
    return { ok: false, error: msg };
  }
}

/* ─── Precios por tarifa ─────────────────────────────────────── */

export async function listPreciosByProducto(productoId: string): Promise<{
  ok: boolean;
  data: ProductoTarifaPrecio[];
  error?: string;
}> {
  try {
    const { supabase } = await getLogisticaContext();
    const { data, error } = await supabase
      .from("producto_tarifa_precios")
      .select("*")
      .eq("producto_id", productoId);
    if (error) throw error;
    return { ok: true, data: ((data as PtpRow[]) ?? []).map(mapPtp) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tarifas] listPreciosByProducto:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function upsertPrecioTarifa(input: {
  productoId: string;
  tarifaId: string;
  precio: number;
  iva?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!Number.isFinite(input.precio) || input.precio < 0) {
      return { ok: false, error: "Precio inválido" };
    }
    const { supabase } = await getLogisticaContext();
    const { error } = await supabase
      .from("producto_tarifa_precios")
      .upsert(
        {
          producto_id: input.productoId,
          tarifa_id: input.tarifaId,
          precio: input.precio,
          iva: input.iva ?? null,
        },
        { onConflict: "producto_id,tarifa_id" },
      );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tarifas] upsertPrecioTarifa:", msg);
    return { ok: false, error: msg };
  }
}

export async function deletePrecioTarifa(input: {
  productoId: string;
  tarifaId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getLogisticaContext();
    const { error } = await supabase
      .from("producto_tarifa_precios")
      .delete()
      .eq("producto_id", input.productoId)
      .eq("tarifa_id", input.tarifaId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tarifas] deletePrecioTarifa:", msg);
    return { ok: false, error: msg };
  }
}
