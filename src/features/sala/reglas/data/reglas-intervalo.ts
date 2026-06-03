/**
 * Reglas de intervalo horario para reservas: limitan cuántas reservas o
 * personas pueden empezar dentro de una franja [hora_inicio..hora_fin]
 * (ambos inclusivos), opcionalmente acotadas a un turno y con vigencia.
 *
 * Modelo y selector de vigencia se reusan de `./reglas` (mismo patrón que
 * cupo/maxpax del PRP-050).
 */

import type { TurnoRegla, VigenciaSpec } from "./reglas";

export type MetricaIntervalo = "max_reservas" | "max_personas";
export const METRICAS_INTERVALO: MetricaIntervalo[] = [
  "max_reservas",
  "max_personas",
];

export const METRICA_INTERVALO_LABELS: Record<MetricaIntervalo, string> = {
  max_reservas: "Máximo de reservas por intervalo",
  max_personas: "Máximo de personas por intervalo",
};

export const METRICA_INTERVALO_LABELS_CORTOS: Record<MetricaIntervalo, string> = {
  max_reservas: "Máx. reservas",
  max_personas: "Máx. personas",
};

export const METRICA_INTERVALO_UNIDADES: Record<MetricaIntervalo, string> = {
  max_reservas: "reservas",
  max_personas: "personas",
};

export interface EmpresaReservasIntervaloRegla {
  id: string;
  empresaId: string;
  metrica: MetricaIntervalo;
  valor: number;
  horaInicio: string; // "HH:MM" o "HH:MM:SS"
  horaFin: string;
  turno: TurnoRegla;
  fechaDesde: string | null;
  fechaHasta: string | null;
  diasSemana: number[] | null;
  fechasExtra: string[] | null;
  prioridad: number;
  nombre: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IntervaloReglaInput {
  metrica: MetricaIntervalo;
  valor: number;
  horaInicio: string; // "HH:MM"
  horaFin: string;
  turno: TurnoRegla;
  vigencia: VigenciaSpec;
  nombre?: string | null;
  prioridad?: number;
}

export interface IntervaloReglaRow {
  id: string;
  empresa_id: string;
  metrica: MetricaIntervalo;
  valor: number;
  hora_inicio: string;
  hora_fin: string;
  turno: TurnoRegla;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  dias_semana: number[] | null;
  fechas_extra: string[] | null;
  prioridad: number;
  nombre: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export function rowToIntervaloRegla(r: IntervaloReglaRow): EmpresaReservasIntervaloRegla {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    metrica: r.metrica,
    valor: r.valor,
    horaInicio: r.hora_inicio.slice(0, 5),
    horaFin: r.hora_fin.slice(0, 5),
    turno: r.turno,
    fechaDesde: r.fecha_desde,
    fechaHasta: r.fecha_hasta,
    diasSemana: r.dias_semana,
    fechasExtra: r.fechas_extra,
    prioridad: r.prioridad,
    nombre: r.nombre,
    activo: r.activo,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Normaliza "HH:MM" o "H:M" → "HH:MM". Devuelve null si no es válida. */
export function normalizarHora(h: string): string | null {
  if (!h) return null;
  const m = h.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return null;
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
