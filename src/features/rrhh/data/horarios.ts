export interface TurnoTramo {
  inicio: string;
  fin: string;
}

export type TurnoTono = "stone" | "emerald" | "violet" | "rose" | "teal" | "sky" | "amber";

export interface Turno {
  id: string;
  nombre: string;
  codigo: string;
  tramos: TurnoTramo[];
  color: TurnoTono;
  activo: boolean;
  centro?: string;
  departamento?: string;
}

export const TURNO_TONOS: Record<TurnoTono, { pill: string; dot: string; label: string }> = {
  stone: { pill: "bg-stone-200 text-stone-700", dot: "bg-stone-400", label: "Piedra" },
  emerald: { pill: "bg-emerald-200 text-emerald-800", dot: "bg-emerald-400", label: "Esmeralda" },
  violet: { pill: "bg-violet-200 text-violet-800", dot: "bg-violet-500", label: "Violeta" },
  rose: { pill: "bg-rose-200 text-rose-800", dot: "bg-rose-400", label: "Rosa" },
  teal: { pill: "bg-teal-100 text-teal-800", dot: "bg-teal-400", label: "Verde agua" },
  sky: { pill: "bg-sky-100 text-sky-800", dot: "bg-sky-400", label: "Cielo" },
  amber: { pill: "bg-amber-100 text-amber-800", dot: "bg-amber-400", label: "Ámbar" },
};

export type DiaSemana = "L" | "M" | "X" | "J" | "V" | "S" | "D";

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

export function formatTurnoHorario(turno: Turno): string {
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
