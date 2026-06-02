/**
 * Lógica de límites efectivos de reservas (cupo y máx pax) basada en reglas
 * con vigencia (PRP-050).
 *
 * El resolver vive en `src/features/sala/reglas/lib/resolver.ts` con
 * implementación TS gemela al SQL `resolver_valor_efectivo`. Aquí solo
 * exponemos atajos por métrica y la validación de antelación, que sigue
 * leyendo `empresa_reservas_config` (campos `antelacion_*`).
 */

import type {
  EmpresaReservasConfig,
  TurnoReserva,
} from "@/features/sala/data/reservas";
import type { EmpresaReservasRegla } from "@/features/sala/reglas/data/reglas";
import { resolverValorEfectivo as resolverDesdeReglas } from "@/features/sala/reglas/lib/resolver";

/** Cupo efectivo a partir del array de reglas hidratado para la empresa. */
export function cupoEfectivoDesdeReglas(
  reglas: EmpresaReservasRegla[],
  fechaISO: string,
  turno: TurnoReserva,
): number | null {
  if (turno !== "COMIDA" && turno !== "CENA") return null;
  return resolverDesdeReglas(reglas, fechaISO, turno, "cupo");
}

/** Máximo de personas por reserva a partir del array de reglas. */
export function maxpaxEfectivoDesdeReglas(
  reglas: EmpresaReservasRegla[],
  fechaISO: string,
  turno: TurnoReserva,
): number | null {
  if (turno !== "COMIDA" && turno !== "CENA") return null;
  return resolverDesdeReglas(reglas, fechaISO, turno, "maxpax");
}

/** Verifica si una fecha cumple las reglas de antelación (min/max). */
export function dentroDeAntelacion(
  config: EmpresaReservasConfig | null,
  fechaISO: string,
  horaHHMM: string,
  ahora: Date = new Date(),
): { ok: boolean; motivo?: "antelacion_min" | "antelacion_max" } {
  if (!config) return { ok: true };
  const target = new Date(`${fechaISO}T${horaHHMM.length === 5 ? horaHHMM : horaHHMM.slice(0, 5)}:00`);
  const diffMs = target.getTime() - ahora.getTime();
  const diffMin = diffMs / 6e4;
  const diffD = diffMs / 864e5;
  if (diffMin < (config.antelacionMinMinutos ?? 0)) return { ok: false, motivo: "antelacion_min" };
  if (diffD > (config.antelacionMaxDias ?? 365)) return { ok: false, motivo: "antelacion_max" };
  return { ok: true };
}
