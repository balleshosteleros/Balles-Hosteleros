import type { SupabaseClient } from "@supabase/supabase-js";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { asignarMesaAutomatica } from "@/features/sala/planos/lib/asignacion-mesa";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";
import type {
  BatchAvailabilityLookupRequest,
  SlotTimeAvailability,
} from "./proto-types";

const TZ_DEFAULT = "Europe/Madrid";

/**
 * Convierte un instante UTC (unix seconds) a fecha YYYY-MM-DD y hora HH:mm:ss
 * en la zona horaria del restaurante (PRP-069). `tz` la marca la empresa.
 */
function startSecToFechaHora(startSec: number, tz: string = TZ_DEFAULT): { fecha: string; hora: string } {
  const d = new Date(startSec * 1000);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
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

/** Fuente única: la madrugada es cena, no comida. */
const deducirTurno = turnoDeHora;

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

  // Zona horaria del restaurante (PRP-069) para situar cada slot en su día/turno.
  const tz = await getZonaHorariaEmpresa(admin, empresaId);

  // 1. Materializar (fecha, turno, partySize) por cada slot pedido.
  const enriched: AvailabilitySlot[] = slots.map((s) => {
    const { fecha, hora } = startSecToFechaHora(s.start_sec, tz);
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

  // 5. ¿Hay MESA (o unión) para ese grupo a esa hora?
  //
  // El cupo del turno manda cuando existe, pero no basta: sin tope de
  // comensales `cupo_efectivo` devuelve NULL y Google vería sitio infinito
  // aunque no quede una sola mesa. Aquí se comprueba mesa real, que es el
  // límite efectivo cuando no hay cupo configurado.
  const localId = await primerLocal(admin, empresaId);
  const hayMesaPorSlot = new Map<number, boolean>();
  if (localId) {
    await Promise.all(
      enriched.map(async (e, i) => {
        const { hora } = startSecToFechaHora(slots[i].start_sec, tz);
        const asign = await asignarMesaAutomatica(admin, {
          localId,
          empresaId,
          fecha: e.fecha,
          hora,
          personas: e.partySize,
        });
        // Solo un "no hay mesa" explícito cierra el slot. Si el plano está mal
        // configurado (asign.ok === false) NO cerramos Google por un fallo
        // nuestro: manda el cupo.
        hayMesaPorSlot.set(i, asign.ok ? Boolean(asign.mesa) : true);
      }),
    );
  }

  // 6. Construir respuesta en el orden del request.
  return enriched.map((e, i) => {
    const k = slotKey(e);
    const cupo = cupoByKey.get(k);
    const ocupado = ocupacionByKey.get(k) ?? 0;
    const ilimitado = cupo == null;
    const total = ilimitado ? 999 : cupo;
    const libres = ilimitado ? 999 : Math.max(0, cupo - ocupado);
    const cabeParty = libres >= e.partySize;
    const hayMesa = hayMesaPorSlot.get(i) ?? true;
    const disponible = cabeParty && hayMesa;
    return {
      slot_time: slots[i],
      spots_open: disponible ? libres : 0,
      spots_total: total,
      availability: disponible
        ? "SPOTS_AVAILABILITY_AVAILABLE"
        : "SPOTS_AVAILABILITY_UNAVAILABLE",
    };
  });
}

/** Primer local de la empresa (hoy las empresas tienen uno). */
async function primerLocal(
  admin: SupabaseClient,
  empresaId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("locales")
    .select("id")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
