/**
 * Lógica pura para resolver los límites efectivos de reservas (cupo y máx pax)
 * en una fecha y turno concretos.
 *
 * Prioridad de resolución (de mayor a menor):
 *   1. Excepción por fecha concreta (empresa_reservas_excepciones)
 *   2. Día de la semana (empresa_reservas_config.<dia>_<metrica>_<turno>)
 *   3. General (empresa_reservas_config.general_<metrica>_<turno>)
 *
 * Cualquier valor null en un nivel hace que se caiga al siguiente. Si todos
 * son null, devuelve null (sin límite efectivo).
 *
 * Se importa desde cliente y servidor — NO duplicar lógica.
 */

import {
  type EmpresaReservasConfig,
  type EmpresaReservasExcepcion,
  type TurnoReserva,
  type DiaSemanaKey,
  type MetricaLimite,
  type TurnoKey,
  DIA_SEMANA_KEY,
} from "@/features/sala/data/reservas";
import type { EmpresaReservasRegla } from "@/features/sala/reglas/data/reglas";
import { resolverValorEfectivo as resolverDesdeReglas } from "@/features/sala/reglas/lib/resolver";

/** Devuelve la clave del día (lun..dom) para una fecha YYYY-MM-DD. */
export function diaSemanaKey(fechaISO: string): DiaSemanaKey {
  const d = new Date(fechaISO + "T12:00:00");
  return DIA_SEMANA_KEY[d.getDay()];
}

/** Mapea TurnoReserva al sufijo usado en BD (comida/cena). DIA_COMPLETO no aplica. */
export function turnoKey(turno: TurnoReserva): TurnoKey | null {
  if (turno === "COMIDA") return "comida";
  if (turno === "CENA") return "cena";
  return null;
}

/**
 * Resuelve el valor efectivo de una métrica (cupo o maxpax) en un día/turno.
 * Devuelve null si no hay configuración aplicable en ningún nivel.
 */
export function valorEfectivo(
  config: EmpresaReservasConfig | null,
  excepciones: EmpresaReservasExcepcion[],
  fechaISO: string,
  turno: TurnoReserva,
  metrica: MetricaLimite,
): number | null {
  const tk = turnoKey(turno);
  if (!tk) return null;

  // 1. Excepción puntual
  const exc = excepciones.find((e) => e.fecha === fechaISO);
  if (exc) {
    const excVal =
      metrica === "cupo"
        ? tk === "comida" ? exc.cupoComida : exc.cupoCena
        : tk === "comida" ? exc.maxpaxComida : exc.maxpaxCena;
    if (excVal != null) return excVal;
  }

  if (!config) return null;

  // 2. Día de la semana
  const dk = diaSemanaKey(fechaISO);
  const semKey = `${dk}_${metrica}_${tk}` as const;
  const semVal = config[semKey];
  if (semVal != null) return semVal;

  // 3. General
  const genKey =
    metrica === "cupo"
      ? tk === "comida" ? "generalCupoComida" : "generalCupoCena"
      : tk === "comida" ? "generalMaxpaxComida" : "generalMaxpaxCena";
  const genVal = config[genKey as keyof EmpresaReservasConfig] as number | null;
  return genVal ?? null;
}

/** Atajo: cupo de reservas efectivo. */
export function cupoEfectivo(
  config: EmpresaReservasConfig | null,
  excepciones: EmpresaReservasExcepcion[],
  fechaISO: string,
  turno: TurnoReserva,
): number | null {
  return valorEfectivo(config, excepciones, fechaISO, turno, "cupo");
}

/** Atajo: máximo de personas por reserva efectivo. */
export function maxpaxEfectivo(
  config: EmpresaReservasConfig | null,
  excepciones: EmpresaReservasExcepcion[],
  fechaISO: string,
  turno: TurnoReserva,
): number | null {
  return valorEfectivo(config, excepciones, fechaISO, turno, "maxpax");
}

// ---------------------------------------------------------------------------
// Variantes basadas en reglas (PRP-050) — preferidas sobre las viejas.
// ---------------------------------------------------------------------------

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
