"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser, getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { claveDiaEnZona } from "@/features/empresa/lib/zona-horaria";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarOrigen, type OrigenBucket } from "@/features/sala/data/origenes";
import { ESTADOS_RESERVA, type EstadoReserva } from "@/features/sala/data/reservas";

/**
 * Qué fecha se usa para agrupar. Son dos preguntas distintas y no se pueden
 * mezclar:
 *  - `fecha`      → el día PARA EL QUE reservó el cliente (columna `date`, ya
 *                   está en el día natural del restaurante, sin hora ni zona).
 *  - `created_at` → el día EN QUE se registró la reserva en el sistema
 *                   (`timestamptz`, instante UTC que hay que leer en la zona
 *                   horaria de la empresa para saber a qué día pertenece).
 */
export type CampoFecha = "fecha" | "created_at";

/** Solo semanal y mensual: la vista diaria se retiró de esta analítica. */
export type Granularidad = "semanal" | "mensual";

/** Filtro de estado: un estado concreto o todos. */
export type FiltroEstado = EstadoReserva | "TODOS";

export type OrigenBreakdownRow = {
  origen: OrigenBucket;
  reservas: number;
  porcentaje: number;
};

export type BucketResultado = {
  /** Identificador del bucket: "0".."6" semanal (lun..dom), "1".."12" mensual. */
  key: string;
  label: string;
  total: number;
  origenes: OrigenBreakdownRow[];
};

export type AnaliticaOrigenResult = {
  ok: boolean;
  anios: number[];
  total: number;
  buckets: BucketResultado[];
};

const DIAS_SEMANA_LABEL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function diaSemanaLunes0(iso: string): number {
  // iso = YYYY-MM-DD (día natural ya resuelto). getUTCDay(): 0=domingo..6=sábado.
  // Se fija mediodía UTC para que el redondeo no cambie de día.
  const d = new Date(`${iso}T12:00:00Z`);
  const js = d.getUTCDay();
  return (js + 6) % 7;
}

/**
 * Compra de Ticket que todavía NO es una reserva.
 *
 * Un Ticket comprado y sin canjear es una VENTA, no una reserva: nadie ha
 * pedido mesa para un día concreto, así que no puede contaminar ninguna
 * estadística de reservas. Solo cuenta cuando el cliente usa su código y la
 * reserva queda formalizada.
 *
 * Hoy ese caso NO se da: el portal solo crea la fila de `reservas` cuando el
 * cliente ya ha elegido fecha, hora y se le ha asignado mesa — comprar el
 * Ticket y reservar son el mismo paso, y `pago_pendiente` significa "reserva
 * hecha, cobro pendiente", que sí es una reserva de pleno derecho. Por eso el
 * descarte se ata a la única señal que describe de verdad una compra suelta:
 * un ticket SIN fecha para la que sentarse. Si mañana se separa la venta del
 * canje (comprar hoy, elegir día después), esas filas nacerán sin `fecha` y
 * quedarán excluidas solas, sin tocar esta analítica.
 */
function esCompraTicketSinReserva(r: { es_ticket: boolean | null; fecha: string | null }): boolean {
  return Boolean(r.es_ticket) && !r.fecha;
}

export async function getAniosConReservas(): Promise<number[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [new Date().getFullYear()];
    const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
    if (!empresaId) return [new Date().getFullYear()];

    const { data } = await supabase
      .from("reservas")
      .select("fecha")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false })
      .limit(2000);

    const set = new Set<number>();
    (data ?? []).forEach((row) => {
      const f = (row as { fecha: string | null }).fecha;
      if (f && f.length >= 4) set.add(Number(f.slice(0, 4)));
    });
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  } catch (err) {
    console.error("[analitica-origen] getAniosConReservas:", err);
    return [new Date().getFullYear()];
  }
}

export async function getOrigenReservas(params: {
  anio: number;
  campoFecha: CampoFecha;
  granularidad: Granularidad;
  estado?: FiltroEstado;
}): Promise<AnaliticaOrigenResult> {
  const empty: AnaliticaOrigenResult = { ok: false, anios: [], total: 0, buckets: [] };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;
    const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
    if (!empresaId) return empty;

    const tz = await getZonaHorariaEmpresa(supabase as unknown as SupabaseClient, empresaId);
    const porCreacion = params.campoFecha === "created_at";

    let query = supabase
      .from("reservas")
      .select("origen, estado, fecha, created_at, es_ticket")
      .eq("empresa_id", empresaId);

    if (porCreacion) {
      // `created_at` es un instante UTC. El año que pide el usuario es el año
      // NATURAL de la empresa, así que el rango se abre un día por cada lado y
      // el recorte fino se hace luego ya con la fecha traducida a su zona: si
      // filtrásemos en UTC, las reservas creadas la noche del 31-dic o del
      // 1-ene caerían en el año contrario.
      query = query
        .gte("created_at", `${params.anio - 1}-12-31T00:00:00Z`)
        .lte("created_at", `${params.anio + 1}-01-01T23:59:59Z`);
    } else {
      // `fecha` es un `date`: el día natural ya está resuelto, se filtra directo.
      query = query
        .gte("fecha", `${params.anio}-01-01`)
        .lte("fecha", `${params.anio}-12-31`);
    }

    const estadoFiltro = params.estado ?? "TODOS";
    if (estadoFiltro !== "TODOS") {
      query = query.eq("estado", estadoFiltro);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      origen: string | null;
      estado: string | null;
      fecha: string | null;
      created_at: string | null;
      es_ticket: boolean | null;
    }>;

    // Estado WALK_IN siempre se contabiliza como origen WALKIN (la fuente de
    // verdad es el estado: la BD puede no tener `origen` poblado en reservas
    // antiguas y el cliente llegó andando, sin canal digital de por medio).
    const resolverOrigen = (r: { origen: string | null; estado: string | null }): OrigenBucket => {
      if (r.estado === "WALK_IN") return "WALKIN";
      return normalizarOrigen(r.origen);
    };

    type Acumulado = Map<OrigenBucket, number>;
    const buckets = new Map<string, { label: string; counts: Acumulado }>();

    // Los buckets se siembran completos para que un día o un mes sin reservas
    // siga apareciendo en la rejilla (con su "Sin reservas"), en vez de que la
    // cuadrícula se descoloque.
    if (params.granularidad === "semanal") {
      for (let i = 0; i < 7; i++) {
        buckets.set(String(i), { label: DIAS_SEMANA_LABEL[i], counts: new Map() });
      }
    } else {
      for (let m = 1; m <= 12; m++) {
        buckets.set(String(m), { label: MESES_LABEL[m - 1], counts: new Map() });
      }
    }

    for (const r of rows) {
      // Un Ticket comprado y sin canjear es una compra, no una reserva.
      if (esCompraTicketSinReserva(r)) continue;

      // Día natural del que cuelga la reserva, según lo que se esté midiendo.
      const fechaIso = porCreacion
        ? claveDiaEnZona(r.created_at, tz)
        : (r.fecha ?? "").slice(0, 10);
      if (!fechaIso || fechaIso.length < 10) continue;

      const [y, m] = fechaIso.split("-").map(Number);
      if (!y || !m) continue;
      // Recorte fino del año, ya en el día natural de la empresa.
      if (y !== params.anio) continue;

      const key = params.granularidad === "semanal"
        ? String(diaSemanaLunes0(fechaIso))
        : String(m);

      const bucket = buckets.get(key);
      if (!bucket) continue;
      const origen = resolverOrigen(r);
      bucket.counts.set(origen, (bucket.counts.get(origen) ?? 0) + 1);
    }

    let total = 0;
    const resultBuckets: BucketResultado[] = Array.from(buckets.entries()).map(([key, b]) => {
      let bucketTotal = 0;
      const origenes: OrigenBreakdownRow[] = [];
      b.counts.forEach((reservas, origen) => {
        bucketTotal += reservas;
        origenes.push({ origen, reservas, porcentaje: 0 });
      });
      origenes.forEach((o) => {
        o.porcentaje = bucketTotal > 0 ? Math.round((o.reservas / bucketTotal) * 100) : 0;
      });
      origenes.sort((a, b) => b.reservas - a.reservas || a.origen.localeCompare(b.origen));
      total += bucketTotal;
      return { key, label: b.label, total: bucketTotal, origenes };
    });

    // Orden estable: semanal por índice 0..6 (lun..dom), mensual por mes 1..12.
    resultBuckets.sort((a, b) => Number(a.key) - Number(b.key));

    const anios = await getAniosConReservas();
    return { ok: true, anios, total, buckets: resultBuckets };
  } catch (err) {
    console.error("[analitica-origen] getOrigenReservas:", err);
    return empty;
  }
}

/** Estados ofrecidos por el filtro, en el orden en que se muestran. */
export async function getEstadosFiltroOrigen(): Promise<EstadoReserva[]> {
  return ESTADOS_RESERVA;
}
