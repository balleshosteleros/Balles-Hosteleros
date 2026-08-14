"use server";

/**
 * Datos para la pestaña ANALÍTICA de Modelos.
 *
 * Solo se leen modelos con `casillas_origen = 'gestoria'`: las gráficas se
 * construyen sobre lo REALMENTE PRESENTADO ante Hacienda, nunca sobre borradores
 * o propuestas del motor interno, que falsearían la serie histórica.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import type { CasillasMap, ModeloPeriodo } from "../types/modelos";

/** Un trimestre de IVA (modelo 303) tal y como se presentó. */
export interface PuntoIva {
  etiqueta: string;
  ejercicio: number;
  periodo: ModeloPeriodo;
  /** Base imponible de ventas (01 + 04 + 07). */
  baseVentas: number;
  /** IVA repercutido: cuota devengada (casilla 27). */
  ivaRepercutido: number;
  /** IVA soportado deducible (casilla 45). */
  ivaDeducible: number;
  /** Resultado del régimen general (casilla 46). */
  resultado: number;
}

/** Un trimestre de retenciones (modelo 111) tal y como se presentó. */
export interface PuntoRetenciones {
  etiqueta: string;
  ejercicio: number;
  periodo: ModeloPeriodo;
  /** Percepciones de trabajo (casilla 01). */
  percepciones: number;
  /** Retenciones practicadas (casilla 03). */
  retenciones: number;
  /** Nº de perceptores (casilla 02). */
  perceptores: number;
  /** Tipo medio de retención en % sobre las percepciones. */
  tipoMedio: number;
}

export interface ResumenAnalitica {
  iva: PuntoIva[];
  retenciones: PuntoRetenciones[];
  /** Nº de modelos presentados con datos reales, por ejercicio. */
  cobertura: Array<{ ejercicio: number; presentados: number }>;
  /** Total de IVA a ingresar y de retenciones del último ejercicio cerrado. */
  totales: {
    ejercicio: number | null;
    ivaResultado: number;
    retenciones: number;
    baseVentas: number;
  } | null;
}

const ORDEN: Record<string, number> = { T1: 1, T2: 2, T3: 3, T4: 4, ANUAL: 5 };
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getAnaliticaModelos(): Promise<{
  ok: boolean;
  data: ResumenAnalitica;
  error?: string;
}> {
  const vacio: ResumenAnalitica = { iva: [], retenciones: [], cobertura: [], totales: null };
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: vacio, error: "No autenticado" };

    const { data, error } = await supabase
      .from("modelos_aeat")
      .select("tipo, periodo, ejercicio, casillas")
      .eq("empresa_id", empresaId)
      .eq("casillas_origen", "gestoria")
      .order("ejercicio", { ascending: true });
    if (error) throw error;

    const filas = (data ?? []) as Array<{
      tipo: string;
      periodo: ModeloPeriodo;
      ejercicio: number;
      casillas: CasillasMap | null;
    }>;

    const ordenar = <T extends { ejercicio: number; periodo: ModeloPeriodo }>(a: T, b: T) =>
      a.ejercicio - b.ejercicio || (ORDEN[a.periodo] ?? 9) - (ORDEN[b.periodo] ?? 9);

    const iva: PuntoIva[] = filas
      .filter((f) => f.tipo === "303")
      .map((f) => {
        const c = f.casillas ?? {};
        return {
          etiqueta: `${f.periodo} ${f.ejercicio}`,
          ejercicio: f.ejercicio,
          periodo: f.periodo,
          baseVentas: round2((c["01"] ?? 0) + (c["04"] ?? 0) + (c["07"] ?? 0)),
          ivaRepercutido: round2(c["27"] ?? 0),
          ivaDeducible: round2(c["45"] ?? 0),
          resultado: round2(c["46"] ?? 0),
        };
      })
      .sort(ordenar);

    const retenciones: PuntoRetenciones[] = filas
      .filter((f) => f.tipo === "111")
      .map((f) => {
        const c = f.casillas ?? {};
        const percepciones = round2(c["01"] ?? 0);
        const retenido = round2(c["03"] ?? 0);
        return {
          etiqueta: `${f.periodo} ${f.ejercicio}`,
          ejercicio: f.ejercicio,
          periodo: f.periodo,
          percepciones,
          retenciones: retenido,
          perceptores: c["02"] ?? 0,
          // Sin percepciones no hay tipo medio: 0 dividido entre 0 sería NaN.
          tipoMedio: percepciones > 0 ? round2((retenido / percepciones) * 100) : 0,
        };
      })
      .sort(ordenar);

    const porEjercicio = new Map<number, number>();
    for (const f of filas) porEjercicio.set(f.ejercicio, (porEjercicio.get(f.ejercicio) ?? 0) + 1);
    const cobertura = [...porEjercicio.entries()]
      .map(([ejercicio, presentados]) => ({ ejercicio, presentados }))
      .sort((a, b) => a.ejercicio - b.ejercicio);

    // Último ejercicio con 4 trimestres de IVA presentados: el único con el que
    // se puede dar un total anual sin inducir a error comparando años a medias.
    const completos = [...porEjercicio.keys()]
      .filter((ej) => iva.filter((p) => p.ejercicio === ej).length === 4)
      .sort((a, b) => b - a);
    const ejercicioTotal = completos[0] ?? null;

    const totales = ejercicioTotal
      ? {
          ejercicio: ejercicioTotal,
          ivaResultado: round2(
            iva.filter((p) => p.ejercicio === ejercicioTotal).reduce((s, p) => s + p.resultado, 0),
          ),
          retenciones: round2(
            retenciones
              .filter((p) => p.ejercicio === ejercicioTotal)
              .reduce((s, p) => s + p.retenciones, 0),
          ),
          baseVentas: round2(
            iva.filter((p) => p.ejercicio === ejercicioTotal).reduce((s, p) => s + p.baseVentas, 0),
          ),
        }
      : null;

    return { ok: true, data: { iva, retenciones, cobertura, totales } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] getAnaliticaModelos:", msg);
    return { ok: false, data: vacio, error: msg };
  }
}
