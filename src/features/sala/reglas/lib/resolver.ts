/**
 * Resolver puro TS para reglas con vigencia. Misma prioridad determinista que
 * el resolver SQL `resolver_valor_efectivo`:
 *
 *   1. fechas_extra contiene la fecha
 *   2. rango [fecha_desde, fecha_hasta] incluye la fecha
 *   3. dias_semana incluye el ISODOW de la fecha
 *   4. regla general (sin ningún campo de vigencia)
 *
 * Desempates: prioridad DESC, createdAt DESC.
 *
 * El resultado debe ser bit-a-bit equivalente al SQL — cualquier divergencia
 * es un bug.
 */

import {
  type EmpresaReservasRegla,
  type MetricaRegla,
  jsDayToIsoDow,
} from "../data/reglas";

export type TurnoConcreto = "COMIDA" | "CENA";

/** Score por tipo de vigencia (más alto = más específico). */
function scoreVigencia(r: EmpresaReservasRegla, fechaISO: string): number {
  if (r.fechasExtra && r.fechasExtra.includes(fechaISO)) return 4;
  if (r.fechaDesde && r.fechaHasta && fechaISO >= r.fechaDesde && fechaISO <= r.fechaHasta) return 3;
  if (r.diasSemana) {
    const iso = jsDayToIsoDow(new Date(fechaISO + "T00:00:00").getDay());
    if (r.diasSemana.includes(iso)) return 2;
  }
  if (r.fechasExtra === null && r.fechaDesde === null && r.diasSemana === null) return 1;
  return 0; // No aplica
}

/**
 * Devuelve la regla ganadora para (fecha, turno, métrica), o null si ninguna aplica.
 */
export function resolverRegla(
  reglas: EmpresaReservasRegla[],
  fechaISO: string,
  turno: TurnoConcreto,
  metrica: MetricaRegla,
): EmpresaReservasRegla | null {
  let mejor: EmpresaReservasRegla | null = null;
  let mejorScore = 0;
  let mejorPrioridad = -Infinity;
  let mejorCreatedAt = "";

  for (const r of reglas) {
    if (!r.activo) continue;
    if (r.metrica !== metrica) continue;
    if (r.turno !== turno && r.turno !== "AMBOS") continue;
    const score = scoreVigencia(r, fechaISO);
    if (score === 0) continue;
    if (
      score > mejorScore ||
      (score === mejorScore && r.prioridad > mejorPrioridad) ||
      (score === mejorScore && r.prioridad === mejorPrioridad && r.createdAt > mejorCreatedAt)
    ) {
      mejor = r;
      mejorScore = score;
      mejorPrioridad = r.prioridad;
      mejorCreatedAt = r.createdAt;
    }
  }
  return mejor;
}

/**
 * Devuelve el valor numérico ganador o null si ninguna regla aplica.
 */
export function resolverValorEfectivo(
  reglas: EmpresaReservasRegla[],
  fechaISO: string,
  turno: TurnoConcreto,
  metrica: MetricaRegla,
): number | null {
  const r = resolverRegla(reglas, fechaISO, turno, metrica);
  return r?.valor ?? null;
}
