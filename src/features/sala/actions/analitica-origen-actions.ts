"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarOrigen, type OrigenBucket } from "@/features/sala/data/origenes";

export type CampoFecha = "fecha" | "created_at";
export type Granularidad = "diario" | "semanal" | "mensual";

export type OrigenBreakdownRow = {
  origen: OrigenBucket;
  reservas: number;
  porcentaje: number;
};

export type BucketResultado = {
  /** Identificador del bucket: "0".."6" para semanal (lun..dom), "1".."12" mensual, "YYYY-MM-DD" diario. */
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

function rangoAnio(anio: number): { desde: string; hasta: string } {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
}

function diaSemanaLunes0(iso: string): number {
  // iso = YYYY-MM-DD. getUTCDay(): 0=domingo .. 6=sábado.
  // Reordenamos a 0=lunes .. 6=domingo.
  const d = new Date(`${iso}T12:00:00Z`);
  const js = d.getUTCDay();
  return (js + 6) % 7;
}

function isoDateOnly(input: string): string {
  // Acepta "YYYY-MM-DD", "YYYY-MM-DDTHH:..." o un timestamp ISO completo.
  return input.length >= 10 ? input.slice(0, 10) : input;
}

export async function getAniosConReservas(): Promise<number[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [new Date().getUTCFullYear()];
    const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
    if (!empresaId) return [new Date().getUTCFullYear()];

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
    const actual = new Date().getUTCFullYear();
    set.add(actual);
    return Array.from(set).sort((a, b) => b - a);
  } catch (err) {
    console.error("[analitica-origen] getAniosConReservas:", err);
    return [new Date().getUTCFullYear()];
  }
}

export async function getOrigenReservas(params: {
  anio: number;
  campoFecha: CampoFecha;
  granularidad: Granularidad;
  /** Solo aplica si granularidad === "diario": filtra a un mes (1..12). */
  mes?: number;
}): Promise<AnaliticaOrigenResult> {
  const empty: AnaliticaOrigenResult = { ok: false, anios: [], total: 0, buckets: [] };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return empty;
    const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
    if (!empresaId) return empty;

    const { desde, hasta } = rangoAnio(params.anio);
    const columna = params.campoFecha === "created_at" ? "created_at" : "fecha";

    // Para created_at filtramos por timestamps; para fecha por YYYY-MM-DD.
    const desdeFiltro = columna === "created_at" ? `${desde}T00:00:00Z` : desde;
    const hastaFiltro = columna === "created_at" ? `${hasta}T23:59:59Z` : hasta;

    const query = supabase
      .from("reservas")
      .select("origen, estado, fecha, created_at")
      .eq("empresa_id", empresaId)
      .gte(columna, desdeFiltro)
      .lte(columna, hastaFiltro);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      origen: string | null;
      estado: string | null;
      fecha: string | null;
      created_at: string | null;
    }>;

    // Estado WALK_IN siempre se contabiliza como origen WALKIN (la fuente de verdad
    // es el estado: la BD puede no tener `origen` poblado en reservas antiguas).
    const resolverOrigen = (r: { origen: string | null; estado: string | null }): OrigenBucket => {
      if (r.estado === "WALK_IN") return "WALKIN";
      return normalizarOrigen(r.origen);
    };

    // Agrupado en función de la granularidad.
    type Acumulado = Map<OrigenBucket, number>;
    const buckets = new Map<string, { label: string; counts: Acumulado }>();

    if (params.granularidad === "semanal") {
      for (let i = 0; i < 7; i++) {
        buckets.set(String(i), { label: DIAS_SEMANA_LABEL[i], counts: new Map() });
      }
    } else if (params.granularidad === "mensual") {
      for (let m = 1; m <= 12; m++) {
        buckets.set(String(m), { label: MESES_LABEL[m - 1], counts: new Map() });
      }
    }

    const filtrarMes = params.granularidad === "diario" && params.mes ? params.mes : null;

    for (const r of rows) {
      const ref = columna === "created_at" ? r.created_at : r.fecha;
      if (!ref) continue;
      const fechaIso = isoDateOnly(ref);
      const [y, m, d] = fechaIso.split("-").map(Number);
      if (!y || !m || !d) continue;

      let key: string;
      let label: string;
      if (params.granularidad === "semanal") {
        const dow = diaSemanaLunes0(fechaIso);
        key = String(dow);
        label = DIAS_SEMANA_LABEL[dow];
      } else if (params.granularidad === "mensual") {
        key = String(m);
        label = MESES_LABEL[m - 1];
      } else {
        if (filtrarMes && m !== filtrarMes) continue;
        key = fechaIso;
        label = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
      }

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { label, counts: new Map() };
        buckets.set(key, bucket);
      }
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
      origenes.sort((a, b) => b.reservas - a.reservas);
      total += bucketTotal;
      return { key, label: b.label, total: bucketTotal, origenes };
    });

    // Orden estable: semanal por índice 0..6, mensual por mes 1..12, diario por fecha asc.
    resultBuckets.sort((a, b) => {
      if (params.granularidad === "diario") return a.key.localeCompare(b.key);
      return Number(a.key) - Number(b.key);
    });

    const anios = await getAniosConReservas();
    return { ok: true, anios, total, buckets: resultBuckets };
  } catch (err) {
    console.error("[analitica-origen] getOrigenReservas:", err);
    return empty;
  }
}
