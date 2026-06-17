"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ingerirVentasAgoraDia,
  EMPRESA_WORKPLACE,
} from "@/features/logistica/services/agora-ventas-ingesta";

// "Tripas" de la migración de Ágora: estado, log de sincronizaciones y facturas crudas. PRP-057.

export type MigracionLog = {
  sync_at: string;
  status: string;
  total: number;
  resumen: string;
};

export type MigracionFacturaLinea = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  formato: string | null;
  ratio: number;
  conProducto: boolean;
};

export type MigracionFactura = {
  id: string;
  numero: string;
  serie: string | null;
  agoraNumero: number | null;
  fecha: string | null;
  comensales: number;
  total: number;
  lineas: MigracionFacturaLinea[];
};

export type MigracionEstado = {
  ok: true;
  empresaId: string;
  envsConfigurados: boolean;
  tickets: number;
  primerDia: string | null;
  ultimoDia: string | null;
  log: MigracionLog[];
  facturas: MigracionFactura[];
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function getMigracionAgoraEstado(): Promise<
  MigracionEstado | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const { count: tickets } = await supabase
      .from("pos_tickets")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("origen", "agora");

    const { data: rango } = await supabase
      .from("pos_tickets")
      .select("cerrado_at")
      .eq("empresa_id", empresaId)
      .eq("origen", "agora")
      .order("cerrado_at", { ascending: true })
      .limit(1);
    const { data: rangoMax } = await supabase
      .from("pos_tickets")
      .select("cerrado_at")
      .eq("empresa_id", empresaId)
      .eq("origen", "agora")
      .order("cerrado_at", { ascending: false })
      .limit(1);

    const { data: logRows } = await supabase
      .from("agora_sync_log")
      .select("sync_at, status, total_records, sales_data, error_message")
      .eq("empresa_id", empresaId)
      .order("sync_at", { ascending: false })
      .limit(15);

    const log: MigracionLog[] = (logRows ?? []).map((r) => {
      const sd = (r.sales_data ?? {}) as Record<string, unknown>;
      const resumen =
        r.status === "error"
          ? String(r.error_message ?? "error")
          : `${sd.dia ?? ""} · ${sd.facturas ?? 0} fact. · ${sd.lineas ?? 0} líneas` +
            (sd.lineas_sin_producto ? ` · ${sd.lineas_sin_producto} sin producto` : "");
      return {
        sync_at: String(r.sync_at),
        status: String(r.status),
        total: Number(r.total_records ?? 0),
        resumen,
      };
    });

    // Facturas crudas recientes con sus líneas (incluye formato/ratio).
    const { data: tks } = await supabase
      .from("pos_tickets")
      .select("id, numero, agora_serie, agora_numero, cerrado_at, comensales, total")
      .eq("empresa_id", empresaId)
      .eq("origen", "agora")
      .order("cerrado_at", { ascending: false })
      .limit(40);
    const ticketList = tks ?? [];
    const ids = ticketList.map((t) => t.id as string);
    const lineasByTicket = new Map<string, MigracionFacturaLinea[]>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: lns } = await supabase
        .from("pos_ticket_lineas")
        .select("ticket_id, nombre, cantidad, precio_unitario, sale_format_nombre, sale_format_ratio, producto_id")
        .in("ticket_id", ids.slice(i, i + 200));
      for (const l of lns ?? []) {
        const arr = lineasByTicket.get(l.ticket_id as string) ?? [];
        arr.push({
          nombre: String(l.nombre ?? ""),
          cantidad: num(l.cantidad),
          precioUnitario: num(l.precio_unitario),
          formato: (l.sale_format_nombre as string | null) ?? null,
          ratio: num(l.sale_format_ratio) || 1,
          conProducto: l.producto_id != null,
        });
        lineasByTicket.set(l.ticket_id as string, arr);
      }
    }

    const facturas: MigracionFactura[] = ticketList.map((t) => ({
      id: t.id as string,
      numero: String(t.numero),
      serie: (t.agora_serie as string | null) ?? null,
      agoraNumero: (t.agora_numero as number | null) ?? null,
      fecha: (t.cerrado_at as string | null) ?? null,
      comensales: Number(t.comensales ?? 0),
      total: num(t.total),
      lineas: lineasByTicket.get(t.id as string) ?? [],
    }));

    return {
      ok: true,
      empresaId,
      envsConfigurados: Boolean(process.env.AGORA_API_URL && process.env.AGORA_API_TOKEN),
      tickets: tickets ?? 0,
      primerDia: (rango?.[0]?.cerrado_at as string | null) ?? null,
      ultimoDia: (rangoMax?.[0]?.cerrado_at as string | null) ?? null,
      log,
      facturas,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/** Trae a demanda las ventas de Ágora de un business-day para la empresa activa. */
export async function sincronizarDiaAgora(
  dia: string,
): Promise<{ ok: true; facturas: number; lineas: number; sinProducto: number } | { ok: false; error: string }> {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };
    if (!EMPRESA_WORKPLACE[empresaId]) {
      return { ok: false, error: "La empresa activa no tiene almacén de Ágora asociado." };
    }
    if (!process.env.AGORA_API_URL || !process.env.AGORA_API_TOKEN) {
      return { ok: false, error: "Faltan las claves de Ágora (AGORA_API_URL / AGORA_API_TOKEN)." };
    }
    const admin = createAdminClient();
    const r = await ingerirVentasAgoraDia(admin, empresaId, dia);
    await admin.from("agora_sync_log").insert({
      empresa_id: empresaId,
      status: "ok",
      total_records: r.facturas,
      ok_records: r.facturas,
      error_records: 0,
      sales_data: { dia, facturas: r.facturas, lineas: r.lineas, lineas_sin_producto: r.sinProducto, manual: true },
    });
    return { ok: true, facturas: r.facturas, lineas: r.lineas, sinProducto: r.sinProducto };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
