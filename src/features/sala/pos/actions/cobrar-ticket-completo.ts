"use server";

/**
 * Cobro "todo en uno" desde la UI cliente.
 * Flujo:
 *   1. Asegura sesión de caja abierta (o crea con fondo 0 como fallback).
 *   2. Crea el ticket POS.
 *   3. Inserta todas las líneas.
 *   4. Aplica descuento (si hay).
 *   5. Registra pagos.
 *   6. Cierra el ticket (libera mesa, descuenta stock si flag).
 *
 * Devuelve el ticket_id para reimpresión.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { descontarStockPorTicket } from "../services/descontar-stock-por-ventas";
import type { LineaDestino, PagoMedio } from "../types";

interface LineaInput {
  productoId: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  ivaPct: number;
  descuentoPct?: number;
  destino?: LineaDestino;
  notaCocina?: string;
}

interface CobroInput {
  mesaId: string | null;
  comensales: number;
  lineas: LineaInput[];
  descuento?: { tipo: "PCT" | "FIJO"; valor: number } | null;
  pagos: { medio: PagoMedio; importe: number; referencia?: string }[];
  notas?: string;
  /**
   * Si el ticket ya fue creado previamente (por envío a cocina PRP-027),
   * se reutiliza: se añaden sólo líneas aún no persistidas, se registran
   * pagos y se cierra. Sin duplicar correlativo.
   */
  ticketIdExistente?: string | null;
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function cobrarTicketCompleto(
  input: CobroInput
): Promise<{ ok: true; ticketId: string; numero: string } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId, userId: profileId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // ─── 1. Asegurar sesión de caja abierta ───
    const { data: sesionRow } = await supabase
      .from("pos_sesiones_caja")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("estado", "ABIERTA")
      .order("abierta_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let sesionId = (sesionRow as { id: string } | null)?.id;

    if (!sesionId) {
      const { data: nuevaSesion, error: errS } = await supabase
        .from("pos_sesiones_caja")
        .insert({
          empresa_id: empresaId,
          empleado_id: profileId,
          fondo_inicial: 0,
          notas: "Apertura automática desde primer cobro",
        })
        .select("id")
        .single();
      if (errS) throw errS;
      sesionId = (nuevaSesion as { id: string }).id;
    }

    // ─── 2. Correlativo + ticket (reusar si ya existe) ───
    let ticketId: string;
    let numero: string;

    if (input.ticketIdExistente) {
      // Reutilizar ticket ya creado (envío a cocina previo).
      const { data: existente, error: errE } = await supabase
        .from("pos_tickets")
        .select("id, numero, estado")
        .eq("id", input.ticketIdExistente)
        .single();
      if (errE) throw errE;

      const est = (existente as { estado: string }).estado;
      if (est === "COBRADO" || est === "ANULADO") {
        return { ok: false, error: "Ticket ya cerrado o anulado." };
      }
      ticketId = (existente as { id: string }).id;
      numero = (existente as { numero: string }).numero;

      // Insertar sólo líneas nuevas (las que no tienen ticket_id en BD).
      // Se pasa input.lineas tal cual cuando viene de `cobro-completo` sin persistencia previa.
      // Si ya se envió a cocina, las líneas ya están en BD; el cliente puede mandar arr vacío.
      if (input.lineas.length > 0) {
        const { error: errL } = await supabase.from("pos_ticket_lineas").insert(
          input.lineas.map((l) => ({
            ticket_id: ticketId,
            producto_id: l.productoId,
            nombre: l.nombre,
            cantidad: l.cantidad,
            precio_unitario: l.precioUnitario,
            iva_pct: l.ivaPct,
            descuento_pct: l.descuentoPct ?? 0,
            destino: l.destino ?? "COCINA",
            nota_cocina: l.notaCocina ?? "",
            enviada_at: new Date().toISOString(),
          }))
        );
        if (errL) throw errL;
      }
    } else {
      const { data: num, error: errNum } = await supabase.rpc(
        "pos_next_ticket_numero",
        { p_empresa_id: empresaId }
      );
      if (errNum) throw errNum;
      numero = (num as unknown as string) ?? `${Date.now()}`;

      const { data: ticketRow, error: errT } = await supabase
        .from("pos_tickets")
        .insert({
          empresa_id: empresaId,
          sesion_caja_id: sesionId,
          numero,
          mesa_id: input.mesaId,
          comensales: input.comensales,
          empleado_id: profileId,
          notas: input.notas ?? "",
        })
        .select("id")
        .single();
      if (errT) throw errT;

      ticketId = (ticketRow as { id: string }).id;

      if (input.lineas.length > 0) {
        const { error: errL } = await supabase.from("pos_ticket_lineas").insert(
          input.lineas.map((l) => ({
            ticket_id: ticketId,
            producto_id: l.productoId,
            nombre: l.nombre,
            cantidad: l.cantidad,
            precio_unitario: l.precioUnitario,
            iva_pct: l.ivaPct,
            descuento_pct: l.descuentoPct ?? 0,
            destino: l.destino ?? "COCINA",
            nota_cocina: l.notaCocina ?? "",
            enviada_at: new Date().toISOString(),
          }))
        );
        if (errL) throw errL;
      }
    }

    // ─── 4. Descuento aplicado ───
    let descuentoValor = 0;
    if (input.descuento && input.descuento.valor > 0) {
      // El cálculo exacto en € lo hace el cliente (calcularTotales). Aquí sólo guardamos.
      // Recalculamos totales del ticket leyendo las líneas.
      const { data: lineasDB } = await supabase
        .from("pos_ticket_lineas")
        .select("cantidad, precio_unitario, iva_pct, descuento_pct")
        .eq("ticket_id", ticketId);

      let totalBruto = 0;
      for (const l of lineasDB ?? []) {
        const c = Number((l as { cantidad: number | string }).cantidad ?? 0);
        const pu = Number((l as { precio_unitario: number | string }).precio_unitario ?? 0);
        const dp = Number((l as { descuento_pct: number | string }).descuento_pct ?? 0);
        totalBruto += c * pu * (1 - dp / 100);
      }
      descuentoValor =
        input.descuento.tipo === "PCT"
          ? Math.round(totalBruto * input.descuento.valor) / 100
          : Math.min(totalBruto, input.descuento.valor);

      await supabase
        .from("pos_tickets")
        .update({ descuento_valor: descuentoValor })
        .eq("id", ticketId);
    }

    // ─── 5. Recalcular totales ───
    const { data: lineasFin } = await supabase
      .from("pos_ticket_lineas")
      .select("cantidad, precio_unitario, iva_pct, descuento_pct")
      .eq("ticket_id", ticketId);

    let baseImp = 0;
    let ivaTotal = 0;
    for (const l of lineasFin ?? []) {
      const c = Number((l as { cantidad: number | string }).cantidad ?? 0);
      const pu = Number((l as { precio_unitario: number | string }).precio_unitario ?? 0);
      const ivaPct = Number((l as { iva_pct: number | string }).iva_pct ?? 10);
      const dp = Number((l as { descuento_pct: number | string }).descuento_pct ?? 0);
      const neto = c * pu * (1 - dp / 100);
      const base = neto / (1 + ivaPct / 100);
      baseImp += base;
      ivaTotal += neto - base;
    }
    let total = baseImp + ivaTotal - descuentoValor;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    baseImp = r2(baseImp);
    ivaTotal = r2(ivaTotal);
    total = r2(total);

    await supabase
      .from("pos_tickets")
      .update({ subtotal: baseImp, iva_total: ivaTotal, total })
      .eq("id", ticketId);

    // ─── 6. Validar suma de pagos y registrar ───
    const sumaPagos = input.pagos.reduce((a, p) => a + p.importe, 0);
    if (Math.abs(sumaPagos - total) > 0.01) {
      // Revertir: eliminar ticket incompleto
      await supabase.from("pos_tickets").delete().eq("id", ticketId);
      return {
        ok: false,
        error: `Suma de pagos (${sumaPagos.toFixed(2)}€) no cuadra con total (${total.toFixed(2)}€).`,
      };
    }

    const { error: errP } = await supabase.from("pos_pagos").insert(
      input.pagos.map((p) => ({
        ticket_id: ticketId,
        medio: p.medio,
        importe: p.importe,
        referencia: p.referencia ?? null,
      }))
    );
    if (errP) throw errP;

    // ─── 7. Cerrar ticket + liberar mesa ───
    await supabase
      .from("pos_tickets")
      .update({
        estado: "COBRADO",
        enviado_at: new Date().toISOString(),
        cerrado_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (input.mesaId) {
      await supabase.from("mesas").update({ estado: "Libre" }).eq("id", input.mesaId);
    }

    // ─── 8. Descontar stock (si flag empresa) ───
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

    return {
      ok: true,
      ticketId,
      numero,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][cobrar] cobrarTicketCompleto:", msg);
    return { ok: false, error: msg };
  }
}
