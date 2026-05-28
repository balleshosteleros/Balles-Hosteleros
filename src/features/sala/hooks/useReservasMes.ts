"use client";

import { useEffect, useMemo, useState } from "react";
import { listReservasRango } from "@/features/sala/actions/reservas-actions";
import { getReservasConfig } from "@/features/sala/actions/reservas-config-actions";
import { listReservasExcepciones } from "@/features/sala/actions/reservas-excepciones-actions";
import {
  cupoEfectivo,
} from "@/features/sala/lib/reserva-limites";
import type {
  EmpresaReservasConfig,
  EmpresaReservasExcepcion,
  TurnoReserva,
} from "@/features/sala/data/reservas";

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

export function useReservasMes(anio: number, mes0: number, aforoPorTurno: number) {
  const [reservas, setReservas] = useState<Array<{ fecha: string; turno: string; personas: number; estado: string }>>([]);
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [excepciones, setExcepciones] = useState<EmpresaReservasExcepcion[]>([]);
  const [loading, setLoading] = useState(true);
  const { desde, hasta } = useMemo(() => rangoMes(anio, mes0), [anio, mes0]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    (async () => {
      const [r, c, e] = await Promise.all([
        listReservasRango(desde, hasta),
        getReservasConfig(),
        listReservasExcepciones({ desde, hasta }),
      ]);
      if (cancelado) return;
      if (r.ok) setReservas(r.data as typeof reservas);
      if (c.ok) setConfig(c.data);
      if (e.ok) setExcepciones(e.data);
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [desde, hasta]);

  /** Agrega métricas por (fecha, turno). Excluye estados no activos. */
  const metricasPorFecha = useMemo(() => {
    const EXCLUIDOS = new Set(["CANCELADA", "NO_SHOW", "LIBERADA"]);
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
            cupo: cupoEfectivo(config, excepciones, key, "COMIDA" as TurnoReserva),
          },
          cena: {
            personas: 0,
            reservas: 0,
            cupo: cupoEfectivo(config, excepciones, key, "CENA" as TurnoReserva),
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
  }, [reservas, config, excepciones]);

  /** Devuelve métricas para una fecha (con valores 0 si no hay reservas). */
  function metricasFecha(fecha: string): MetricasDia {
    return (
      metricasPorFecha[fecha] ?? {
        fecha,
        comida: {
          personas: 0,
          reservas: 0,
          cupo: cupoEfectivo(config, excepciones, fecha, "COMIDA"),
        },
        cena: {
          personas: 0,
          reservas: 0,
          cupo: cupoEfectivo(config, excepciones, fecha, "CENA"),
        },
      }
    );
  }

  // Totales del mes
  const totales = useMemo(() => {
    let personas = 0;
    let reservasN = 0;
    for (const k in metricasPorFecha) {
      personas += metricasPorFecha[k].comida.personas + metricasPorFecha[k].cena.personas;
      reservasN += metricasPorFecha[k].comida.reservas + metricasPorFecha[k].cena.reservas;
    }
    return { personas, reservas: reservasN };
  }, [metricasPorFecha]);

  return {
    loading,
    config,
    excepciones,
    metricasFecha,
    totales,
    aforoPorTurno,
  };
}
