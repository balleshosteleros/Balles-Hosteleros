"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { LineaEstadoCocina } from "../types";
import { transicionValida } from "../services/clasificador-estados";

// ─── Cambiar estado de una línea ──────────────────────────────

export async function updateEstadoCocinaLinea(input: {
  lineaId: string;
  nuevoEstado: LineaEstadoCocina;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();

    // Leer estado actual para validar transición
    const { data: actual, error: errR } = await supabase
      .from("pos_ticket_lineas")
      .select("estado_cocina, enviada_at")
      .eq("id", input.lineaId)
      .single();
    if (errR) throw errR;

    const row = actual as { estado_cocina: LineaEstadoCocina; enviada_at: string | null };
    if (!row.enviada_at) {
      return { ok: false, error: "La línea aún no ha sido enviada a cocina." };
    }
    if (!transicionValida(row.estado_cocina, input.nuevoEstado)) {
      return {
        ok: false,
        error: `Transición no permitida: ${row.estado_cocina} → ${input.nuevoEstado}`,
      };
    }

    // El trigger BD rellena timestamps; aquí sólo cambiamos el enum.
    // Para undo limpiamos timestamps de estados posteriores:
    const patch: Record<string, unknown> = { estado_cocina: input.nuevoEstado };
    if (input.nuevoEstado === "PREPARANDO") {
      patch.listo_at = null;
      patch.servido_at = null;
    } else if (input.nuevoEstado === "LISTO") {
      patch.servido_at = null;
    } else if (input.nuevoEstado === "PENDIENTE") {
      patch.preparando_at = null;
      patch.listo_at = null;
      patch.servido_at = null;
    }

    const { error } = await supabase
      .from("pos_ticket_lineas")
      .update(patch)
      .eq("id", input.lineaId);
    if (error) throw error;

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cocina][comandas] updateEstadoCocinaLinea:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Bulk: cambiar estado de todas las líneas de un ticket ────

export async function updateEstadoCocinaTicket(input: {
  ticketId: string;
  nuevoEstado: LineaEstadoCocina;
  /** Si se pasa, sólo actualiza líneas cuyo destino esté incluido (ej. sólo COCINA). */
  destinos?: Array<"COCINA" | "BARRA" | "NINGUNO">;
}): Promise<{ ok: true; actualizadas: number } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();

    let query = supabase
      .from("pos_ticket_lineas")
      .select("id, estado_cocina, destino, enviada_at")
      .eq("ticket_id", input.ticketId)
      .not("enviada_at", "is", null);

    if (input.destinos && input.destinos.length > 0) {
      query = query.in("destino", input.destinos);
    }

    const { data: lineas, error: errL } = await query;
    if (errL) throw errL;

    const validas = ((lineas ?? []) as Array<{ id: string; estado_cocina: LineaEstadoCocina }>)
      .filter((l) => transicionValida(l.estado_cocina, input.nuevoEstado))
      .map((l) => l.id);

    if (validas.length === 0) return { ok: true, actualizadas: 0 };

    const patch: Record<string, unknown> = { estado_cocina: input.nuevoEstado };
    if (input.nuevoEstado === "PREPARANDO") {
      patch.listo_at = null;
      patch.servido_at = null;
    } else if (input.nuevoEstado === "LISTO") {
      patch.servido_at = null;
    } else if (input.nuevoEstado === "PENDIENTE") {
      patch.preparando_at = null;
      patch.listo_at = null;
      patch.servido_at = null;
    }

    const { error } = await supabase
      .from("pos_ticket_lineas")
      .update(patch)
      .in("id", validas);
    if (error) throw error;

    return { ok: true, actualizadas: validas.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cocina][comandas] updateEstadoCocinaTicket:", msg);
    return { ok: false, error: msg };
  }
}
