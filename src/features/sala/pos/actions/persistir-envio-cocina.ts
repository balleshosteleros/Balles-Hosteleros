"use server";

/**
 * Persiste el "Enviar a cocina" del POS:
 *   - Si no hay ticketId: crea ticket + líneas con enviada_at, estado ENVIADO.
 *   - Si ya hay ticketId: inserta sólo las líneas nuevas y marca enviadas.
 * Devuelve ticketId y un mapa localId → serverId para sincronizar el reducer cliente.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import type { LineaDestino } from "../types";

interface LineaNueva {
  localId: string;
  productoId: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  ivaPct: number;
  descuentoPct: number;
  destino: LineaDestino;
  notaCocina: string;
}

interface Input {
  ticketId: string | null;
  mesaId: string | null;
  comensales: number;
  lineasNuevas: LineaNueva[];
}

type Output =
  | {
      ok: true;
      ticketId: string;
      numero: string;
      enviadaAt: string;
      lineaIdMap: Record<string, string>; // localId → serverId
    }
  | { ok: false; error: string };

export async function persistirEnvioACocina(input: Input): Promise<Output> {
  try {
    const { supabase, empresaId, userId: profileId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const now = new Date().toISOString();
    let ticketId = input.ticketId;
    let numero = "";

    // ─── 1. Crear ticket si no existe ───
    if (!ticketId) {
      // Asegurar sesión de caja abierta (o abrir una con fondo 0)
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
        const { data: nueva, error: errS } = await supabase
          .from("pos_sesiones_caja")
          .insert({
            empresa_id: empresaId,
            empleado_id: profileId,
            fondo_inicial: 0,
            notas: "Apertura automática desde envío a cocina",
          })
          .select("id")
          .single();
        if (errS) throw errS;
        sesionId = (nueva as { id: string }).id;
      }

      const { data: num, error: errNum } = await supabase.rpc("pos_next_ticket_numero", {
        p_empresa_id: empresaId,
      });
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
        })
        .select("id, numero")
        .single();
      if (errT) throw errT;

      ticketId = (ticketRow as { id: string }).id;
      numero = (ticketRow as { numero: string }).numero;

      // Marcar mesa ocupada
      if (input.mesaId) {
        await supabase
          .from("mesas")
          .update({ estado: "Ocupada" })
          .eq("id", input.mesaId)
          .eq("empresa_id", empresaId);
      }
    } else {
      // Recuperar numero para el retorno
      const { data: existente } = await supabase
        .from("pos_tickets")
        .select("numero")
        .eq("id", ticketId)
        .maybeSingle();
      numero = (existente as { numero: string } | null)?.numero ?? "";
    }

    // ─── 2. Insertar líneas nuevas con enviada_at ───
    const lineaIdMap: Record<string, string> = {};
    if (input.lineasNuevas.length > 0) {
      const payload = input.lineasNuevas.map((l) => ({
        ticket_id: ticketId,
        producto_id: l.productoId,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precio_unitario: l.precioUnitario,
        iva_pct: l.ivaPct,
        descuento_pct: l.descuentoPct,
        destino: l.destino,
        nota_cocina: l.notaCocina,
        enviada_at: now,
      }));
      const { data: insertadas, error: errL } = await supabase
        .from("pos_ticket_lineas")
        .insert(payload)
        .select("id");
      if (errL) throw errL;

      // Supabase devuelve en el mismo orden que se insertó
      const rows = (insertadas ?? []) as Array<{ id: string }>;
      input.lineasNuevas.forEach((l, i) => {
        if (rows[i]) lineaIdMap[l.localId] = rows[i].id;
      });
    }

    // ─── 3. Actualizar ticket: estado ENVIADO + enviado_at + totales ───
    const { data: lineasFin } = await supabase
      .from("pos_ticket_lineas")
      .select("cantidad, precio_unitario, iva_pct, descuento_pct")
      .eq("ticket_id", ticketId);

    let baseImp = 0;
    let iva = 0;
    for (const l of lineasFin ?? []) {
      const c = Number((l as { cantidad: number | string }).cantidad ?? 0);
      const pu = Number((l as { precio_unitario: number | string }).precio_unitario ?? 0);
      const ivaPct = Number((l as { iva_pct: number | string }).iva_pct ?? 10);
      const dp = Number((l as { descuento_pct: number | string }).descuento_pct ?? 0);
      const neto = c * pu * (1 - dp / 100);
      const base = neto / (1 + ivaPct / 100);
      baseImp += base;
      iva += neto - base;
    }
    const r2 = (n: number) => Math.round(n * 100) / 100;

    await supabase
      .from("pos_tickets")
      .update({
        estado: "ENVIADO",
        enviado_at: now,
        subtotal: r2(baseImp),
        iva_total: r2(iva),
        total: r2(baseImp + iva),
      })
      .eq("id", ticketId);

    return {
      ok: true,
      ticketId: ticketId!,
      numero,
      enviadaAt: now,
      lineaIdMap,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][cocina] persistirEnvioACocina:", msg);
    return { ok: false, error: msg };
  }
}
