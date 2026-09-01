"use client";

import { useEffect, useMemo, useState } from "react";
import { listReservasRango } from "@/features/sala/actions/reservas-actions";
import { getReservasConfig } from "@/features/sala/actions/reservas-config-actions";
import { listReglasReservas } from "@/features/sala/reglas/actions/reglas-actions";
import { listHorariosExcepciones } from "@/features/sala/actions/reservas-horarios-excepciones-actions";
import {
  cupoEfectivoDesdeReglas,
} from "@/features/sala/lib/reserva-limites";
import { resolveHorarioReservas, type HorarioResuelto } from "@/features/sala/lib/horario-resolver";
import type {
  EmpresaReservasConfig,
  EmpresaReservasHorarioExcepcion,
  TurnoReserva,
} from "@/features/sala/data/reservas";
import { ESTADOS_NO_ASISTEN } from "@/features/sala/data/reservas";
import type { EmpresaReservasRegla } from "@/features/sala/reglas/data/reglas";

export interface MetricasTurno {
  personas: number;
  reservas: number;
  cupo: number | null;
}

export interface MetricasDia {
  fecha: string;
  comida: MetricasTurno;
  cena: MetricasTurno;
}

/** Devuelve YYYY-MM-DD para un Date local (sin TZ shenanigans). */
function isoLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Primer y último día del mes en YYYY-MM-DD. */
export function rangoMes(anio: number, mes0: number): { desde: string; hasta: string } {
  const desde = isoLocal(new Date(anio, mes0, 1));
  const hasta = isoLocal(new Date(anio, mes0 + 1, 0));
  return { desde, hasta };
}

/** Devuelve la rejilla de fechas (incluyendo días de los meses contiguos)
 *  necesaria para renderizar el calendario lunes-domingo. */
export function gridFechasMes(anio: number, mes0: number): string[] {
  const primero = new Date(anio, mes0, 1);
  // Lunes como inicio: getDay() devuelve 0=dom..6=sab; queremos lun=0..dom=6
  const offset = (primero.getDay() + 6) % 7;
  const start = new Date(anio, mes0, 1 - offset);
  const out: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(isoLocal(d));
  }
  return out;
}

export function useReservasMes(
  anio: number,
  mes0: number,
  aforoPorTurno: number,
  /** Cambia este número para forzar una recarga (p. ej. al volver de Configuración). */
  refreshKey = 0,
) {
  const [reservas, setReservas] = useState<Array<{ fecha: string; turno: string; personas: number; estado: string }>>([]);
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [reglas, setReglas] = useState<EmpresaReservasRegla[]>([]);
  const [excepciones, setExcepciones] = useState<EmpresaReservasHorarioExcepcion[]>([]);
  const [loading, setLoading] = useState(true);
  const { desde, hasta } = useMemo(() => rangoMes(anio, mes0), [anio, mes0]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    (async () => {
      const [r, c, rs, ex] = await Promise.all([
        listReservasRango(desde, hasta),
        getReservasConfig(),
        listReglasReservas(),
        listHorariosExcepciones(),
      ]);
      if (cancelado) return;
      if (r.ok) setReservas(r.data as typeof reservas);
      if (c.ok) setConfig(c.data);
      if (rs.ok) setReglas(rs.data);
      if (ex.ok) setExcepciones(ex.data);
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [desde, hasta, refreshKey]);

  /** Agrega métricas por (fecha, turno). Excluye solo a quien no asiste. */
  const metricasPorFecha = useMemo(() => {
    // Antes esta lista estaba escrita a mano e incluía LIBERADA, así que los
    // totales del mes no cuadraban con los contadores del día.
    const EXCLUIDOS = new Set<string>(ESTADOS_NO_ASISTEN);
    const out: Record<string, MetricasDia> = {};
    for (const r of reservas) {
      if (EXCLUIDOS.has(r.estado)) continue;
      const key = r.fecha;
      if (!out[key]) {
        out[key] = {
          fecha: key,
          comida: {
            personas: 0,
            reservas: 0,
            cupo: cupoEfectivoDesdeReglas(reglas, key, "COMIDA" as TurnoReserva),
          },
          cena: {
            personas: 0,
            reservas: 0,
            cupo: cupoEfectivoDesdeReglas(reglas, key, "CENA" as TurnoReserva),
          },
        };
      }
      if (r.turno === "COMIDA") {
        out[key].comida.personas += r.personas ?? 0;
        out[key].comida.reservas += 1;
      } else if (r.turno === "CENA") {
        out[key].cena.personas += r.personas ?? 0;
        out[key].cena.reservas += 1;
      }
    }
    return out;
  }, [reservas, reglas]);

  /** Devuelve métricas para una fecha (con valores 0 si no hay reservas). */
  function metricasFecha(fecha: string): MetricasDia {
    return (
      metricasPorFecha[fecha] ?? {
        fecha,
        comida: {
          personas: 0,
          reservas: 0,
          cupo: cupoEfectivoDesdeReglas(reglas, fecha, "COMIDA"),
        },
        cena: {
          personas: 0,
          reservas: 0,
          cupo: cupoEfectivoDesdeReglas(reglas, fecha, "CENA"),
        },
      }
    );
  }

  // Totales del mes. Se agregan por turno y en global; siempre sobre TODAS las
  // reservas de la empresa en el rango, sin filtrar por local, plano, sala ni
  // zona: los indicadores de cabecera son globales del mes.
  const totales = useMemo(() => {
    let personasComida = 0;
    let reservasComida = 0;
    let personasCena = 0;
    let reservasCena = 0;
    // El grid muestra días de los meses contiguos, pero el total del mes solo
    // cuenta los días que pertenecen realmente al mes mostrado.
    const { desde: ini, hasta: fin } = rangoMes(anio, mes0);
    for (const k in metricasPorFecha) {
      if (k < ini || k > fin) continue;
      personasComida += metricasPorFecha[k].comida.personas;
      reservasComida += metricasPorFecha[k].comida.reservas;
      personasCena   += metricasPorFecha[k].cena.personas;
      reservasCena   += metricasPorFecha[k].cena.reservas;
    }
    return {
      comida: { personas: personasComida, reservas: reservasComida },
      cena:   { personas: personasCena,   reservas: reservasCena },
      personas: personasComida + personasCena,
      reservas: reservasComida + reservasCena,
    };
  }, [metricasPorFecha, anio, mes0]);

  /** Devuelve el horario resuelto (comida + cena) para una fecha. */
  function horarioFecha(fecha: string): { comida: HorarioResuelto; cena: HorarioResuelto } | null {
    if (!config) return null;
    return {
      comida: resolveHorarioReservas(fecha, "comida", config, excepciones),
      cena: resolveHorarioReservas(fecha, "cena", config, excepciones),
    };
  }

  return {
    loading,
    config,
    reglas,
    metricasFecha,
    horarioFecha,
    totales,
    aforoPorTurno,
  };
}
