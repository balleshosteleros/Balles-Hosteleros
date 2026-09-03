"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { ESTADOS_COMPRA_CONFIRMADA } from "@/features/logistica/data/albaranes";
import { friendlyError } from "@/shared/lib/friendly-errors";

export interface MarcaRow {
  id: string;
  nombre: string;
  razonSocial: string | null;
  cif: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  visibilidad: string | null;
  observaciones: string | null;
  estado: string;
  numeroSecuencial: number | null;
  referencias: number;
}

export interface ReferenciaRow {
  id: string;
  productoId: string;
  producto: string;
  rapelUnidad: number;
  objetivo: number;
  orden: number;
}

/** Una compra concreta: la línea de un albarán que toca una referencia del acuerdo. */
export interface CompraAlbaranRow {
  albaranId: string;
  numero: string;
  numeroProveedor: string | null;
  proveedor: string;
  fecha: string;
  cantidad: number;
  unidad: string;
  total: number;
}

/** Lo comprado de una referencia en un mes: cantidad, rapel generado y sus albaranes. */
export interface CeldaMes {
  cantidad: number;
  rapel: number;
  albaranes: CompraAlbaranRow[];
}

export interface FilaAcuerdo {
  referenciaId: string;
  productoId: string;
  producto: string;
  rapelUnidad: number;
  objetivo: number;
  /** Índice 0-11 = enero-diciembre del año consultado. */
  meses: CeldaMes[];
  totalCantidad: number;
  totalRapel: number;
}

export interface AcuerdoAnual {
  marca: MarcaRow | null;
  anio: number;
  filas: FilaAcuerdo[];
}

interface LineaAlbaranJson {
  productoId?: string;
  producto?: string;
  cantidad?: number;
  unidad?: string;
  total?: number;
}

function mapMarca(row: Record<string, unknown>, referencias = 0): MarcaRow {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? "",
    razonSocial: (row.razon_social as string | null) ?? null,
    cif: (row.cif as string | null) ?? null,
    fechaInicio: (row.fecha_inicio as string | null) ?? null,
    fechaFin: (row.fecha_fin as string | null) ?? null,
    visibilidad: (row.visibilidad as string | null) ?? null,
    observaciones: (row.observaciones as string | null) ?? null,
    estado: (row.estado as string) ?? "Activo",
    numeroSecuencial: (row.numero_secuencial as number | null) ?? null,
    referencias,
  };
}

export async function listMarcas(): Promise<{ ok: boolean; data: MarcaRow[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("logistica_marcas")
      .select("*, logistica_marca_referencias(id)")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;

    const rows = (data ?? []).map((m) => {
      const refs = m.logistica_marca_referencias;
      return mapMarca(m, Array.isArray(refs) ? refs.length : 0);
    });
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[marcas] listMarcas:", err);
    return { ok: false, data: [], error: friendlyError(err, "listMarcas") };
  }
}

export async function createMarca(input: {
  nombre: string;
  razonSocial?: string | null;
  cif?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  visibilidad?: string | null;
  observaciones?: string | null;
  estado?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { supabase, userId, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const nombre = input.nombre?.trim();
    if (!nombre) return { ok: false, error: "El nombre de la marca es obligatorio." };

    // Numeración por empresa, igual que el resto de catálogos de logística.
    const { data: ultima } = await supabase
      .from("logistica_marcas")
      .select("numero_secuencial")
      .eq("empresa_id", empresaId)
      .order("numero_secuencial", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("logistica_marcas")
      .insert({
        empresa_id: empresaId,
        nombre,
        razon_social: input.razonSocial?.trim() || null,
        cif: input.cif?.trim() || null,
        fecha_inicio: input.fechaInicio || null,
        fecha_fin: input.fechaFin || null,
        visibilidad: input.visibilidad?.trim() || null,
        observaciones: input.observaciones?.trim() || null,
        estado: input.estado === "Inactivo" ? "Inactivo" : "Activo",
        numero_secuencial: ((ultima?.numero_secuencial as number | null) ?? 0) + 1,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    return { ok: true, id: data.id as string };
  } catch (err) {
    console.error("[marcas] createMarca:", err);
    return { ok: false, error: friendlyError(err, "createMarca") };
  }
}

export async function updateMarca(
  id: string,
  input: {
    nombre?: string;
    razonSocial?: string | null;
    cif?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    visibilidad?: string | null;
    observaciones?: string | null;
    estado?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (!nombre) return { ok: false, error: "El nombre de la marca es obligatorio." };
      patch.nombre = nombre;
    }
    if (input.razonSocial !== undefined) patch.razon_social = input.razonSocial?.trim() || null;
    if (input.cif !== undefined) patch.cif = input.cif?.trim() || null;
    if (input.fechaInicio !== undefined) patch.fecha_inicio = input.fechaInicio || null;
    if (input.fechaFin !== undefined) patch.fecha_fin = input.fechaFin || null;
    if (input.visibilidad !== undefined) patch.visibilidad = input.visibilidad?.trim() || null;
    if (input.observaciones !== undefined) patch.observaciones = input.observaciones?.trim() || null;
    if (input.estado !== undefined) patch.estado = input.estado === "Inactivo" ? "Inactivo" : "Activo";

    const { error } = await supabase
      .from("logistica_marcas")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    return { ok: true };
  } catch (err) {
    console.error("[marcas] updateMarca:", err);
    return { ok: false, error: friendlyError(err, "updateMarca") };
  }
}

export async function deleteMarca(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { error } = await supabase
      .from("logistica_marcas")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    return { ok: true };
  } catch (err) {
    console.error("[marcas] deleteMarca:", err);
    return { ok: false, error: friendlyError(err, "deleteMarca") };
  }
}

export async function listReferencias(
  marcaId: string,
): Promise<{ ok: boolean; data: ReferenciaRow[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId || !marcaId) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("logistica_marca_referencias")
      .select("id, producto_id, rapel_unidad, objetivo, orden, productos(nombre)")
      .eq("empresa_id", empresaId)
      .eq("marca_id", marcaId)
      .order("orden");
    if (error) throw error;

    const rows: ReferenciaRow[] = (data ?? []).map((r) => {
      const prod = r.productos as { nombre?: string } | null;
      return {
        id: r.id as string,
        productoId: r.producto_id as string,
        producto: prod?.nombre ?? "",
        rapelUnidad: Number(r.rapel_unidad ?? 0),
        objetivo: Number(r.objetivo ?? 0),
        orden: Number(r.orden ?? 0),
      };
    });
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[marcas] listReferencias:", err);
    return { ok: false, data: [], error: friendlyError(err, "listReferencias") };
  }
}

export async function addReferencia(input: {
  marcaId: string;
  productoId: string;
  rapelUnidad: number;
  objetivo: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.productoId) return { ok: false, error: "Elige un producto." };

    const { data: ultima } = await supabase
      .from("logistica_marca_referencias")
      .select("orden")
      .eq("marca_id", input.marcaId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("logistica_marca_referencias").insert({
      empresa_id: empresaId,
      marca_id: input.marcaId,
      producto_id: input.productoId,
      rapel_unidad: input.rapelUnidad || 0,
      objetivo: input.objetivo || 0,
      orden: ((ultima?.orden as number | null) ?? 0) + 1,
    });
    if (error) {
      // Clave única (marca, producto): el producto ya está en el acuerdo.
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, error: "Ese producto ya está en el acuerdo." };
      }
      throw error;
    }

    return { ok: true };
  } catch (err) {
    console.error("[marcas] addReferencia:", err);
    return { ok: false, error: friendlyError(err, "addReferencia") };
  }
}

export async function updateReferencia(
  id: string,
  input: { rapelUnidad?: number; objetivo?: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.rapelUnidad !== undefined) patch.rapel_unidad = input.rapelUnidad;
    if (input.objetivo !== undefined) patch.objetivo = input.objetivo;

    const { error } = await supabase
      .from("logistica_marca_referencias")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    return { ok: true };
  } catch (err) {
    console.error("[marcas] updateReferencia:", err);
    return { ok: false, error: friendlyError(err, "updateReferencia") };
  }
}

export async function deleteReferencia(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { error } = await supabase
      .from("logistica_marca_referencias")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    return { ok: true };
  } catch (err) {
    console.error("[marcas] deleteReferencia:", err);
    return { ok: false, error: friendlyError(err, "deleteReferencia") };
  }
}

function celdaVacia(): CeldaMes {
  return { cantidad: 0, rapel: 0, albaranes: [] };
}

/**
 * El acuerdo de una marca en un año: por cada referencia, lo comprado mes a mes
 * según los albaranes YA CONFIRMADOS de la empresa activa, con el detalle de qué
 * albaranes componen cada mes para poder abrirlos.
 */
export async function getAcuerdoAnual(
  marcaId: string,
  anio: number,
): Promise<{ ok: boolean; data: AcuerdoAnual; error?: string }> {
  const vacio: AcuerdoAnual = { marca: null, anio, filas: [] };
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId || !marcaId) return { ok: true, data: vacio };

    const { data: marcaRow, error: errMarca } = await supabase
      .from("logistica_marcas")
      .select("*")
      .eq("id", marcaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (errMarca) throw errMarca;
    if (!marcaRow) return { ok: true, data: vacio };

    const refs = await listReferencias(marcaId);
    if (!refs.ok) return { ok: false, data: vacio, error: refs.error };

    const marca = mapMarca(marcaRow, refs.data.length);
    if (refs.data.length === 0) return { ok: true, data: { marca, anio, filas: [] } };

    // Solo albaranes del año pedido y con la mercancía ya recepcionada: un albarán
    // pendiente o en revisión todavía no es una compra que cuente para el rapel.
    const { data: albaranes, error: errAlb } = await supabase
      .from("albaranes")
      .select("id, numero, numero_proveedor, proveedor_nombre, fecha, lineas")
      .eq("empresa_id", empresaId)
      .in("estado", ESTADOS_COMPRA_CONFIRMADA)
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`)
      .order("fecha");
    if (errAlb) throw errAlb;

    const porProducto = new Map<string, CeldaMes[]>();
    for (const ref of refs.data) {
      porProducto.set(
        ref.productoId,
        Array.from({ length: 12 }, celdaVacia),
      );
    }

    for (const alb of albaranes ?? []) {
      const fecha = (alb.fecha as string) ?? "";
      const mes = Number(fecha.slice(5, 7)) - 1;
      if (mes < 0 || mes > 11) continue;

      const lineas = Array.isArray(alb.lineas) ? (alb.lineas as LineaAlbaranJson[]) : [];
      for (const l of lineas) {
        if (!l.productoId) continue;
        const meses = porProducto.get(l.productoId);
        if (!meses) continue;

        const cantidad = Number(l.cantidad ?? 0);
        const celda = meses[mes];
        celda.cantidad += cantidad;
        celda.albaranes.push({
          albaranId: alb.id as string,
          numero: (alb.numero as string) ?? "",
          numeroProveedor: (alb.numero_proveedor as string | null) ?? null,
          proveedor: (alb.proveedor_nombre as string) ?? "",
          fecha,
          cantidad,
          unidad: l.unidad ?? "",
          total: Number(l.total ?? 0),
        });
      }
    }

    const filas: FilaAcuerdo[] = refs.data.map((ref) => {
      const meses = porProducto.get(ref.productoId) ?? Array.from({ length: 12 }, celdaVacia);
      let totalCantidad = 0;
      for (const m of meses) {
        m.rapel = m.cantidad * ref.rapelUnidad;
        totalCantidad += m.cantidad;
      }
      return {
        referenciaId: ref.id,
        productoId: ref.productoId,
        producto: ref.producto,
        rapelUnidad: ref.rapelUnidad,
        objetivo: ref.objetivo,
        meses,
        totalCantidad,
        totalRapel: totalCantidad * ref.rapelUnidad,
      };
    });

    return { ok: true, data: { marca, anio, filas } };
  } catch (err) {
    console.error("[marcas] getAcuerdoAnual:", err);
    return { ok: false, data: vacio, error: friendlyError(err, "getAcuerdoAnual") };
  }
}
