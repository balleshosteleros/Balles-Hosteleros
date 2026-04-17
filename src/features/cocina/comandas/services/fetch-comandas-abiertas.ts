"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { rowToLineaCocina, type LineaCocinaRow } from "./row-mappers";
import type { ComandaAgrupada, TicketLineaConCocina } from "../types";

interface TicketJoinRow {
  id: string;
  numero: string;
  mesa_id: string | null;
  comensales: number;
  empleado_id: string | null;
  enviado_at: string | null;
}

interface MesaRow {
  id: string;
  numero: number | null;
  nombre: string | null;
}

/**
 * Carga inicial del board de cocina:
 *   - líneas cuyo ticket es de la empresa del usuario
 *   - ticket.enviado_at IS NOT NULL
 *   - estado_cocina <> 'SERVIDO' (ver gotcha) excepto las servidas hace <60s
 *   - abierto_at >= hoy (local Madrid aproximada a UTC 00:00)
 *
 * Devuelve agrupado por ticket/mesa ordenado por enviado_at asc.
 */
export async function fetchComandasAbiertas(): Promise<
  { ok: true; data: ComandaAgrupada[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const hace60s = new Date(Date.now() - 60_000).toISOString();

    // 1. Tickets enviados de hoy
    const { data: tickets, error: errT } = await supabase
      .from("pos_tickets")
      .select("id, numero, mesa_id, comensales, empleado_id, enviado_at, estado")
      .eq("empresa_id", empresaId)
      .gte("abierto_at", inicioHoy.toISOString())
      .not("enviado_at", "is", null)
      .in("estado", ["ABIERTO", "ENVIADO", "COBRADO"])
      .order("enviado_at", { ascending: true });

    if (errT) throw errT;
    const ticketRows = (tickets ?? []) as TicketJoinRow[];
    if (ticketRows.length === 0) return { ok: true, data: [] };

    const ticketIds = ticketRows.map((t) => t.id);

    // 2. Líneas de esos tickets que están activas en cocina
    //    (pendiente/preparando/listo + servido reciente para animación de salida)
    const { data: lineas, error: errL } = await supabase
      .from("pos_ticket_lineas")
      .select("*")
      .in("ticket_id", ticketIds)
      .not("enviada_at", "is", null)
      .or(`estado_cocina.neq.SERVIDO,servido_at.gte.${hace60s}`)
      .neq("estado_cocina", "CANCELADA");

    if (errL) throw errL;

    // 3. Mesas para resolver nombre
    const mesaIds = Array.from(
      new Set(ticketRows.map((t) => t.mesa_id).filter((v): v is string => !!v)),
    );
    const { data: mesas } = mesaIds.length
      ? await supabase.from("mesas").select("id, numero, nombre").in("id", mesaIds)
      : { data: [] as MesaRow[] };

    const mesaById = new Map<string, MesaRow>();
    for (const m of (mesas ?? []) as MesaRow[]) mesaById.set(m.id, m);

    // 4. Agrupar por ticket
    const lineasPorTicket = new Map<string, TicketLineaConCocina[]>();
    for (const l of (lineas ?? []) as LineaCocinaRow[]) {
      const linea = rowToLineaCocina(l);
      const bucket = lineasPorTicket.get(linea.ticketId) ?? [];
      bucket.push(linea);
      lineasPorTicket.set(linea.ticketId, bucket);
    }

    const comandas: ComandaAgrupada[] = [];
    for (const t of ticketRows) {
      const ls = lineasPorTicket.get(t.id) ?? [];
      if (ls.length === 0) continue;
      const mesa = t.mesa_id ? mesaById.get(t.mesa_id) : null;
      const mesaNombre = mesa
        ? mesa.nombre ?? `Mesa ${mesa.numero ?? "?"}`
        : "Barra";
      comandas.push({
        ticketId: t.id,
        numero: t.numero,
        mesaId: t.mesa_id,
        mesaNombre,
        comensales: t.comensales ?? 1,
        empleadoId: t.empleado_id,
        enviadoAt: t.enviado_at ?? new Date().toISOString(),
        lineas: ls.sort((a, b) =>
          a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
        ),
        total: ls.length,
        listos: ls.filter((l) => l.estadoCocina === "LISTO").length,
      });
    }

    return { ok: true, data: comandas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cocina][comandas] fetchComandasAbiertas:", msg);
    return { ok: false, error: msg };
  }
}
