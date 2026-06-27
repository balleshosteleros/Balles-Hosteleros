"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import {
  aplicarEntradasAlbaran,
  revertirEntradasAlbaran,
} from "@/features/logistica/services/entradas-stock-por-albaran";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listAlbaranes() {
  try {
    const { supabase, empresaId } = await getContext();
    let query = supabase
      .from("albaranes")
      .select("*")
      .order("fecha", { ascending: false });
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[albaranes] listAlbaranes:", err);
    return { ok: false, data: [] };
  }
}

/** Estados que representan una compra ya confirmada (de "Confirmado" en adelante). */
const ESTADOS_COMPRA_CONFIRMADA = ["Confirmado", "Recibido", "Facturado"];

export interface CompraProductoRow {
  albaranId: string;
  numero: string;
  numeroProveedor: string | null;
  proveedor: string;
  fecha: string;
  estado: string;
  lineaId: string;
  producto: string;
  cantidad: number;
  unidad: string;
  precioUC: number;
  impuesto: number;
  dtoPct: number;
  dtoEur: number;
  total: number;
}

interface LineaAlbaranJson {
  id?: string;
  productoId?: string;
  producto?: string;
  cantidad?: number;
  unidad?: string;
  precioUC?: number;
  impuesto?: number;
  dtoPct?: number;
  dtoEur?: number;
  total?: number;
}

/**
 * Histórico de compras de un producto: recorre los albaranes ya confirmados de la
 * empresa y extrae únicamente las líneas que corresponden a este producto.
 */
export async function listComprasPorProducto(
  productoId: string,
): Promise<{ ok: boolean; data: CompraProductoRow[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId || !productoId) return { ok: true, data: [] };

    let query = supabase
      .from("albaranes")
      .select("id, numero, numero_proveedor, proveedor_nombre, fecha, estado, lineas")
      .in("estado", ESTADOS_COMPRA_CONFIRMADA)
      .order("fecha", { ascending: false });
    if (empresaId) query = query.eq("empresa_id", empresaId);

    const { data, error } = await query;
    if (error) throw error;

    const rows: CompraProductoRow[] = [];
    for (const alb of data ?? []) {
      const lineas = Array.isArray(alb.lineas) ? (alb.lineas as LineaAlbaranJson[]) : [];
      for (const l of lineas) {
        if (l.productoId !== productoId) continue;
        rows.push({
          albaranId: alb.id as string,
          numero: (alb.numero as string) ?? "",
          numeroProveedor: (alb.numero_proveedor as string | null) ?? null,
          proveedor: (alb.proveedor_nombre as string) ?? "",
          fecha: (alb.fecha as string) ?? "",
          estado: (alb.estado as string) ?? "",
          lineaId: l.id ?? `${alb.id}-${rows.length}`,
          producto: l.producto ?? "",
          cantidad: Number(l.cantidad ?? 0),
          unidad: l.unidad ?? "",
          precioUC: Number(l.precioUC ?? 0),
          impuesto: Number(l.impuesto ?? 0),
          dtoPct: Number(l.dtoPct ?? 0),
          dtoEur: Number(l.dtoEur ?? 0),
          total: Number(l.total ?? 0),
        });
      }
    }

    return { ok: true, data: rows };
  } catch (err) {
    console.error("[albaranes] listComprasPorProducto:", err);
    return { ok: false, data: [] };
  }
}

type CreateAlbaranResult =
  | { ok: true; id: string; numero: string; numeroSecuencial: number }
  | { ok: false; error: string };

export async function createAlbaran(input: {
  pedidoId: string;
  proveedorNombre: string;
  almacen: string;
  documento: string;
  fecha: string;
  dtoPct: number;
  dtoEur: number;
  notas: string;
  creador: string;
  lineas: unknown[];
  /** Si viene del pedido, se copia para que albarán y pedido compartan numeración. */
  numeroSecuencial?: number;
  /** Número que pone el proveedor en su albarán (opcional, lo extrae OCR o se edita manualmente). */
  numeroProveedor?: string | null;
}): Promise<CreateAlbaranResult> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Regla dura: ningún albarán puede guardarse con una línea sin productoId.
    // El productoId es lo que vincula cada línea con su producto (stock, histórico de
    // compras, etc.), así que un albarán sin él sería un dato roto.
    const lineas = Array.isArray(input.lineas) ? input.lineas : [];
    const lineasInvalidas = lineas.filter((l) => {
      const pid = (l as { productoId?: unknown })?.productoId;
      return typeof pid !== "string" || pid.trim() === "";
    });
    if (lineas.length === 0) {
      return { ok: false, error: "El albarán no tiene líneas." };
    }
    if (lineasInvalidas.length > 0) {
      return {
        ok: false,
        error:
          "Hay líneas sin producto asociado. Cada línea debe corresponder a un producto del catálogo antes de confirmar el albarán.",
      };
    }

    const year = new Date(input.fecha || new Date().toISOString()).getFullYear();
    const insertPayload: Record<string, unknown> = {
      empresa_id: empresaId,
      pedido_id: input.pedidoId,
      proveedor_nombre: input.proveedorNombre,
      almacen: input.almacen,
      documento: input.documento,
      fecha: input.fecha,
      estado: "Pendiente",
      dto_pct: input.dtoPct,
      dto_eur: input.dtoEur,
      notas: input.notas,
      creador: input.creador,
      lineas: input.lineas,
      numero_proveedor: input.numeroProveedor ?? null,
    };

    if (typeof input.numeroSecuencial === "number") {
      insertPayload.numero_secuencial = input.numeroSecuencial;
      insertPayload.numero = `ALB-${year}-${String(input.numeroSecuencial).padStart(3, "0")}`;
    } else {
      // Sin pedido de origen: el trigger asigna numero_secuencial; numero se compone luego.
      insertPayload.numero = "";
    }

    const { data, error } = await supabase
      .from("albaranes")
      .insert(insertPayload)
      .select("id, numero, numero_secuencial")
      .single();
    if (error) throw error;

    // Si el numero quedó vacío (caso huérfano), lo actualizamos con el secuencial asignado.
    if (!data.numero && typeof data.numero_secuencial === "number") {
      const numeroFinal = `ALB-${year}-${String(data.numero_secuencial).padStart(3, "0")}`;
      await supabase.from("albaranes").update({ numero: numeroFinal }).eq("id", data.id);
      return { ok: true, id: data.id as string, numero: numeroFinal, numeroSecuencial: data.numero_secuencial };
    }

    return {
      ok: true,
      id: data.id as string,
      numero: data.numero as string,
      numeroSecuencial: data.numero_secuencial as number,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] createAlbaran:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateAlbaranNumeroProveedor(id: string, numeroProveedor: string | null) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("albaranes")
      .update({ numero_proveedor: numeroProveedor })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] updateAlbaranNumeroProveedor:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateAlbaranEstado(id: string, estado: string) {
  try {
    const { supabase, user } = await getContext();

    // Estado anterior para decidir si hay que mover stock (entrar/salir de "Recibido").
    const { data: previo } = await supabase
      .from("albaranes")
      .select("estado")
      .eq("id", id)
      .maybeSingle();
    const estadoAnterior = (previo?.estado as string | undefined) ?? null;

    const { error } = await supabase
      .from("albaranes")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    // Movimientos de stock por recepción (PRP-057). Idempotente.
    if (estado === "Recibido" && estadoAnterior !== "Recibido") {
      const res = await aplicarEntradasAlbaran(id, user?.id ?? null);
      if (!res.ok) {
        // Regla de seguridad: no tragarse el error de stock, pero el estado ya cambió.
        return { ok: true, stockAviso: res.error };
      }
    } else if (estado !== "Recibido" && estadoAnterior === "Recibido") {
      // Se revierte la recepción → devolver el stock.
      await revertirEntradasAlbaran(id);
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] updateAlbaranEstado:", msg);
    return { ok: false, error: msg };
  }
}
