"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser, getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { claveDiaEnZona } from "@/features/empresa/lib/zona-horaria";
import { leerTodas } from "@/shared/lib/supabase-paginado";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarOrigen, type OrigenBucket } from "@/features/sala/data/origenes";
import type { CampoFecha, FiltroEstado } from "@/features/sala/actions/analitica-origen-actions";

/**
 * Cada cuánto se agrupa la tendencia.
 *
 * No es lo mismo que la rejilla de quesitos de arriba, que compara los meses
 * DE UN AÑO entre sí ("¿qué mes trae más gente?"). Aquí el eje es el tiempo
 * corrido: enero-2023, febrero-2023… hasta hoy, para ver si un canal sube o
 * baja a lo largo de los años.
 */
export type PeriodoTendencia = "mes" | "trimestre" | "anio";

export type PuntoTendencia = {
  /** Clave ordenable: "2025-03", "2025-T1", "2025". */
  key: string;
  /** Rótulo corto para el eje: "Mar 25", "T1 25", "2025". */
  label: string;
  total: number;
  /** Reservas por canal en este periodo. Solo los canales con alguna. */
  porCanal: Record<string, number>;
};

export type CanalResumen = {
  canal: OrigenBucket;
  label: string;
  total: number;
  porcentaje: number;
  /**
   * Variación del último periodo cerrado frente al anterior, en %.
   * `null` cuando no hay periodo anterior con el que comparar (o venía de 0,
   * donde un porcentaje no significa nada).
   */
  variacion: number | null;
};

export type TendenciaCanalesResult = {
  ok: boolean;
  /** Serie temporal completa, de más antiguo a más reciente. */
  puntos: PuntoTendencia[];
  /**
   * Rótulos de los dos periodos que compara `variacion`. Son el último periodo
   * CERRADO y el anterior — nunca el que está en curso, que saldría a medias.
   */
  comparacion: { actual: string; previo: string } | null;
  /** Totales del rango entero, de mayor a menor. */
  resumen: CanalResumen[];
  total: number;
  /** Años con reservas, para el selector de rango. */
  anios: number[];
};

const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Clave y rótulo del periodo al que pertenece un día natural. */
function periodoDe(iso: string, periodo: PeriodoTendencia): { key: string; label: string } | null {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return null;
  const yy = String(y).slice(2);
  if (periodo === "anio") return { key: String(y), label: String(y) };
  if (periodo === "trimestre") {
    const t = Math.floor((m - 1) / 3) + 1;
    return { key: `${y}-T${t}`, label: `T${t} ${yy}` };
  }
  return { key: `${y}-${String(m).padStart(2, "0")}`, label: `${MESES_CORTOS[m - 1]} ${yy}` };
}

/**
 * Un Ticket comprado y sin canjear es una VENTA, no una reserva: nadie ha
 * pedido mesa para un día concreto. Mismo criterio que la analítica de arriba,
 * para que los dos paneles cuenten lo mismo.
 */
function esCompraTicketSinReserva(r: { es_ticket: boolean | null; fecha: string | null }): boolean {
  return Boolean(r.es_ticket) && !r.fecha;
}

/**
 * Evolución de cada canal a lo largo del tiempo.
 *
 * Lee TODAS las reservas del rango con `leerTodas`: sin paginar, Supabase corta
 * en 1.000 filas en silencio y los años con más movimiento saldrían recortados
 * —justo los que interesa mirar.
 */
export async function getTendenciaCanales(params: {
  desdeAnio: number;
  hastaAnio: number;
  periodo: PeriodoTendencia;
  campoFecha: CampoFecha;
  estado?: FiltroEstado;
}): Promise<TendenciaCanalesResult> {
  const empty: TendenciaCanalesResult = {
    ok: false, puntos: [], resumen: [], total: 0, anios: [], comparacion: null,
  };
  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return empty;
    const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
    if (!empresaId) return empty;

    const tz = await getZonaHorariaEmpresa(supabase as unknown as SupabaseClient, empresaId);
    const porCreacion = params.campoFecha === "created_at";
    const estadoFiltro = params.estado ?? "TODOS";

    const rows = await leerTodas<{
      origen: string | null;
      fecha: string | null;
      created_at: string | null;
      es_ticket: boolean | null;
    }>(() => {
      let q = supabase
        .from("reservas")
        .select("origen, fecha, created_at, es_ticket")
        .eq("empresa_id", empresaId);

      if (porCreacion) {
        // `created_at` es un instante UTC y el año que se pide es el año
        // NATURAL de la empresa: el rango se abre un día por cada lado y el
        // recorte fino se hace luego con la fecha ya traducida a su zona.
        q = q
          .gte("created_at", `${params.desdeAnio - 1}-12-31T00:00:00Z`)
          .lte("created_at", `${params.hastaAnio + 1}-01-01T23:59:59Z`)
          .order("created_at", { ascending: true });
      } else {
        q = q
          .gte("fecha", `${params.desdeAnio}-01-01`)
          .lte("fecha", `${params.hastaAnio}-12-31`)
          .order("fecha", { ascending: true });
      }
      if (estadoFiltro !== "TODOS") q = q.eq("estado", estadoFiltro);
      return q;
    });

    // periodo -> canal -> nº reservas
    const porPeriodo = new Map<string, { label: string; counts: Map<OrigenBucket, number> }>();
    const totales = new Map<OrigenBucket, number>();
    let total = 0;

    for (const r of rows) {
      if (esCompraTicketSinReserva(r)) continue;

      const fechaIso = porCreacion
        ? claveDiaEnZona(r.created_at, tz)
        : (r.fecha ?? "").slice(0, 10);
      if (!fechaIso || fechaIso.length < 10) continue;

      const anio = Number(fechaIso.slice(0, 4));
      if (anio < params.desdeAnio || anio > params.hastaAnio) continue;

      const p = periodoDe(fechaIso, params.periodo);
      if (!p) continue;

      let bucket = porPeriodo.get(p.key);
      if (!bucket) {
        bucket = { label: p.label, counts: new Map() };
        porPeriodo.set(p.key, bucket);
      }
      const canal = normalizarOrigen(r.origen);
      bucket.counts.set(canal, (bucket.counts.get(canal) ?? 0) + 1);
      totales.set(canal, (totales.get(canal) ?? 0) + 1);
      total++;
    }

    const puntos: PuntoTendencia[] = Array.from(porPeriodo.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, b]) => {
        const porCanal: Record<string, number> = {};
        let t = 0;
        b.counts.forEach((n, canal) => {
          porCanal[canal] = n;
          t += n;
        });
        return { key, label: b.label, total: t, porCanal };
      });

    // Variación del último periodo CERRADO frente al anterior.
    //
    // Nunca contra el periodo en curso ni contra los futuros: la serie llega
    // hasta la última reserva anotada, que puede ser de dentro de dos meses.
    // Comparar septiembre (a medias) u octubre (con una reserva suelta) contra
    // el mes completo anterior daba "-97%" en todos los canales y parecía un
    // desplome cuando lo único que pasa es que ese periodo aún no ha ocurrido.
    const hoy = new Date();
    const claveHoy = periodoDe(
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`,
      params.periodo,
    )?.key;
    const cerrados = claveHoy ? puntos.filter((p) => p.key < claveHoy) : puntos;
    const ultimo = cerrados.at(-1);
    const previo = cerrados.at(-2);

    const resumen: CanalResumen[] = Array.from(totales.entries())
      .map(([canal, n]) => {
        const a = previo?.porCanal[canal] ?? 0;
        const b = ultimo?.porCanal[canal] ?? 0;
        // Sin periodo anterior, o viniendo de cero, un porcentaje no dice nada:
        // "subió un 100%" de 0 a 1 reserva engaña más que informa.
        //
        // Y con una base ridícula tampoco: walk-in pasó de 1 reserva en 2024 a
        // 1.811 en 2025 y salía "+181.000%", que no es crecimiento sino que
        // antes no se registraban. Por debajo de 5 reservas en el periodo
        // anterior no hay porcentaje que signifique algo.
        const BASE_MINIMA = 5;
        const variacion =
          previo && a >= BASE_MINIMA ? Math.round(((b - a) / a) * 100) : null;
        return {
          canal,
          label: canal,
          total: n,
          porcentaje: total > 0 ? Math.round((n / total) * 1000) / 10 : 0,
          variacion,
        };
      })
      .sort((x, y) => y.total - x.total || x.canal.localeCompare(y.canal));

    // Años con reservas: se piden aparte porque el rango elegido puede no
    // abarcarlos todos y el selector tiene que ofrecerlos igual.
    const { data: aniosRows } = await supabase
      .from("reservas")
      .select("fecha")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: true })
      .limit(1);
    const { data: aniosMax } = await supabase
      .from("reservas")
      .select("fecha")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false })
      .limit(1);

    const primera = (aniosRows?.[0] as { fecha: string | null } | undefined)?.fecha;
    const ultima = (aniosMax?.[0] as { fecha: string | null } | undefined)?.fecha;
    const yIni = primera ? Number(primera.slice(0, 4)) : new Date().getFullYear();
    const yFin = ultima ? Number(ultima.slice(0, 4)) : new Date().getFullYear();
    const anios: number[] = [];
    for (let y = yFin; y >= yIni; y--) anios.push(y);

    const comparacion = ultimo && previo
      ? { actual: ultimo.label, previo: previo.label }
      : null;

    return { ok: true, puntos, resumen, total, anios, comparacion };
  } catch (err) {
    console.error("[tendencia-canales] getTendenciaCanales:", err);
    return empty;
  }
}
