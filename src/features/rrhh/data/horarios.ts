import type { CSSProperties } from "react";

export interface TurnoTramo {
  inicio: string;
  fin: string;
}

// Tipo de jornada al crear el turno (estilo Sésamo):
//  - fijo: días + tramo(s) horario(s) (partido = 2 tramos).
//  - flexible: días + horas objetivo por día (flexHoras).
export type TipoJornada = "fijo" | "flexible";

export interface Turno {
  id: string;
  nombre: string;
  codigo: string;
  tramos: TurnoTramo[];
  /** Color hex del departamento del turno (fuente única del tinte). */
  colorHex: string;
  activo: boolean;
  centro?: string;
  departamento?: string;
  // Jornada Fijo/Flexible (esencial primero).
  tipoJornada: TipoJornada;
  dias: DiaSemana[];
  /**
   * Horas/día del flexible (modelo nuevo, sin días): el turno solo indica horas
   * y el día lo pone el patrón o la asignación directa. `null` en los fijos y en
   * flexibles legacy que aún usan `flexHoras`.
   */
  flexHorasDia: number | null;
  /** Legacy: horas objetivo por día concreto (flexibles antiguos). */
  flexHoras: Partial<Record<DiaSemana, number>>;
  // Versionado (PRP-053): cada turno es una versión de una familia.
  familiaId: string;
  version: number;
  esOficial: boolean;
  vigenteDesde?: string; // ISO date desde la que rige esta versión
  vigenteHasta?: string | null; // ISO date fin de validez; null/undef = sin fin
}

// ─── Color por departamento (tinte de los turnos en el cuadrante) ─────────
// El color del departamento (hex) es la fuente única del tinte de un turno:
// todos los turnos del mismo departamento se pintan igual. Estos helpers
// derivan estilos legibles (fondo claro + texto/realce del propio color) a
// partir del hex.

export const COLOR_DEPARTAMENTO_FALLBACK = "#6b7280";

/** Normaliza un hex a "#rrggbb"; cae al neutro si no es válido. */
function hexValido(hex?: string | null): string {
  const v = (hex ?? "").trim();
  if (/^#([0-9a-fA-F]{6})$/.test(v)) return v.toLowerCase();
  if (/^#([0-9a-fA-F]{3})$/.test(v)) {
    return (
      "#" +
      v
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    ).toLowerCase();
  }
  return COLOR_DEPARTAMENTO_FALLBACK;
}

/** Estilo del pill de turno: fondo tenue del color + texto del color oscuro. */
export function pillStyleDepartamento(hex?: string | null): CSSProperties {
  const c = hexValido(hex);
  return {
    backgroundColor: `${c}26`, // ~15% alpha → pastel
    color: c,
    boxShadow: `inset 0 0 0 1px ${c}33`,
  };
}

/** Estilo de un punto/badge sólido del color del departamento. */
export function dotStyleDepartamento(hex?: string | null): CSSProperties {
  return { backgroundColor: hexValido(hex) };
}

export type DiaSemana = "L" | "M" | "X" | "J" | "V" | "S" | "D";

// Orden canónico de la semana (lunes → domingo) para selectores de días.
export const DIAS_SEMANA: DiaSemana[] = ["L", "M", "X", "J", "V", "S", "D"];

export const DIA_SEMANA_LABEL: Record<DiaSemana, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
  D: "Domingo",
};

export interface Descanso {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  remunerado: boolean;
  cuandoFichar: "cualquier" | "intervalo";
  intervaloInicio: string;
  intervaloFin: string;
  duracionTipo: "sin_limite" | "duracion";
  duracionMinutos?: number;
  dias: DiaSemana[];
  turnos: string[];
  activo: boolean;
}

// Datos de turnos, descansos, tipos fichaje y tipos ausencia ahora
// viven en Supabase (rrhh_turnos / rrhh_descansos / tipos_fichaje /
// tipos_ausencia). Este archivo conserva tipos y helpers.

export interface TipoFichaje {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string;
  computaTiempo: boolean;
  activo: boolean;
}

export interface TipoAusencia {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  requiereAprobacion: boolean;
  requiereJustificante: boolean;
  descuentaJornada: boolean;
  reflejaCalendario: boolean;
  color: string;
  activo: boolean;
}

export function formatTramo(tramo: TurnoTramo): string {
  return `${tramo.inicio} - ${tramo.fin}`;
}

export function formatHoras(horas: number): string {
  if (horas <= 0) return "0h";
  // 8 → "8h"; 8.5 → "8h 30min".
  const totalMin = Math.round(horas * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

export function formatTurnoHorario(turno: Turno): string {
  if (turno.tipoJornada === "flexible") {
    // Modelo nuevo (sin días): el turno solo indica horas/día.
    if (turno.flexHorasDia != null) {
      return `${formatHoras(turno.flexHorasDia)}/día`;
    }
    return `${formatHoras(totalHorasSemana(turno))}/sem`;
  }
  return turno.tramos.map(formatTramo).join(" / ");
}

function minutosTramo(tramo: TurnoTramo): number {
  const [hi, mi] = tramo.inicio.split(":").map(Number);
  const [hf, mf] = tramo.fin.split(":").map(Number);
  const inicio = hi * 60 + mi;
  let fin = hf * 60 + mf;
  if (fin < inicio) fin += 24 * 60;
  return fin - inicio;
}

export function calcularDuracionTurno(turno: Turno): number {
  const min = turno.tramos.reduce((acc, t) => acc + minutosTramo(t), 0);
  return Math.round((min / 60) * 100) / 100;
}

// Total de horas a la semana del turno:
//  - fijo: duración de los tramos × número de días activos.
//  - flexible: suma de las horas objetivo de los días activos.
// Si un fijo no tiene días marcados (turnos antiguos), cae a la duración
// de un día para no mostrar 0.
export function totalHorasSemana(turno: Turno): number {
  if (turno.tipoJornada === "flexible") {
    // Modelo nuevo (sin días): no hay semana, el objetivo es por día.
    if (turno.flexHorasDia != null) {
      return Math.round(turno.flexHorasDia * 100) / 100;
    }
    const total = turno.dias.reduce(
      (acc, d) => acc + (turno.flexHoras[d] ?? 0),
      0,
    );
    return Math.round(total * 100) / 100;
  }
  const duracionDia = calcularDuracionTurno(turno);
  const nDias = turno.dias.length || 1;
  return Math.round(duracionDia * nDias * 100) / 100;
}
