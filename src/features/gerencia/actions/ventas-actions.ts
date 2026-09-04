"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type {
  VentasDashboard,
  VentaDia,
  VentaProducto,
  VentaCategoria,
  MenuClass,
} from "../types/ventas";

const POPULARIDAD_THRESHOLD = 0.7; // regla 70% del menú medio (estándar Menu Engineering)

function emptyDashboard(fromIso: string, toIso: string): VentasDashboard {
  return {
    rango: { from: fromIso, to: toIso },
    resumen: {
      ingresos: 0,
      tickets: 0,
      comensales: 0,
      ticketMedio: 0,
      comensalMedio: 0,
      costeTotal: 0,
      margenTotal: 0,
      margenPct: 0,
    },
    porDia: [],
    porProducto: [],
    porCategoria: [],
  };
}

function enumerateDays(fromIso: string, toIso: string): string[] {
  const arr: string[] = [];
  const cursor = new Date(`${fromIso}T12:00:00`);
  const end = new Date(`${toIso}T12:00:00`);
  while (cursor <= end) {
    arr.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return arr;
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function getVentasDashboard(
  fromIso: string,
  toIso: string,
): Promise<{ ok: true; data: VentasDashboard } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: emptyDashboard(fromIso, toIso) };

    const fromTs = `${fromIso}T00:00:00`;
    const toTs = `${toIso}T23:59:59`;

    const { data: ticketsRaw, error: ticketErr } = await supabase
      .from("pos_tickets")
      .select("id, total, comensales, cerrado_at")
      .eq("empresa_id", empresaId)
      .eq("estado", "COBRADO")
      .gte("cerrado_at", fromTs)
      .lte("cerrado_at", toTs);
    if (ticketErr) throw ticketErr;

    const tickets = ticketsRaw ?? [];
    if (tickets.length === 0) return { ok: true, data: emptyDashboard(fromIso, toIso) };

    const ticketIds = tickets.map((t) => t.id as string);

    const { data: lineasRaw, error: lineasErr } = await supabase
      .from("pos_ticket_lineas")
      .select("ticket_id, producto_id, nombre, cantidad, precio_unitario")
      .in("ticket_id", ticketIds);
    if (lineasErr) throw lineasErr;

    const lineas = lineasRaw ?? [];

    const productoIds = Array.from(
      new Set(lineas.map((l) => l.producto_id).filter((x): x is string => Boolean(x))),
    );
    const productosMap = new Map<string, { categoria: string; coste: number }>();
    if (productoIds.length > 0) {
      const { data: prods, error: prodErr } = await supabase
        .from("productos")
        .select("id, categoria, coste")
        .in("id", productoIds);
      if (prodErr) throw prodErr;
      for (const p of prods ?? []) {
        productosMap.set(p.id as string, {
          categoria: ((p as { categoria: string | null }).categoria) ?? "Sin categoría",
          coste: toNum((p as { coste: unknown }).coste),
        });
      }
    }

    // ─── Agregación por día ────────────────────────────────────
    const porDiaMap = new Map<string, VentaDia>();
    for (const t of tickets) {
      const cerrado = t.cerrado_at as string | null;
      if (!cerrado) continue;
      const fecha = String(cerrado).slice(0, 10);
      const cur =
        porDiaMap.get(fecha) ?? { fecha, ingresos: 0, tickets: 0, comensales: 0, ticketMedio: 0 };
      cur.ingresos += toNum(t.total);
      cur.tickets += 1;
      cur.comensales += toNum(t.comensales);
      porDiaMap.set(fecha, cur);
    }
    const porDia: VentaDia[] = enumerateDays(fromIso, toIso).map((f) => {
      const d = porDiaMap.get(f) ?? { fecha: f, ingresos: 0, tickets: 0, comensales: 0, ticketMedio: 0 };
      return { ...d, ticketMedio: d.tickets > 0 ? d.ingresos / d.tickets : 0 };
    });

    // ─── Agregación por producto ───────────────────────────────
    type ProdAgg = {
      productoId: string | null;
      nombre: string;
      categoria: string;
      cantidad: number;
      ingresos: number;
      coste: number;
    };
    const prodMap = new Map<string, ProdAgg>();
    for (const l of lineas) {
      const pid = (l.producto_id as string | null) ?? null;
      const key = pid ?? `__nombre__::${(l.nombre as string) ?? "Sin nombre"}`;
      const meta = pid ? productosMap.get(pid) : undefined;
      const cur =
        prodMap.get(key) ??
        ({
          productoId: pid,
          nombre: (l.nombre as string) ?? "Sin nombre",
          categoria: meta?.categoria ?? "Sin categoría",
          cantidad: 0,
          ingresos: 0,
          coste: 0,
        } as ProdAgg);
      const qty = toNum(l.cantidad);
      const pu = toNum(l.precio_unitario);
      cur.cantidad += qty;
      cur.ingresos += qty * pu;
      cur.coste += qty * (meta?.coste ?? 0);
      prodMap.set(key, cur);
    }

    const productosAgg = [...prodMap.values()];
    const totalUnidades = productosAgg.reduce((s, p) => s + p.cantidad, 0);
    const cantidadMediaProducto =
      productosAgg.length > 0 ? totalUnidades / productosAgg.length : 0;
    const popThreshold = cantidadMediaProducto * POPULARIDAD_THRESHOLD;
    const margenes = productosAgg.map((p) =>
      p.cantidad > 0 ? (p.ingresos - p.coste) / p.cantidad : 0,
    );
    const margenMedio =
      margenes.length > 0 ? margenes.reduce((s, x) => s + x, 0) / margenes.length : 0;

    const porProducto: VentaProducto[] = productosAgg
      .map((p) => {
        const margenUnitario = p.cantidad > 0 ? (p.ingresos - p.coste) / p.cantidad : 0;
        const margenTotal = p.ingresos - p.coste;
        const margenPct = p.ingresos > 0 ? margenTotal / p.ingresos : 0;
        const popularidadPct = totalUnidades > 0 ? p.cantidad / totalUnidades : 0;
        const altaPop = p.cantidad >= popThreshold && popThreshold > 0;
        const altaMargen = margenUnitario >= margenMedio && margenUnitario > 0;
        const clasificacion: MenuClass =
          altaPop && altaMargen
            ? "ESTRELLA"
            : altaPop && !altaMargen
            ? "CABALLO"
            : !altaPop && altaMargen
            ? "ENIGMA"
            : "PERRO";
        return {
          productoId: p.productoId,
          nombre: p.nombre,
          categoria: p.categoria,
          cantidad: p.cantidad,
          ingresos: p.ingresos,
          precioMedio: p.cantidad > 0 ? p.ingresos / p.cantidad : 0,
          costeUnitario: p.cantidad > 0 ? p.coste / p.cantidad : 0,
          margenUnitario,
          margenTotal,
          margenPct,
          popularidadPct,
          clasificacion,
        };
      })
      .sort((a, b) => b.ingresos - a.ingresos);

    // ─── Agregación por categoría ──────────────────────────────
    const ingresosLineas = productosAgg.reduce((s, p) => s + p.ingresos, 0);
    const catMap = new Map<string, { cantidad: number; ingresos: number }>();
    for (const p of productosAgg) {
      const c = catMap.get(p.categoria) ?? { cantidad: 0, ingresos: 0 };
      c.cantidad += p.cantidad;
      c.ingresos += p.ingresos;
      catMap.set(p.categoria, c);
    }
    const porCategoria: VentaCategoria[] = [...catMap.entries()]
      .map(([categoria, v]) => ({
        categoria,
        cantidad: v.cantidad,
        ingresos: v.ingresos,
        pct: ingresosLineas > 0 ? v.ingresos / ingresosLineas : 0,
      }))
      .sort((a, b) => b.ingresos - a.ingresos);

    // ─── Resumen ───────────────────────────────────────────────
    const ticketsTotal = tickets.length;
    const comensalesTotal = tickets.reduce((s, t) => s + toNum(t.comensales), 0);
    const ingresosTotal = tickets.reduce((s, t) => s + toNum(t.total), 0);
    const costeTotal = productosAgg.reduce((s, p) => s + p.coste, 0);
    const margenTotal = ingresosTotal - costeTotal;

    return {
      ok: true,
      data: {
        rango: { from: fromIso, to: toIso },
        resumen: {
          ingresos: ingresosTotal,
          tickets: ticketsTotal,
          comensales: comensalesTotal,
          ticketMedio: ticketsTotal > 0 ? ingresosTotal / ticketsTotal : 0,
          comensalMedio: comensalesTotal > 0 ? ingresosTotal / comensalesTotal : 0,
          costeTotal,
          margenTotal,
          margenPct: ingresosTotal > 0 ? margenTotal / ingresosTotal : 0,
        },
        porDia,
        porProducto,
        porCategoria,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[ventas] getVentasDashboard:", msg);
    return { ok: false, error: msg };
  }
}
