"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { normEstadoDb, type EstadoMesa } from "../services/mesa-estado";

export interface MesaPOS {
  id: string;
  codigo: string;
  numero: string;
  zona: string;
  capacidad: number;
  estado: EstadoMesa;
  tipo: string;
  ticketAbierto?: { id: string; numero: string; total: number } | null;
}

/** Lista mesas de la empresa con el ticket abierto asociado (si existe). */
export async function listMesasPOS(): Promise<
  { ok: true; data: MesaPOS[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const { data: mesas, error } = await supabase
      .from("mesas")
      .select("id, numero, zona_id, capacidad, estado, activa")
      .eq("empresa_id", empresaId)
      .eq("activa", true)
      .order("numero", { ascending: true });

    if (error) throw error;

    // Resolver nombres de zonas (tabla `zonas`)
    const zonaIds = Array.from(
      new Set(
        (mesas ?? [])
          .map((m) => (m as { zona_id: string | null }).zona_id)
          .filter((z): z is string => !!z)
      )
    );
    let zonasById = new Map<string, string>();
    if (zonaIds.length > 0) {
      const { data: zonas } = await supabase
        .from("zonas")
        .select("id, nombre")
        .in("id", zonaIds);
      zonasById = new Map((zonas ?? []).map((z) => [(z as { id: string }).id, (z as { nombre: string }).nombre]));
    }

    const mesaIds = (mesas ?? []).map((m) => (m as { id: string }).id);
    let ticketsByMesa = new Map<string, { id: string; numero: string; total: number }>();

    if (mesaIds.length > 0) {
      const { data: tickets } = await supabase
        .from("pos_tickets")
        .select("id, numero, total, mesa_id")
        .eq("empresa_id", empresaId)
        .in("mesa_id", mesaIds)
        .in("estado", ["ABIERTO", "ENVIADO"]);

      ticketsByMesa = new Map(
        (tickets ?? []).map((t) => [
          (t as { mesa_id: string }).mesa_id,
          {
            id: (t as { id: string }).id,
            numero: (t as { numero: string }).numero,
            total: Number((t as { total: number | string }).total ?? 0),
          },
        ])
      );
    }

    const result: MesaPOS[] = (mesas ?? []).map((m) => {
      const id = (m as { id: string }).id;
      const numero = String((m as { numero: string | number }).numero ?? "");
      return {
        id,
        codigo: numero,
        numero,
        zona: zonasById.get((m as { zona_id: string | null }).zona_id ?? "") ?? "Sin zona",
        capacidad: Number((m as { capacidad: number | string }).capacidad ?? 0),
        estado: normEstadoDb((m as { estado: string }).estado),
        tipo: "MESA",
        ticketAbierto: ticketsByMesa.get(id) ?? null,
      };
    });

    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][mesas] listMesasPOS:", msg);
    return { ok: false, error: msg };
  }
}

/** Cambia el ticket abierto de una mesa a otra (libera la origen). */
export async function cambiarMesa(input: {
  ticketId: string;
  mesaDestinoId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();

    const { data: ticket } = await supabase
      .from("pos_tickets")
      .select("mesa_id, estado")
      .eq("id", input.ticketId)
      .single();
    if (!ticket) return { ok: false, error: "Ticket no encontrado" };

    const origenId = (ticket as { mesa_id: string | null }).mesa_id;
    const estado = (ticket as { estado: string }).estado;
    if (estado !== "ABIERTO" && estado !== "ENVIADO") {
      return { ok: false, error: "El ticket no está abierto." };
    }

    // Mesa destino debe estar libre
    const { data: destino } = await supabase
      .from("mesas")
      .select("estado")
      .eq("id", input.mesaDestinoId)
      .single();
    if (!destino) return { ok: false, error: "Mesa destino no encontrada" };
    if (normEstadoDb((destino as { estado: string }).estado) !== "LIBRE") {
      return { ok: false, error: "La mesa destino no está libre." };
    }

    // Actualizar ticket
    const { error } = await supabase
      .from("pos_tickets")
      .update({ mesa_id: input.mesaDestinoId })
      .eq("id", input.ticketId);
    if (error) throw error;

    await supabase.from("mesas").update({ estado: "Ocupada" }).eq("id", input.mesaDestinoId);
    if (origenId) {
      await supabase.from("mesas").update({ estado: "Libre" }).eq("id", origenId);
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][mesas] cambiarMesa:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Fusiona dos tickets: mueve todas las líneas del ticket origen al destino
 * y anula el origen (como fusionado). La mesa origen queda libre.
 */
export async function fusionarTickets(input: {
  ticketOrigenId: string;
  ticketDestinoId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();
    if (input.ticketOrigenId === input.ticketDestinoId) {
      return { ok: false, error: "Tickets iguales." };
    }

    // Mover líneas (reasignar ticket_id)
    const { error: errMove } = await supabase
      .from("pos_ticket_lineas")
      .update({ ticket_id: input.ticketDestinoId })
      .eq("ticket_id", input.ticketOrigenId);
    if (errMove) throw errMove;

    // Obtener mesa origen para liberarla
    const { data: origen } = await supabase
      .from("pos_tickets")
      .select("mesa_id")
      .eq("id", input.ticketOrigenId)
      .single();

    // Marcar origen como anulado-fusión
    await supabase
      .from("pos_tickets")
      .update({
        estado: "ANULADO",
        anulado_at: new Date().toISOString(),
        anulado_motivo: `Fusionado con ${input.ticketDestinoId}`,
      })
      .eq("id", input.ticketOrigenId);

    const mesaOrigen = (origen as { mesa_id: string | null } | null)?.mesa_id;
    if (mesaOrigen) {
      await supabase.from("mesas").update({ estado: "Libre" }).eq("id", mesaOrigen);
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][mesas] fusionarTickets:", msg);
    return { ok: false, error: msg };
  }
}
