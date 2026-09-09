/**
 * La jornada del puesto SALE DEL HORARIO, no se teclea.
 *
 * El horario del puesto es un patrón del catálogo de Horarios: una o varias
 * semanas, y cada día de la semana lleva un turno o está vacío. Ahí ya está todo
 * lo que antes se pedía a mano en la ficha del puesto:
 *
 *   • horas/semana → la suma de las horas de los turnos de la semana
 *   • días libres  → los días sin turno
 *   • jornada      → completa o parcial, según esas horas
 *
 * Pedirlos aparte significaba que la ficha podía decir 40 h mientras el horario
 * montaba 16: dos verdades para el mismo dato, y la que viajaba al contrato y a
 * la gestoría era la tecleada.
 *
 * PATRONES ROTATIVOS: un patrón puede alternar varias semanas (semana 1, semana
 * 2, vuelta a empezar). Las horas del contrato son entonces el PROMEDIO del
 * ciclo, que es como se computa una jornada irregular: quien libra 3 días una
 * semana y 1 la siguiente no tiene ni una jornada ni la otra, tiene la media.
 *
 * Sin dependencias de servidor a propósito: lo usan la ficha del puesto (para
 * pintar los valores) y las acciones de servidor (para guardarlos).
 */

import type { DiaSemana } from "@/features/rrhh/data/horarios";

/** Orden canónico de la semana, igual que en el patrón (lunes → domingo). */
const DIAS: DiaSemana[] = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Horas semanales de una jornada COMPLETA. Referencia del convenio de
 * Hostelería de Madrid, que es el de las tres sociedades. Por debajo de esto la
 * jornada es parcial.
 */
export const HORAS_JORNADA_COMPLETA = 40;

/** Lo que hace falta de un turno para calcular sus horas. */
export interface TurnoParaJornada {
  id: string;
  tramos: { inicio: string; fin: string }[];
  tipoJornada: "fijo" | "flexible";
  /** Horas/día del flexible (modelo nuevo). */
  flexHorasDia: number | null;
  /** Legacy: horas objetivo por día concreto (flexibles antiguos). */
  flexHoras?: Partial<Record<DiaSemana, number>>;
}

export type TipoJornadaContrato = "Completa" | "Parcial";

export interface JornadaDerivada {
  /** Horas/semana (promedio del ciclo si el patrón es rotativo). */
  horasSemanales: number;
  /** Días libres por semana (promedio del ciclo, redondeado). */
  diasLibres: number;
  /** Lo que viaja al contrato y a la gestoría. */
  jornada: TipoJornadaContrato;
  /** Nº de semanas del ciclo. > 1 = patrón rotativo. */
  semanas: number;
  /** true si algún día del ciclo se parte en dos tramos o más. */
  partida: boolean;
  /** false si el patrón no tiene ni un turno: no hay nada que calcular. */
  hayHorario: boolean;
}

/** "HH:MM" → minutos del día. null si no es una hora válida. */
function minutos(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/**
 * Horas de un turno en un día concreto. La MEDIANOCHE no corta el turno: un
 * turno de 20:00 a 02:00 son 6 horas, no un valor negativo.
 */
function horasDelTurno(turno: TurnoParaJornada, dia: DiaSemana): number {
  if (turno.tipoJornada === "flexible") {
    if (turno.flexHorasDia != null) return turno.flexHorasDia;
    return turno.flexHoras?.[dia] ?? 0;
  }
  let total = 0;
  for (const tr of turno.tramos ?? []) {
    const ini = minutos(tr.inicio);
    let fin = minutos(tr.fin);
    if (ini == null || fin == null) continue;
    if (fin <= ini) fin += 1440; // cruza medianoche
    total += fin - ini;
  }
  return total / 60;
}

/** Redondea a 2 decimales (las horas se guardan como numeric). */
function redondea(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula la jornada del puesto a partir de las semanas de su patrón.
 *
 * @param semanas Cada semana, 7 posiciones (lunes→domingo) con el id del turno
 *                de ese día o `null` si se libra.
 * @param turnos  Catálogo de turnos de la empresa, para resolver cada id.
 */
export function jornadaDesdeHorario(
  semanas: (string | null)[][],
  turnos: TurnoParaJornada[],
): JornadaDerivada {
  const porId = new Map(turnos.map((t) => [t.id, t]));
  const validas = semanas.filter((s) => Array.isArray(s));

  const vacio: JornadaDerivada = {
    horasSemanales: 0,
    diasLibres: 0,
    jornada: "Parcial",
    semanas: 0,
    partida: false,
    hayHorario: false,
  };
  if (validas.length === 0) return vacio;

  let horasCiclo = 0;
  let libresCiclo = 0;
  let partida = false;
  let algunTurno = false;

  for (const semana of validas) {
    for (let i = 0; i < 7; i++) {
      const turnoId = semana[i] ?? null;
      const turno = turnoId ? porId.get(turnoId) : null;
      // Un día sin turno, o con un turno que ya no existe, es día libre.
      if (!turno) {
        libresCiclo += 1;
        continue;
      }
      algunTurno = true;
      horasCiclo += horasDelTurno(turno, DIAS[i]);
      if (turno.tipoJornada === "fijo" && (turno.tramos?.length ?? 0) > 1) {
        partida = true;
      }
    }
  }

  if (!algunTurno) return { ...vacio, semanas: validas.length };

  const horasSemanales = redondea(horasCiclo / validas.length);
  return {
    horasSemanales,
    diasLibres: Math.round(libresCiclo / validas.length),
    jornada: horasSemanales >= HORAS_JORNADA_COMPLETA ? "Completa" : "Parcial",
    semanas: validas.length,
    partida,
    hayHorario: true,
  };
}

/** Horas con coma decimal y sufijo: 40 → "40 h"; 37,5 → "37,5 h". */
export function formatHorasSemana(horas: number): string {
  const txt = Number.isInteger(horas)
    ? String(horas)
    : String(Math.round(horas * 100) / 100).replace(".", ",");
  return `${txt} h`;
}
