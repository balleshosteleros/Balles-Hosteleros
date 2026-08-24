/**
 * Reglas de la empresa para solicitar vacaciones: día obligatorio de inicio y
 * mínimo/máximo de días por solicitud. Se configuran en RRHH → Solicitudes.
 *
 * Vive aquí para que el formulario del empleado y el servidor validen
 * exactamente lo mismo y digan lo mismo cuando algo no cuadra.
 *
 * Los días se cuentan NATURALES (lunes a domingo = 7), igual que el cupo del
 * calendario de vacaciones.
 */

/** Config de vacaciones de una empresa. `null` = esa regla no se exige. */
export interface VacacionesReglas {
  /** Día ISO obligatorio de inicio (1=lunes … 7=domingo). null = cualquier día. */
  diaInicio: number | null;
  /** Mínimo de días naturales por solicitud. null = sin mínimo. */
  diasMin: number | null;
  /** Máximo de días naturales por solicitud. null = sin máximo. */
  diasMax: number | null;
}

/** Lo que recibe una empresa nueva: semanas completas empezando en lunes. */
export const VACACIONES_REGLAS_DEFAULT: VacacionesReglas = {
  diaInicio: 1,
  diasMin: 7,
  diasMax: 7,
};

/**
 * Permisos: sin límite mientras la empresa no configure nada. A diferencia de
 * vacaciones, no se exige día de la semana para empezar (`diaInicio` siempre
 * null): un permiso puede caer cualquier día.
 */
export const PERMISO_REGLAS_DEFAULT: VacacionesReglas = {
  diaInicio: null,
  diasMin: null,
  diasMax: null,
};

/**
 * Cómo nombrar la ausencia en los mensajes de error. Las mismas reglas valen
 * para vacaciones y para permisos, pero el texto tiene que sonar natural en
 * cada caso ("las vacaciones deben" vs "el permiso debe").
 */
export interface TextosAusencia {
  /** Sujeto con artículo: "Las vacaciones", "El permiso". */
  sujeto: string;
  /** Sin artículo, para "cada solicitud de …": "vacaciones", "permiso". */
  singular: string;
  /** Con artículo contraído: "tus vacaciones", "tu permiso". */
  deLa: string;
  /** Si el sujeto es plural, para concordar los verbos. */
  plural: boolean;
}

export const TEXTOS_VACACIONES: TextosAusencia = {
  sujeto: "Las vacaciones",
  singular: "vacaciones",
  deLa: "tus vacaciones",
  plural: true,
};

export const TEXTOS_PERMISO: TextosAusencia = {
  sujeto: "El permiso",
  singular: "permiso",
  deLa: "tu permiso",
  plural: false,
};

/** Nombre de cada día ISO, para los mensajes. Índice 0 sin usar. */
const DIAS_ISO = [
  "",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

/** Nombre en minúscula del día ISO (1=lunes … 7=domingo). */
export function nombreDiaISO(dia: number): string {
  return DIAS_ISO[dia] ?? "";
}

/** Opciones para el selector de día de la semana en la configuración. */
export const DIAS_SEMANA_OPCIONES: { value: number; label: string }[] = [1, 2, 3, 4, 5, 6, 7].map(
  (d) => ({ value: d, label: DIAS_ISO[d].charAt(0).toUpperCase() + DIAS_ISO[d].slice(1) }),
);

/**
 * Día ISO (1=lunes … 7=domingo) de una fecha "YYYY-MM-DD".
 * Se calcula en UTC a propósito: una fecha de calendario no lleva hora, así que
 * interpretarla en la zona local podría desplazarla un día.
 */
export function diaISODeFecha(iso: string): number | null {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const js = d.getUTCDay(); // 0=domingo … 6=sábado
  return js === 0 ? 7 : js;
}

/** Días naturales que abarca un rango, ambos incluidos. 0 si es inválido. */
export function diasNaturalesRango(desde: string, hasta: string): number {
  const a = Date.parse(desde + "T00:00:00Z");
  const b = Date.parse(hasta + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * Comprueba un rango de vacaciones contra las reglas de la empresa.
 * Devuelve el motivo del rechazo en `error`, ya redactado para el empleado,
 * o `null` si el rango es válido.
 *
 * `fechaFin` vacío se trata como un solo día (igual que en el formulario).
 */
export function validarRangoVacaciones(
  reglas: VacacionesReglas,
  fechaInicio: string,
  fechaFin: string | null,
  /** Cómo nombrar la ausencia en los mensajes. Por defecto, vacaciones. */
  textos: TextosAusencia = TEXTOS_VACACIONES,
): { ok: true } | { ok: false; error: string } {
  if (!fechaInicio) {
    return { ok: false, error: `Indica la fecha de inicio de ${textos.deLa}.` };
  }
  const fin = fechaFin || fechaInicio;

  // 1. Día de la semana obligatorio para empezar.
  if (reglas.diaInicio != null) {
    const dia = diaISODeFecha(fechaInicio);
    if (dia == null) return { ok: false, error: "La fecha de inicio no es válida." };
    if (dia !== reglas.diaInicio) {
      return {
        ok: false,
        error: `${textos.sujeto} debe${textos.plural ? "n" : ""} empezar en ${nombreDiaISO(reglas.diaInicio)} y has elegido un ${nombreDiaISO(dia)}.`,
      };
    }
  }

  // 2. Mínimo y máximo de días por solicitud.
  const dias = diasNaturalesRango(fechaInicio, fin);
  if (dias === 0) {
    return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." };
  }
  if (reglas.diasMin != null && dias < reglas.diasMin) {
    return {
      ok: false,
      error: `Cada solicitud de ${textos.singular} debe ser de al menos ${reglas.diasMin} ${diasPalabra(reglas.diasMin)} y has pedido ${dias}.`,
    };
  }
  if (reglas.diasMax != null && dias > reglas.diasMax) {
    return {
      ok: false,
      error: `Cada solicitud de ${textos.singular} puede ser como mucho de ${reglas.diasMax} ${diasPalabra(reglas.diasMax)} y has pedido ${dias}. Divídela${textos.plural ? "s" : ""} en varias solicitudes.`,
    };
  }
  return { ok: true };
}

function diasPalabra(n: number): string {
  return n === 1 ? "día natural" : "días naturales";
}

/**
 * Resumen de las reglas en una frase, para enseñárselas al empleado ANTES de
 * que elija fechas. Devuelve null si la empresa no exige nada.
 */
export function resumenReglasVacaciones(
  reglas: VacacionesReglas,
  textos: TextosAusencia = TEXTOS_VACACIONES,
): string | null {
  const partes: string[] = [];
  if (reglas.diaInicio != null) {
    partes.push(`debe${textos.plural ? "n" : ""} empezar en ${nombreDiaISO(reglas.diaInicio)}`);
  }
  // La segunda parte se encadena con "y" solo si ya hay una primera; si no,
  // arranca la frase ella sola ("Tu permiso debe ser de al menos 2 días").
  const y = partes.length > 0 ? "y " : `debe${textos.plural ? "n" : ""} `;
  if (reglas.diasMin != null && reglas.diasMax != null) {
    partes.push(
      reglas.diasMin === reglas.diasMax
        ? `${y}ser de ${reglas.diasMin} ${diasPalabra(reglas.diasMin)} exactos`
        : `${y}durar entre ${reglas.diasMin} y ${reglas.diasMax} días naturales`,
    );
  } else if (reglas.diasMin != null) {
    partes.push(`${y}ser de al menos ${reglas.diasMin} ${diasPalabra(reglas.diasMin)}`);
  } else if (reglas.diasMax != null) {
    partes.push(`${y}ser como mucho de ${reglas.diasMax} ${diasPalabra(reglas.diasMax)}`);
  }
  if (partes.length === 0) return null;
  const sujeto = textos.plural ? "Tus vacaciones" : `Tu ${textos.singular}`;
  return `${sujeto} ${partes.join(" ")}.`;
}

/**
 * Primera fecha >= `desde` que cae en el día de inicio exigido. Sirve para
 * proponerle al empleado una fecha válida en vez de dejarle adivinando.
 */
export function proximaFechaValida(reglas: VacacionesReglas, desde: string): string | null {
  if (reglas.diaInicio == null) return null;
  const base = new Date(desde + "T00:00:00Z");
  if (Number.isNaN(base.getTime())) return null;
  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const js = d.getUTCDay();
    if ((js === 0 ? 7 : js) === reglas.diaInicio) return d.toISOString().split("T")[0];
  }
  return null;
}
