/**
 * Generadores de feeds del Actions Center (Reservations E2E).
 * Funciones puras: reciben snapshot de BD, devuelven JSON serializable.
 * La subida SFTP vive en Fase 7 (sftp-uploader.ts + cron).
 *
 * v1: 2 services por empresa (COMIDA, CENA) + 30 días forward × 2 turnos.
 * Granularidad finer-grained (slots de 15/30 min) queda como mejora.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const TZ_DEFAULT = "Europe/Madrid";
const HORA_DEFAULT_COMIDA = "14:00";
const HORA_DEFAULT_CENA = "21:00";
const DURATION_SEC = 5400; // 90 min
const DIAS_FORWARD = 30;

export interface FeedRow {
  empresaId: string;
  placeId: string;
  slug: string;
  nombre: string;
  telefono: string | null;
  url: string | null;
  direccion: string | null;
}

/* ============================================================
 * Snapshot de BD
 * ============================================================ */
export interface FeedSnapshot {
  empresas: FeedRow[];
  /** key: `${empresaId}|${fecha}|${turno}` → personas reservadas activas. */
  ocupacion: Map<string, number>;
}

interface EmpresaRow {
  id: string;
  google_place_id: string;
  slug: string;
  nombre: string;
  direccion: string | null;
  datos_generales: Record<string, unknown> | null;
}

export async function loadFeedSnapshot(admin: SupabaseClient): Promise<FeedSnapshot> {
  const { data: empresasData } = await admin
    .from("empresas")
    .select("id, google_place_id, slug, nombre, direccion, datos_generales")
    .not("google_place_id", "is", null);

  const empresas: FeedRow[] = ((empresasData ?? []) as EmpresaRow[]).map((e) => ({
    empresaId: e.id,
    placeId: e.google_place_id,
    slug: e.slug,
    nombre: e.nombre,
    telefono: (e.datos_generales?.telefono as string | undefined) ?? null,
    url: (e.datos_generales?.web as string | undefined) ?? null,
    direccion: e.direccion,
  }));

  // Ocupación: snapshot del lock por (empresa, fecha, turno).
  const empresaIds = empresas.map((e) => e.empresaId);
  const ocupacion = new Map<string, number>();
  if (empresaIds.length > 0) {
    const { data: locks } = await admin
      .from("reserva_slots_lock")
      .select("empresa_id, fecha, turno, personas_total")
      .in("empresa_id", empresaIds);
    for (const r of (locks ?? []) as Array<{
      empresa_id: string; fecha: string; turno: string; personas_total: number;
    }>) {
      ocupacion.set(`${r.empresa_id}|${r.fecha}|${r.turno}`, r.personas_total);
    }
  }

  return { empresas, ocupacion };
}

/* ============================================================
 * Merchant Feed
 * ============================================================ */
export function buildMerchantFeed(snapshot: FeedSnapshot): unknown {
  return {
    merchant: snapshot.empresas.map((e) => ({
      merchant_id: e.placeId,
      name: e.nombre,
      telephone: e.telefono ?? undefined,
      url: e.url ?? undefined,
      category: "restaurant",
      country_code: "ES",
      address: e.direccion ? { street_address: e.direccion } : undefined,
    })),
  };
}

/* ============================================================
 * Services Feed
 * ============================================================ */
export function buildServicesFeed(snapshot: FeedSnapshot): unknown {
  const services = snapshot.empresas.flatMap((e) => ([
    {
      service_id: `${e.placeId}::COMIDA`,
      merchant_id: e.placeId,
      name: "Comida",
      description: "Reserva de mesa para comida",
      duration_sec: DURATION_SEC,
    },
    {
      service_id: `${e.placeId}::CENA`,
      merchant_id: e.placeId,
      name: "Cena",
      description: "Reserva de mesa para cena",
      duration_sec: DURATION_SEC,
    },
  ]));
  return { service: services };
}

/* ============================================================
 * Availability Feed
 * ============================================================ */
export interface BuildAvailabilityOpts {
  diasForward?: number;
  fechaBaseISO?: string;
  /**
   * Resolver cupo (cupo_efectivo) por (empresaId, fecha, turno). Devuelve null si ilimitado.
   * Se inyecta para que el caller pueda usar la RPC `cupo_efectivo` o un mock en tests.
   */
  resolveCupo: (empresaId: string, fecha: string, turno: "COMIDA" | "CENA") => Promise<number | null>;
}

// PRP-069: el feed de disponibilidad genera fechas forward comunes a TODAS las
// empresas del feed; al ser multi-empresa por slot, se usa la zona de referencia
// peninsular (TZ_DEFAULT). La hora REAL de cada reserva sí se guarda en la zona de
// su empresa (ver CreateBooking/availability-resolver). Pendiente: feed por empresa.
function ymdEnTZ(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_DEFAULT, year: "numeric", month: "2-digit", day: "2-digit", hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function startSecParaFechaTurno(fechaISO: string, turno: "COMIDA" | "CENA"): number {
  const hora = turno === "COMIDA" ? HORA_DEFAULT_COMIDA : HORA_DEFAULT_CENA;
  // Asumimos TZ Europe/Madrid; cf. note en availability-resolver.
  // Parse en local Madrid: nos vale aproximación con +01:00 (CET). En verano hay 1h drift.
  const d = new Date(`${fechaISO}T${hora}:00+01:00`);
  return Math.floor(d.getTime() / 1000);
}

export async function buildAvailabilityFeed(
  snapshot: FeedSnapshot,
  opts: BuildAvailabilityOpts,
): Promise<{ feed: unknown; slotsCount: number }> {
  const dias = opts.diasForward ?? DIAS_FORWARD;
  const base = opts.fechaBaseISO ? new Date(`${opts.fechaBaseISO}T12:00:00Z`) : new Date();
  const slotsOut: Array<Record<string, unknown>> = [];

  for (const empresa of snapshot.empresas) {
    for (let i = 0; i < dias; i++) {
      const d = new Date(base.getTime() + i * 86400_000);
      const fecha = ymdEnTZ(d);
      for (const turno of ["COMIDA", "CENA"] as const) {
        const cupo = await opts.resolveCupo(empresa.empresaId, fecha, turno);
        const ocupado = snapshot.ocupacion.get(`${empresa.empresaId}|${fecha}|${turno}`) ?? 0;
        const ilimitado = cupo == null;
        const spotsTotal = ilimitado ? 999 : cupo;
        const spotsOpen = ilimitado ? 999 : Math.max(0, cupo - ocupado);
        slotsOut.push({
          merchant_id: empresa.placeId,
          service_id: `${empresa.placeId}::${turno}`,
          start_sec: startSecParaFechaTurno(fecha, turno),
          duration_sec: DURATION_SEC,
          spots_total: spotsTotal,
          spots_open: spotsOpen,
        });
      }
    }
  }

  return { feed: { slot: slotsOut }, slotsCount: slotsOut.length };
}

/**
 * Helper para usar la RPC `cupo_efectivo` desde Postgres como resolver.
 */
export function makeCupoResolver(admin: SupabaseClient) {
  return async (empresaId: string, fecha: string, turno: "COMIDA" | "CENA") => {
    const { data } = await admin.rpc("cupo_efectivo", {
      p_empresa_id: empresaId,
      p_fecha: fecha,
      p_turno: turno,
    });
    return (data as number | null) ?? null;
  };
}
