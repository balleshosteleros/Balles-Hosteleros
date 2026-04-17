"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { Pago, PagoMedio } from "../types";

export async function registrarPagos(input: {
  ticketId: string;
  pagos: { medio: PagoMedio; importe: number; referencia?: string }[];
}): Promise<{ ok: true; data: Pago[] } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();
    if (input.pagos.length === 0) return { ok: false, error: "Sin pagos a registrar." };

    const { data, error } = await supabase
      .from("pos_pagos")
      .insert(
        input.pagos.map((p) => ({
          ticket_id: input.ticketId,
          medio: p.medio,
          importe: p.importe,
          referencia: p.referencia ?? null,
        }))
      )
      .select();

    if (error) throw error;

    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        id: (r as { id: string }).id,
        ticketId: (r as { ticket_id: string }).ticket_id,
        medio: (r as { medio: PagoMedio }).medio,
        importe: Number((r as { importe: number | string }).importe ?? 0),
        referencia: (r as { referencia: string | null }).referencia,
        creadoAt: (r as { creado_at: string }).creado_at,
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][pagos] registrarPagos:", msg);
    return { ok: false, error: msg };
  }
}
