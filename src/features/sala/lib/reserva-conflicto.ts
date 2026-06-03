import type { SupabaseClient } from "@supabase/supabase-js";
import { DURACION_RESERVA_DEFAULT_MINUTOS } from "@/features/sala/data/reservas";

/** Estados de reserva que liberan la mesa (no cuentan como ocupantes). */
export const ESTADOS_NO_OCUPANTES = [
  "CANCELADA",
  "NO_SHOW",
  "COMPLETADA",
  "LIBERADA",
] as const;

/**
 * Devuelve la duración por reserva configurada para la empresa en minutos.
 * Si la fila o el valor no están, devuelve el default global (120 min).
 */
export async function getDuracionReservaMin(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<number> {
  const { data } = await supabase
    .from("empresa_reservas_config")
    .select("duracion_reserva_min")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const n = (data?.duracion_reserva_min as number | null) ?? null;
  return typeof n === "number" && n > 0 ? n : DURACION_RESERVA_DEFAULT_MINUTOS;
}

function partesHora(hora: string): { h: number; m: number } {
  const [h, m] = hora.split(":").map((n) => parseInt(n, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

function horaAStr(h: number, m: number): string {
  // Clampa al día (no cruzamos a la noche siguiente: las reservas tras
  // medianoche se guardan con su hora real, ej. 00:30, y el solape solo se
  // chequea dentro de la misma `fecha`).
  const hh = Math.max(0, Math.min(23, h));
  const mm = Math.max(0, Math.min(59, m));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

/**
 * Convierte una hora (HH:MM[:SS]) a minutos desde 00:00.
 */
export function horaAMinutos(hora: string): number {
  const { h, m } = partesHora(hora);
  return h * 60 + m;
}

/**
 * Calcula la ventana [desde, hasta) durante la cual una mesa queda ocupada
 * por una reserva en `hora` que dura `duracionMin` minutos.
 */
export function ventanaOcupacion(
  hora: string,
  duracionMin: number,
): { desde: string; hasta: string } {
  const inicioMin = horaAMinutos(hora);
  const finMin = inicioMin + Math.max(1, duracionMin);
  const desdeH = Math.floor(inicioMin / 60);
  const desdeM = inicioMin % 60;
  const hastaH = Math.floor(finMin / 60);
  const hastaM = finMin % 60;
  return {
    desde: horaAStr(desdeH, desdeM),
    hasta: horaAStr(hastaH, hastaM),
  };
}

/**
 * Comprueba si una mesa concreta tiene ya una reserva viva que solapa con la
 * franja [hora, hora + duracion). Si la encuentra, devuelve la primera para
 * que la UI pueda explicar el motivo. `ignoreReservaId` permite excluir la
 * propia reserva al editarla.
 */
export async function buscarConflictoMesa(
  supabase: SupabaseClient,
  args: {
    empresaId: string;
    fecha: string;
    hora: string;
    mesa: string;
    duracionMin: number;
    ignoreReservaId?: string | null;
  },
): Promise<{ hora: string; clienteNombre: string | null } | null> {
  const inicioMin = horaAMinutos(args.hora);
  const finMin = inicioMin + Math.max(1, args.duracionMin);
  // Buscamos reservas vivas del mismo día y mesa. Filtramos solape en JS para
  // poder usar la `duracion_reserva_min` de la empresa (mismo valor que las
  // reservas existentes — todas pesan igual).
  let query = supabase
    .from("reservas")
    .select("id, hora, cliente_nombre, estado")
    .eq("empresa_id", args.empresaId)
    .eq("fecha", args.fecha)
    .eq("mesa", args.mesa)
    .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
  if (args.ignoreReservaId) query = query.neq("id", args.ignoreReservaId);
  const { data, error } = await query;
  if (error) {
    console.error("[reserva-conflicto] error:", error);
    return null;
  }
  for (const r of data ?? []) {
    const otraHora = (r.hora as string) ?? "";
    const otroInicio = horaAMinutos(otraHora);
    const otroFin = otroInicio + Math.max(1, args.duracionMin);
    const haySolape = otroInicio < finMin && inicioMin < otroFin;
    if (haySolape) {
      return {
        hora: otraHora.slice(0, 5),
        clienteNombre: (r.cliente_nombre as string | null) ?? null,
      };
    }
  }
  return null;
}
