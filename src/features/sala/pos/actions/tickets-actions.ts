"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Ticket, TicketLinea, TicketConLineas, TicketEstado } from "../types";
import { descontarStockPorTicket } from "../services/descontar-stock-por-ventas";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── MAPPERS snake → camel ────────────────────────────────────

interface TicketRow {
  id: string;
  empresa_id: string;
  sesion_caja_id: string | null;
  numero: string;
  mesa_id: string | null;
  comensales: number;
  empleado_id: string | null;
  estado: TicketEstado;
  subtotal: number | string;
  descuento_id: string | null;
  descuento_valor: number | string;
  iva_total: number | string;
  total: number | string;
  abierto_at: string;
  enviado_at: string | null;
  cerrado_at: string | null;
  anulado_at: string | null;
  anulado_motivo: string | null;
  stock_descontado: boolean;
  notas: string;
  created_at: string;
  updated_at: string;
}

function rowToTicket(r: TicketRow): Ticket {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    sesionCajaId: r.sesion_caja_id,
    numero: r.numero,
    mesaId: r.mesa_id,
    comensales: r.comensales,
    empleadoId: r.empleado_id,
    estado: r.estado,
    subtotal: Number(r.subtotal ?? 0),
    descuentoId: r.descuento_id,
    descuentoValor: Number(r.descuento_valor ?? 0),
    ivaTotal: Number(r.iva_total ?? 0),
    total: Number(r.total ?? 0),
    abiertoAt: r.abierto_at,
    enviadoAt: r.enviado_at,
    cerradoAt: r.cerrado_at,
    anuladoAt: r.anulado_at,
    anuladoMotivo: r.anulado_motivo,
    stockDescontado: !!r.stock_descontado,
    notas: r.notas ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface LineaRow {
  id: string;
  ticket_id: string;
  producto_id: string | null;
  nombre: string;
  cantidad: number | string;
  precio_unitario: number | string;
  iva_pct: number | string;
  descuento_pct: number | string;
  destino: "COCINA" | "BARRA" | "NINGUNO";
  enviada_at: string | null;
  nota_cocina: string;
  comensal_idx: number | null;
  created_at: string;
}

function rowToLinea(r: LineaRow): TicketLinea {
  return {
    id: r.id,
    ticketId: r.ticket_id,
    productoId: r.producto_id,
    nombre: r.nombre,
    cantidad: Number(r.cantidad ?? 0),
    precioUnitario: Number(r.precio_unitario ?? 0),
    ivaPct: Number(r.iva_pct ?? 10),
    descuentoPct: Number(r.descuento_pct ?? 0),
    destino: r.destino,
    enviadaAt: r.enviada_at,
    notaCocina: r.nota_cocina ?? "",
    comensalIdx: r.comensal_idx,
    createdAt: r.created_at,
  };
}

// ─── CREAR TICKET ─────────────────────────────────────────────

export async function crearTicket(input: {
  mesaId?: string | null;
  comensales?: number;
  sesionCajaId: string;
}): Promise<{ ok: true; data: Ticket } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId, userId: profileId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Generar correlativo via función SQL
    const { data: numeroRow, error: errNum } = await supabase.rpc("pos_next_ticket_numero", {
      p_empresa_id: empresaId,
    });
    if (errNum) throw errNum;
    const numero = (numeroRow as unknown as string) ?? `${Date.now()}`;

    const { data, error } = await supabase
      .from("pos_tickets")
      .insert({
        empresa_id: empresaId,
        sesion_caja_id: input.sesionCajaId,
        numero,
        mesa_id: input.mesaId ?? null,
        comensales: input.comensales ?? 1,
        empleado_id: profileId,
      })
      .select()
      .single();

    if (error) throw error;

    // Marcar mesa como OCUPADA (si aplica)
    if (input.mesaId) {
      await supabase
        .from("mesas")
        .update({ estado: "Ocupada" })
        .eq("id", input.mesaId)
        .eq("empresa_id", empresaId);
    }

    return { ok: true, data: rowToTicket(data as TicketRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] crearTicket:", msg);
    return { ok: false, error: msg };
  }
}

// ─── AÑADIR LÍNEA ─────────────────────────────────────────────

export async function addLineaTicket(input: {
  ticketId: string;
  productoId: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  ivaPct: number;
  destino?: "COCINA" | "BARRA" | "NINGUNO";
  notaCocina?: string;
  comensalIdx?: number | null;
}): Promise<{ ok: true; data: TicketLinea } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("pos_ticket_lineas")
      .insert({
        ticket_id: input.ticketId,
        producto_id: input.productoId,
        nombre: input.nombre,
        cantidad: input.cantidad,
        precio_unitario: input.precioUnitario,
        iva_pct: input.ivaPct,
        destino: input.destino ?? "COCINA",
        nota_cocina: input.notaCocina ?? "",
        comensal_idx: input.comensalIdx ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    await recalcTotalesTicket(input.ticketId);
    return { ok: true, data: rowToLinea(data as LineaRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] addLineaTicket:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateLineaTicket(input: {
  lineaId: string;
  cantidad?: number;
  precioUnitario?: number;
  descuentoPct?: number;
  notaCocina?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();

    const patch: Record<string, unknown> = {};
    if (input.cantidad !== undefined) patch.cantidad = input.cantidad;
    if (input.precioUnitario !== undefined) patch.precio_unitario = input.precioUnitario;
    if (input.descuentoPct !== undefined) patch.descuento_pct = input.descuentoPct;
    if (input.notaCocina !== undefined) patch.nota_cocina = input.notaCocina;

    const { data: linea, error: errL } = await supabase
      .from("pos_ticket_lineas")
      .update(patch)
      .eq("id", input.lineaId)
      .select("ticket_id")
      .single();
    if (errL) throw errL;

    await recalcTotalesTicket((linea as { ticket_id: string }).ticket_id);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] updateLineaTicket:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteLineaTicket(
  lineaId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data: linea, error: errL } = await supabase
      .from("pos_ticket_lineas")
      .select("ticket_id, enviada_at")
      .eq("id", lineaId)
      .single();
    if (errL) throw errL;
    if ((linea as { enviada_at: string | null }).enviada_at) {
      return { ok: false, error: "No se pueden borrar líneas ya enviadas a cocina." };
    }

    const { error } = await supabase.from("pos_ticket_lineas").delete().eq("id", lineaId);
    if (error) throw error;

    await recalcTotalesTicket((linea as { ticket_id: string }).ticket_id);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] deleteLineaTicket:", msg);
    return { ok: false, error: msg };
  }
}

// ─── GET TICKET COMPLETO ──────────────────────────────────────

export async function getTicket(
  ticketId: string
): Promise<{ ok: true; data: TicketConLineas } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data: tData, error: errT } = await supabase
      .from("pos_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();
    if (errT) throw errT;

    const { data: lineas, error: errL } = await supabase
      .from("pos_ticket_lineas")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (errL) throw errL;

    const { data: pagos } = await supabase.from("pos_pagos").select("*").eq("ticket_id", ticketId);

    const ticket = rowToTicket(tData as TicketRow);
    return {
      ok: true,
      data: {
        ...ticket,
        lineas: (lineas as LineaRow[]).map(rowToLinea),
        pagos: (pagos ?? []).map((p) => ({
          id: (p as { id: string }).id,
          ticketId: (p as { ticket_id: string }).ticket_id,
          medio: (p as { medio: Ticket["estado"] }).medio as unknown as
            | "EFECTIVO"
            | "TARJETA"
            | "BIZUM"
            | "VALE"
            | "OTROS",
          importe: Number((p as { importe: number | string }).importe ?? 0),
          referencia: (p as { referencia: string | null }).referencia,
          creadoAt: (p as { creado_at: string }).creado_at,
        })),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] getTicket:", msg);
    return { ok: false, error: msg };
  }
}

// ─── LISTAR TICKETS ───────────────────────────────────────────

export async function listTicketsHoy(): Promise<
  { ok: true; data: Ticket[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("pos_tickets")
      .select("*")
      .eq("empresa_id", empresaId)
      .gte("abierto_at", hoy.toISOString())
      .order("abierto_at", { ascending: false });

    if (error) throw error;
    return { ok: true, data: (data as TicketRow[]).map(rowToTicket) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] listTicketsHoy:", msg);
    return { ok: false, error: msg };
  }
}

// ─── RECALCULAR TOTALES ───────────────────────────────────────

async function recalcTotalesTicket(ticketId: string): Promise<void> {
  try {
    const { supabase } = await getAppContext();
    const { data: lineas } = await supabase
      .from("pos_ticket_lineas")
      .select("cantidad, precio_unitario, iva_pct, descuento_pct")
      .eq("ticket_id", ticketId);

    let baseImp = 0;
    let iva = 0;
    for (const l of lineas ?? []) {
      const cant = Number((l as { cantidad: number | string }).cantidad ?? 0);
      const pu = Number((l as { precio_unitario: number | string }).precio_unitario ?? 0);
      const ivaPct = Number((l as { iva_pct: number | string }).iva_pct ?? 10);
      const descPct = Number((l as { descuento_pct: number | string }).descuento_pct ?? 0);
      const neto = cant * pu * (1 - descPct / 100);
      const base = neto / (1 + ivaPct / 100);
      baseImp += base;
      iva += neto - base;
    }
    const total = baseImp + iva;
    const r2 = (n: number) => Math.round(n * 100) / 100;

    await supabase
      .from("pos_tickets")
      .update({ subtotal: r2(baseImp), iva_total: r2(iva), total: r2(total) })
      .eq("id", ticketId);
  } catch (err) {
    console.error("[pos][tickets] recalcTotalesTicket:", err);
  }
}

// ─── CERRAR TICKET (cobrado) ──────────────────────────────────

/**
 * Cierra el ticket: marca COBRADO, libera mesa, descuenta stock.
 * El ModalCobro de F10 guarda los pagos antes de llamar aquí.
 */
export async function cerrarTicket(
  ticketId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Validar suma pagos == total
    const { data: ticket } = await supabase
      .from("pos_tickets")
      .select("total, mesa_id, estado")
      .eq("id", ticketId)
      .single();
    if (!ticket) return { ok: false, error: "Ticket no encontrado" };
    if ((ticket as { estado: string }).estado !== "ABIERTO" && (ticket as { estado: string }).estado !== "ENVIADO") {
      return { ok: false, error: "Ticket ya cerrado o anulado." };
    }

    const { data: pagos } = await supabase.from("pos_pagos").select("importe").eq("ticket_id", ticketId);
    const sumaPagos = (pagos ?? []).reduce(
      (acc, p) => acc + Number((p as { importe: number | string }).importe ?? 0),
      0
    );
    const total = Number((ticket as { total: number | string }).total ?? 0);
    if (Math.abs(sumaPagos - total) > 0.01) {
      return { ok: false, error: `Suma de pagos (${sumaPagos.toFixed(2)}€) ≠ total (${total.toFixed(2)}€).` };
    }

    // Marcar cobrado
    const { error: errU } = await supabase
      .from("pos_tickets")
      .update({ estado: "COBRADO", cerrado_at: new Date().toISOString() })
      .eq("id", ticketId);
    if (errU) throw errU;

    // Liberar mesa
    const mesaId = (ticket as { mesa_id: string | null }).mesa_id;
    if (mesaId) {
      await supabase.from("mesas").update({ estado: "Libre" }).eq("id", mesaId);
    }

    // Descontar stock sólo si la empresa lo tiene activado
    // (flag pos_descuenta_stock en empresa_config o empresas)
    const { data: emp } = await supabase
      .from("empresas")
      .select("pos_descuenta_stock")
      .eq("id", empresaId)
      .maybeSingle();
    const flagOn = (emp as { pos_descuenta_stock: boolean | null } | null)?.pos_descuenta_stock === true;

    if (flagOn) {
      const svc = serviceClient();
      await descontarStockPorTicket(svc, ticketId, 1);
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] cerrarTicket:", msg);
    return { ok: false, error: msg };
  }
}

// ─── ANULAR TICKET ────────────────────────────────────────────

export async function anularTicket(input: {
  ticketId: string;
  motivo: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: ticket } = await supabase
      .from("pos_tickets")
      .select("estado, mesa_id, stock_descontado")
      .eq("id", input.ticketId)
      .single();
    if (!ticket) return { ok: false, error: "Ticket no encontrado" };

    // Si se había descontado stock, revertir
    if ((ticket as { stock_descontado: boolean }).stock_descontado) {
      const svc = serviceClient();
      await descontarStockPorTicket(svc, input.ticketId, -1);
    }

    const { error: errU } = await supabase
      .from("pos_tickets")
      .update({
        estado: "ANULADO",
        anulado_at: new Date().toISOString(),
        anulado_motivo: input.motivo,
      })
      .eq("id", input.ticketId);
    if (errU) throw errU;

    const mesaId = (ticket as { mesa_id: string | null }).mesa_id;
    if (mesaId) {
      await supabase.from("mesas").update({ estado: "Libre" }).eq("id", mesaId);
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] anularTicket:", msg);
    return { ok: false, error: msg };
  }
}

// ─── APLICAR DESCUENTO DE CABECERA ────────────────────────────

export async function aplicarDescuentoTicket(input: {
  ticketId: string;
  descuentoId: string | null;
  valor: number; // euros descontados ya calculado por el cliente
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("pos_tickets")
      .update({
        descuento_id: input.descuentoId,
        descuento_valor: input.valor,
      })
      .eq("id", input.ticketId);
    if (error) throw error;
    await recalcTotalesTicket(input.ticketId);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] aplicarDescuentoTicket:", msg);
    return { ok: false, error: msg };
  }
}

// ─── ENVIAR A COCINA (marca enviadas + cambia estado) ─────────

export async function enviarACocina(
  ticketId: string
): Promise<{ ok: true; enviadas: number } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();
    const now = new Date().toISOString();

    const { data: lineasPend, error: errL } = await supabase
      .from("pos_ticket_lineas")
      .select("id")
      .eq("ticket_id", ticketId)
      .is("enviada_at", null);
    if (errL) throw errL;

    const ids = (lineasPend ?? []).map((l) => (l as { id: string }).id);
    if (ids.length === 0) return { ok: true, enviadas: 0 };

    const { error: errU } = await supabase
      .from("pos_ticket_lineas")
      .update({ enviada_at: now })
      .in("id", ids);
    if (errU) throw errU;

    await supabase
      .from("pos_tickets")
      .update({ estado: "ENVIADO", enviado_at: now })
      .eq("id", ticketId);

    return { ok: true, enviadas: ids.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][tickets] enviarACocina:", msg);
    return { ok: false, error: msg };
  }
}
