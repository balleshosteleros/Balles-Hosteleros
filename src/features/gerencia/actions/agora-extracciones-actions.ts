"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type ExtraccionDia = {
  dia: string;
  facturas: number;
  total: number;
  ceros: number;
  negativos: number;
};

export type FacturaAgora = {
  id: string;
  numero: string;
  serie: string | null;
  agoraNumero: number | null;
  total: number;
  comensales: number;
  fecha: string | null;
  lineas: { nombre: string; cantidad: number; precioUnitario: number; total: number }[];
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Resumen por business-day de las extracciones de ventas de Ágora. */
export async function getExtraccionesAgora(): Promise<
  { ok: true; data: ExtraccionDia[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase.rpc("extracciones_agora_resumen", { p_empresa: empresaId });
    if (error) throw error;
    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      dia: String(r.dia),
      facturas: Number(r.facturas) || 0,
      total: toNum(r.total),
      ceros: Number(r.ceros) || 0,
      negativos: Number(r.negativos) || 0,
    }));
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/** Todas las facturas de Ágora de un business-day (incluidas 0/negativas) con sus líneas. */
export async function getFacturasAgoraDia(
  dia: string,
): Promise<{ ok: true; data: FacturaAgora[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const { data: tickets, error } = await supabase
      .from("pos_tickets")
      .select("id, numero, agora_serie, agora_numero, total, comensales, abierto_at")
      .eq("empresa_id", empresaId)
      .eq("origen", "agora")
      .gte("cerrado_at", `${dia}T00:00:00`)
      .lte("cerrado_at", `${dia}T23:59:59`)
      .order("agora_numero", { ascending: true });
    if (error) throw error;
    const ticketList = tickets ?? [];
    if (ticketList.length === 0) return { ok: true, data: [] };

    const ids = ticketList.map((t) => t.id as string);
    const lineasPorTicket = new Map<string, FacturaAgora["lineas"]>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data: lineas, error: e2 } = await supabase
        .from("pos_ticket_lineas")
        .select("ticket_id, nombre, cantidad, precio_unitario")
        .in("ticket_id", ids.slice(i, i + 300));
      if (e2) throw e2;
      for (const l of lineas ?? []) {
        const arr = lineasPorTicket.get(l.ticket_id as string) ?? [];
        const cantidad = toNum(l.cantidad);
        const precio = toNum(l.precio_unitario);
        arr.push({ nombre: String(l.nombre), cantidad, precioUnitario: precio, total: cantidad * precio });
        lineasPorTicket.set(l.ticket_id as string, arr);
      }
    }

    const data: FacturaAgora[] = ticketList.map((t) => ({
      id: t.id as string,
      numero: String(t.numero),
      serie: (t.agora_serie as string | null) ?? null,
      agoraNumero: (t.agora_numero as number | null) ?? null,
      total: toNum(t.total),
      comensales: Number(t.comensales) || 0,
      fecha: (t.abierto_at as string | null) ?? null,
      lineas: lineasPorTicket.get(t.id as string) ?? [],
    }));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
