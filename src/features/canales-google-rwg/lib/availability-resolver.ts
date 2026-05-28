import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BatchAvailabilityLookupRequest,
  SlotTimeAvailability,
} from "./proto-types";

const TZ_DEFAULT = "Europe/Madrid";

/**
 * Convierte un instante UTC (unix seconds) a fecha YYYY-MM-DD y hora HH:mm:ss
 * en la zona del restaurante (por ahora fija Europe/Madrid; futuro: empresas.timezone).
 */
function startSecToFechaHora(startSec: number): { fecha: string; hora: string } {
  const d = new Date(startSec * 1000);
  // Intl.DateTimeFormat con zona horaria fija
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_DEFAULT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    fecha: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

/** Heurística simple v1: turno por franja horaria. */
function deducirTurno(hora: string): "COMIDA" | "CENA" {
  const hh = parseInt(hora.slice(0, 2), 10);
  return hh < 17 ? "COMIDA" : "CENA";
}

interface AvailabilitySlot {
  fecha: string;
  turno: "COMIDA" | "CENA";
  partySize: number;
}

interface SlotKey {
  fecha: string;
  turno: "COMIDA" | "CENA";
}

function slotKey(s: SlotKey): string {
  return `${s.fecha}|${s.turno}`;
}

export async function lookupAvailability(
  admin: SupabaseClient,
  empresaId: string,
  slots: BatchAvailabilityLookupRequest["slot_time"],
): Promise<SlotTimeAvailability[]> {
  if (slots.length === 0) return [];

  // 1. Materializar (fecha, turno, partySize) por cada slot pedido.
  const enriched: AvailabilitySlot[] = slots.map((s) => {
    const { fecha, hora } = startSecToFechaHora(s.start_sec);
    return {
      fecha,
      turno: deducirTurno(hora),
      partySize: s.resources?.party_size ?? 2,
    };
  });

  // 2. Conjunto único de (fecha, turno) para una sola pasada de cupo + ocupación.
  const uniqueKeys = new Map<string, SlotKey>();
  for (const e of enriched) uniqueKeys.set(slotKey(e), { fecha: e.fecha, turno: e.turno });

  // 3. Cupos efectivos (RPC) en paralelo.
  const cupoByKey = new Map<string, number | null>();
  await Promise.all(
    Array.from(uniqueKeys.values()).map(async (k) => {
      const { data } = await admin.rpc("cupo_efectivo", {
        p_empresa_id: empresaId,
        p_fecha: k.fecha,
        p_turno: k.turno,
      });
      cupoByKey.set(slotKey(k), (data as number | null) ?? null);
    }),
  );

  // 4. Ocupación actual del slot (personas_total).
  const fechas = Array.from(new Set(Array.from(uniqueKeys.values()).map((k) => k.fecha)));
  const { data: locks } = await admin
    .from("reserva_slots_lock")
    .select("fecha, turno, personas_total")
    .eq("empresa_id", empresaId)
    .in("fecha", fechas);

  const ocupacionByKey = new Map<string, number>();
  for (const row of (locks ?? []) as Array<{ fecha: string; turno: string; personas_total: number }>) {
    ocupacionByKey.set(slotKey({ fecha: row.fecha, turno: row.turno as "COMIDA" | "CENA" }), row.personas_total);
  }

  // 5. Construir respuesta en el orden del request.
  return enriched.map((e, i) => {
    const k = slotKey(e);
    const cupo = cupoByKey.get(k);
    const ocupado = ocupacionByKey.get(k) ?? 0;
    const ilimitado = cupo == null;
    const total = ilimitado ? 999 : cupo;
    const libres = ilimitado ? 999 : Math.max(0, cupo - ocupado);
    const cabeParty = libres >= e.partySize;
    return {
      slot_time: slots[i],
      spots_open: cabeParty ? libres : 0,
      spots_total: total,
      availability: cabeParty
        ? "SPOTS_AVAILABILITY_AVAILABLE"
        : "SPOTS_AVAILABILITY_UNAVAILABLE",
    };
  });
}
