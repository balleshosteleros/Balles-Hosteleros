"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "@/shared/lib/friendly-errors";

/**
 * Cada vez que un cliente reservó, con lo que pasó de verdad.
 *
 * Es historia, no estado: incluye lo que vino de CoverManager (reservas que
 * nunca existieron en este sistema) y lo que genere esta aplicación. Por eso
 * se lee de `cliente_visitas` y no de `reservas`.
 *
 * Las valoraciones NO salen de aquí: viven en `resenas`, que es de donde la
 * ficha las viene leyendo desde siempre.
 */

/** Una reserva del pasado del cliente. */
export interface ClienteVisita {
  id: string;
  fecha: string;
  hora: string | null;
  turno: string | null;
  personas: number | null;
  /** Tal y como lo contó el origen: "Sentada", "No show", "Cancelado por…". */
  estado: string | null;
  mesa: string | null;
  zona: string | null;
  origen: string | null;
  local: string | null;
  observaciones: string | null;
}

/** Cómo se porta el cliente, en cuatro números. */
export interface ClienteResumenVisitas {
  total: number;
  sentadas: number;
  noShows: number;
  cancelaciones: number;
  primeraVisita: string | null;
  ultimaVisita: string | null;
}

export interface ClienteVisitasResult {
  ok: boolean;
  visitas: ClienteVisita[];
  resumen: ClienteResumenVisitas;
  error?: string;
}

/** Estados que significan que el cliente llegó a sentarse. */
const ESTADOS_SENTADA = ["sentada", "llegada", "cuenta solicitada", "postre", "limpiar"];

function esSentada(estado: string | null): boolean {
  return ESTADOS_SENTADA.includes((estado ?? "").trim().toLowerCase());
}

function esNoShow(estado: string | null): boolean {
  return (estado ?? "").trim().toLowerCase() === "no show";
}

function esCancelada(estado: string | null): boolean {
  return (estado ?? "").trim().toLowerCase().startsWith("cancelad");
}

const RESUMEN_VACIO: ClienteResumenVisitas = {
  total: 0,
  sentadas: 0,
  noShows: 0,
  cancelaciones: 0,
  primeraVisita: null,
  ultimaVisita: null,
};

/**
 * Historial de reservas de un cliente.
 *
 * El filtro por empresa va explícito porque la RLS acota a las empresas DEL
 * usuario, no a la ACTIVA (mismo motivo que en el resto de Sala).
 */
export async function getClienteVisitas(
  clienteId: string,
): Promise<ClienteVisitasResult> {
  const vacio: ClienteVisitasResult = { ok: false, visitas: [], resumen: RESUMEN_VACIO };
  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return { ...vacio, error: "Sin sesión" };

    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ...vacio, error: "Sin empresa activa" };

    const visitasRes = await supabase
      .from("cliente_visitas")
      .select(
        "id, fecha, hora, turno, personas, estado, mesa, zona, origen, local, observaciones",
      )
      .eq("cliente_id", clienteId)
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false });
    if (visitasRes.error) throw visitasRes.error;

    const visitas: ClienteVisita[] = (visitasRes.data ?? []).map((r) => ({
      id: r.id as string,
      fecha: r.fecha as string,
      hora: (r.hora as string | null) ?? null,
      turno: (r.turno as string | null) ?? null,
      personas: (r.personas as number | null) ?? null,
      estado: (r.estado as string | null) ?? null,
      mesa: (r.mesa as string | null) ?? null,
      zona: (r.zona as string | null) ?? null,
      origen: (r.origen as string | null) ?? null,
      local: (r.local as string | null) ?? null,
      observaciones: (r.observaciones as string | null) ?? null,
    }));

    // Las fechas vienen ordenadas de más nueva a más vieja.
    const fechas = visitas.map((v) => v.fecha).filter(Boolean);

    const resumen: ClienteResumenVisitas = {
      total: visitas.length,
      sentadas: visitas.filter((v) => esSentada(v.estado)).length,
      noShows: visitas.filter((v) => esNoShow(v.estado)).length,
      cancelaciones: visitas.filter((v) => esCancelada(v.estado)).length,
      primeraVisita: fechas.length ? fechas[fechas.length - 1] : null,
      ultimaVisita: fechas.length ? fechas[0] : null,
    };

    return { ok: true, visitas, resumen };
  } catch (err) {
    console.error("[cliente-visitas] getClienteVisitas:", err);
    return { ...vacio, error: friendlyError(err, "getClienteVisitas") };
  }
}
