/**
 * Rejilla del calendario de clases: semanas de lunes a domingo.
 *
 * Se trabaja con la fecha en texto (`yyyy-mm-dd`), no con `Date`, porque la
 * clase ocurre a una hora de la EMPRESA y convertirla a la hora del navegador
 * la movería de día a quien la mire desde otro huso.
 */

export const DIAS_SEMANA = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export interface DiaCalendario {
  /** yyyy-mm-dd */
  fecha: string;
  dia: number;
  /** false = relleno del mes anterior o siguiente. */
  delMes: boolean;
}

function aTexto(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Nombre del mes en la forma que se rotula la cabecera: «septiembre de 2026». */
export function tituloMes(anio: number, mes: number): string {
  return `${MESES[mes]} de ${anio}`;
}

/** Las seis semanas (42 días) que enseñan el mes completo sin saltos. */
export function diasDelMes(anio: number, mes: number): DiaCalendario[] {
  const primero = new Date(Date.UTC(anio, mes, 1));
  // getUTCDay(): 0 = domingo. La semana empieza en lunes.
  const desplazamiento = (primero.getUTCDay() + 6) % 7;
  const diasMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const diasMesAnterior = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  const dias: DiaCalendario[] = [];
  for (let i = desplazamiento - 1; i >= 0; i--) {
    const d = diasMesAnterior - i;
    const anteriorMes = mes === 0 ? 11 : mes - 1;
    const anteriorAnio = mes === 0 ? anio - 1 : anio;
    dias.push({ fecha: aTexto(anteriorAnio, anteriorMes, d), dia: d, delMes: false });
  }
  for (let d = 1; d <= diasMes; d++) {
    dias.push({ fecha: aTexto(anio, mes, d), dia: d, delMes: true });
  }
  let siguiente = 1;
  while (dias.length % 7 !== 0 || dias.length < 35) {
    const siguienteMes = mes === 11 ? 0 : mes + 1;
    const siguienteAnio = mes === 11 ? anio + 1 : anio;
    dias.push({ fecha: aTexto(siguienteAnio, siguienteMes, siguiente), dia: siguiente, delMes: false });
    siguiente++;
  }
  return dias;
}

/** `2026-09-14` → `14/09/2026`, que es como se escriben aquí las fechas. */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}

/** `2026-09-14` → `lunes 14 de septiembre`. */
export function fechaConDia(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const nombres = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const diaSemana = nombres[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${diaSemana} ${d} de ${MESES[m - 1]}`;
}
