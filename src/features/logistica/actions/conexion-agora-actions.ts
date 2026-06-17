"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

export interface ConexionAgora {
  agoraId: string | null;
  /** Nombre con el que Ágora vende este producto (derivado de las ventas reales). */
  nombreAgora: string | null;
  vendidoEnAgora: boolean;
  unidadesVendidas: number;
  /** Fecha de la última venta en Ágora (ISO) o null. Detecta productos descatalogados. */
  ultimaVenta: string | null;
}

/**
 * Información de la conexión con Ágora de un producto (PRP-057):
 * su ID de Ágora, el nombre con el que Ágora lo vende (sacado de las ventas
 * ingeridas, no de una llamada a Ágora) y si realmente se ha vendido.
 */
export async function getConexionAgora(productoId: string): Promise<ConexionAgora> {
  const vacio: ConexionAgora = { agoraId: null, nombreAgora: null, vendidoEnAgora: false, unidadesVendidas: 0, ultimaVenta: null };
  try {
    const { supabase } = await getLogisticaContext();

    const { data: prod } = await supabase
      .from("productos")
      .select("agora_id")
      .eq("id", productoId)
      .maybeSingle();
    const agoraId = (prod?.agora_id as string | null) ?? null;

    // Nombre, unidades y fecha desde las ventas reales (pos_ticket_lineas de PRP-056).
    const { data: lineas } = await supabase
      .from("pos_ticket_lineas")
      .select("nombre, cantidad, pos_tickets(cerrado_at)")
      .eq("producto_id", productoId)
      .limit(1000);

    if (!lineas || lineas.length === 0) {
      return { agoraId, nombreAgora: null, vendidoEnAgora: false, unidadesVendidas: 0, ultimaVenta: null };
    }

    // Nombre más frecuente + suma de unidades + última venta.
    const cuenta = new Map<string, number>();
    let unidades = 0;
    let ultimaVenta: string | null = null;
    for (const l of lineas as {
      nombre: string | null;
      cantidad: number | null;
      pos_tickets: { cerrado_at: string | null } | { cerrado_at: string | null }[] | null;
    }[]) {
      unidades += Number(l.cantidad ?? 0);
      if (l.nombre) cuenta.set(l.nombre, (cuenta.get(l.nombre) ?? 0) + 1);
      const t = Array.isArray(l.pos_tickets) ? l.pos_tickets[0] : l.pos_tickets;
      const cerrado = t?.cerrado_at ?? null;
      if (cerrado && (!ultimaVenta || cerrado > ultimaVenta)) ultimaVenta = cerrado;
    }
    let nombreAgora: string | null = null;
    let max = 0;
    for (const [nombre, n] of cuenta) {
      if (n > max) {
        max = n;
        nombreAgora = nombre;
      }
    }

    return { agoraId, nombreAgora, vendidoEnAgora: true, unidadesVendidas: unidades, ultimaVenta };
  } catch (err) {
    console.error("[conexion-agora] getConexionAgora:", err);
    return vacio;
  }
}

/** Configura (o limpia) el ID de Ágora de un producto desde Balles. */
export async function updateAgoraId(
  productoId: string,
  agoraId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const limpio = agoraId?.trim() || null;
    const { error } = await supabase
      .from("productos")
      .update({ agora_id: limpio })
      .eq("id", productoId)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[conexion-agora] updateAgoraId:", msg);
    return { ok: false, error: msg };
  }
}
