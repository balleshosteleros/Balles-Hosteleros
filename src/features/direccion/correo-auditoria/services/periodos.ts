/**
 * Los tres periodos del panel, en la hora de la empresa (PRP-094, Fase 3).
 *
 * Funciones PURAS. Todo se calcula sobre el día de la EMPRESA: si alguien mira
 * el panel desde Indonesia, «hoy» sigue siendo el hoy del restaurante, no el
 * suyo. Sin esto, el mismo día se contaría distinto según quién mire.
 */

export type Periodo = "dia" | "semana" | "mes";

export type Rango = {
  /** aaaa-mm-dd, ambos inclusive. */
  desde: string;
  hasta: string;
  /** Cómo se lee en la pantalla: "Hoy", "Semana del 8 al 14 de septiembre"… */
  etiqueta: string;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** El día de hoy en la zona de la empresa, como aaaa-mm-dd. */
export function hoyEnEmpresa(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/** Suma (o resta) días a una fecha aaaa-mm-dd sin tocar husos horarios. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana con el lunes como 1 y el domingo como 7 (norma ISO). */
function diaSemanaIso(fecha: string): number {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * Rango de fechas de un periodo, contando desde el día que sea hoy en la
 * empresa.
 *
 * La semana va de lunes a domingo (norma ISO), que es como se organiza el
 * trabajo en la casa. El mes es el mes natural en curso.
 */
export function rangoDePeriodo(periodo: Periodo, tz: string): Rango {
  const hoy = hoyEnEmpresa(tz);

  if (periodo === "dia") {
    return { desde: hoy, hasta: hoy, etiqueta: "Hoy" };
  }

  if (periodo === "semana") {
    const lunes = sumarDias(hoy, -(diaSemanaIso(hoy) - 1));
    const domingo = sumarDias(lunes, 6);
    return {
      desde: lunes,
      hasta: domingo,
      etiqueta: `Del ${diaYMes(lunes)} al ${diaYMes(domingo)}`,
    };
  }

  const [anio, mes] = hoy.split("-");
  const primero = `${anio}-${mes}-01`;
  const ultimo = new Date(Date.UTC(Number(anio), Number(mes), 0))
    .toISOString()
    .slice(0, 10);
  return {
    desde: primero,
    hasta: ultimo,
    etiqueta: `${MESES[Number(mes) - 1]} de ${anio}`,
  };
}

/** "8 de septiembre", para leer un rango sin ruido. */
function diaYMes(fecha: string): string {
  const [, mes, dia] = fecha.split("-");
  return `${Number(dia)} de ${MESES[Number(mes) - 1]}`;
}

/** dd/mm/aaaa, que es como se escriben las fechas en todo el software. */
export function formatoDiaMesAnio(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Todos los días del rango, incluidos los que no tuvieron ni un correo. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  let actual = desde;
  // Tope de seguridad: un rango mal formado no puede colgar la pantalla.
  for (let i = 0; i < 400 && actual <= hasta; i++) {
    dias.push(actual);
    actual = sumarDias(actual, 1);
  }
  return dias;
}
