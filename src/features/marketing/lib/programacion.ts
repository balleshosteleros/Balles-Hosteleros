/**
 * Cuándo sale una campaña.
 *
 * Tres formas, y solo tres, porque son las que se piden de verdad:
 *
 *   Manual      → no sale sola: se envía cuando alguien pulsa el botón.
 *   Un día      → sale una vez, el día y la hora que se digan (`fecha_envio`).
 *   Periódica   → sale cada día, semana, mes o año (`recurrencia_cron`).
 *
 * La periodicidad se guarda como una línea de cron porque es lo que ya tenía la
 * tabla y lo que entiende cualquiera que mire la base de datos. Pero el usuario
 * NO ve un cron: elige "cada año" y una fecha, y de ahí sale `0 11 14 2 *`. Este
 * archivo es el traductor en los dos sentidos, y lo comparten la pantalla y el
 * servidor para que no puedan discrepar.
 *
 * ── La hora es la del restaurante ─────────────────────────────────────────
 * El cron se interpreta en la zona horaria de la EMPRESA, no en la del servidor
 * ni en la de quien la programó. "Las once" son las once en el comedor, aunque
 * quien la dejó programada estuviera en Indonesia.
 */

export type Frecuencia = "manual" | "un_dia" | "diaria" | "semanal" | "mensual" | "anual";

export const FRECUENCIAS: Array<{ value: Frecuencia; label: string; ayuda: string }> = [
  { value: "manual", label: "Manual", ayuda: "No sale sola: la envías tú cuando quieras." },
  { value: "un_dia", label: "Un día concreto", ayuda: "Sale una vez, el día y la hora que digas." },
  { value: "diaria", label: "Cada día", ayuda: "Sale todos los días a la misma hora." },
  { value: "semanal", label: "Cada semana", ayuda: "Sale el mismo día de la semana que la fecha elegida." },
  { value: "mensual", label: "Cada mes", ayuda: "Sale el mismo día de cada mes que la fecha elegida." },
  { value: "anual", label: "Cada año", ayuda: "Sale el mismo día de cada año que la fecha elegida." },
];

export interface Programacion {
  frecuencia: Frecuencia;
  /** Fecha de referencia "YYYY-MM-DD": de ella salen el día de la semana, del mes y el mes. */
  fecha: string;
  /** Hora "HH:MM" en la zona de la empresa. */
  hora: string;
}

/** Lo que se guarda en la campaña a partir de una programación. */
export interface CamposProgramacion {
  recurrenciaCron: string | null;
  fechaEnvioIso: string | null;
  /** Estado que le toca a la campaña con esta programación. */
  estado: "borrador" | "programada" | "activa";
}

function partesFecha(fecha: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return { anio, mes, dia };
}

/** Día de la semana de una fecha en formato cron (0 = domingo). */
function diaSemanaCron(fecha: string): number {
  const { anio, mes, dia } = partesFecha(fecha);
  // Se construye en UTC a propósito: solo interesa qué día de la semana cae,
  // y con la hora local un cambio de huso podía moverlo un día.
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

/** De lo que eligió el usuario a lo que se guarda. */
export function programacionACampos(p: Programacion): CamposProgramacion {
  const [hh, mm] = (p.hora || "11:00").split(":").map(Number);
  const hora = Number.isFinite(hh) ? hh : 11;
  const minuto = Number.isFinite(mm) ? mm : 0;
  const { mes, dia } = partesFecha(p.fecha || new Date().toISOString().slice(0, 10));

  switch (p.frecuencia) {
    case "manual":
      return { recurrenciaCron: null, fechaEnvioIso: null, estado: "borrador" };
    case "un_dia":
      return {
        recurrenciaCron: null,
        // La fecha se guarda con la hora local escrita tal cual; el huso lo pone
        // el servidor al compararla contra el reloj de la empresa.
        fechaEnvioIso: `${p.fecha}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00`,
        estado: "programada",
      };
    case "diaria":
      return { recurrenciaCron: `${minuto} ${hora} * * *`, fechaEnvioIso: null, estado: "activa" };
    case "semanal":
      return {
        recurrenciaCron: `${minuto} ${hora} * * ${diaSemanaCron(p.fecha)}`,
        fechaEnvioIso: null,
        estado: "activa",
      };
    case "mensual":
      return { recurrenciaCron: `${minuto} ${hora} ${dia} * *`, fechaEnvioIso: null, estado: "activa" };
    case "anual":
      return { recurrenciaCron: `${minuto} ${hora} ${dia} ${mes} *`, fechaEnvioIso: null, estado: "activa" };
  }
}

/** Y de vuelta: lo guardado, leído como lo eligió el usuario. */
export function camposAProgramacion(
  recurrenciaCron: string | null,
  fechaEnvio: string | null,
): Programacion {
  const hoy = new Date().toISOString().slice(0, 10);

  if (recurrenciaCron) {
    const [min, hor, dom, mon, dow] = recurrenciaCron.trim().split(/\s+/);
    const hora = `${(hor ?? "11").padStart(2, "0")}:${(min ?? "0").padStart(2, "0")}`;
    if (dom !== "*" && mon !== "*") {
      const anio = new Date().getFullYear();
      return {
        frecuencia: "anual",
        fecha: `${anio}-${String(Number(mon)).padStart(2, "0")}-${String(Number(dom)).padStart(2, "0")}`,
        hora,
      };
    }
    if (dom !== "*") {
      const ahora = new Date();
      return {
        frecuencia: "mensual",
        fecha: `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(Number(dom)).padStart(2, "0")}`,
        hora,
      };
    }
    if (dow !== "*") {
      // Se busca el próximo día de la semana que toca, para que el campo de
      // fecha enseñe algo coherente con lo guardado.
      const objetivo = Number(dow) % 7;
      const d = new Date();
      while (d.getDay() !== objetivo) d.setDate(d.getDate() + 1);
      return { frecuencia: "semanal", fecha: d.toISOString().slice(0, 10), hora };
    }
    return { frecuencia: "diaria", fecha: hoy, hora };
  }

  if (fechaEnvio) {
    const [fecha, resto] = fechaEnvio.split("T");
    return { frecuencia: "un_dia", fecha, hora: (resto ?? "11:00").slice(0, 5) };
  }

  return { frecuencia: "manual", fecha: hoy, hora: "11:00" };
}

/**
 * ¿Le toca salir a esta línea de cron dentro de la hora que se está mirando?
 *
 * El cron de las campañas se comprueba UNA VEZ POR HORA, así que el minuto no
 * se compara: si la campaña dice "a las 11:30", sale en la pasada de las 11.
 * Comparar el minuto exacto dejaría muda cualquier campaña cuyo minuto no
 * coincidiera con el de la pasada, que es el fallo clásico de estos motores.
 */
export function cronTocaEstaHora(
  cron: string,
  ahora: { hora: number; diaMes: number; mes: number; diaSemana: number },
): boolean {
  const partes = cron.trim().split(/\s+/);
  if (partes.length < 5) return false;
  const [, hor, dom, mon, dow] = partes;

  const encaja = (campo: string, valor: number, alternativa?: number): boolean => {
    if (campo === "*") return true;
    return campo
      .split(",")
      .some((t) => Number(t) === valor || (alternativa !== undefined && Number(t) === alternativa));
  };

  if (!encaja(hor, ahora.hora)) return false;
  if (!encaja(mon, ahora.mes)) return false;

  // En cron, día-del-mes y día-de-semana se combinan con O cuando los dos están
  // puestos. Aquí solo se usa uno de los dos, pero se respeta la regla.
  const domPuesto = dom !== "*";
  const dowPuesto = dow !== "*";
  // El domingo se escribe 0 o 7: los dos valen.
  const dowOk = encaja(dow, ahora.diaSemana, ahora.diaSemana === 0 ? 7 : undefined);
  if (domPuesto && dowPuesto) return encaja(dom, ahora.diaMes) || dowOk;
  if (domPuesto) return encaja(dom, ahora.diaMes);
  if (dowPuesto) return dowOk;
  return true;
}

/** Cómo se lee una programación en una línea, para el listado y la ficha. */
export function describirProgramacion(p: Programacion): string {
  const dias = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const { mes, dia } = partesFecha(p.fecha);
  switch (p.frecuencia) {
    case "manual":
      return "Se envía a mano";
    case "un_dia":
      return `El ${dia} de ${meses[mes - 1]} a las ${p.hora}`;
    case "diaria":
      return `Cada día a las ${p.hora}`;
    case "semanal":
      return `Todos los ${dias[diaSemanaCron(p.fecha)]} a las ${p.hora}`;
    case "mensual":
      return `El día ${dia} de cada mes a las ${p.hora}`;
    case "anual":
      return `Cada ${dia} de ${meses[mes - 1]} a las ${p.hora}`;
  }
}
