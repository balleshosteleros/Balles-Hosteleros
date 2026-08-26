/**
 * Validación y normalización de los números del paso «Documentación»:
 * DNI/NIE, IBAN (España) y número de la Seguridad Social.
 *
 * Filosofía (regla del proyecto): validación INLINE TOLERANTE — no se marca
 * error mientras el prefijo aún puede ser válido; la validación estricta se aplica
 * al confirmar/enviar. Módulo plano: lo usan el formulario (cliente) y la API.
 */

const DNI_LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Normaliza DNI/NIE: mayúsculas, sin espacios ni guiones. */
export function normalizarDniNie(v: string): string {
  return v.toUpperCase().replace(/[\s-]/g, "").trim();
}

/** Valida un DNI (8 dígitos + letra de control) o NIE (X/Y/Z + 7 dígitos + letra). */
export function esDniNieValido(valor: string): boolean {
  const v = normalizarDniNie(valor);
  // NIE: la letra inicial se convierte a número (X=0, Y=1, Z=2).
  const m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(v);
  if (!m) return false;
  const [, prefijo, digitos, letra] = m;
  // DNI = 8 dígitos sin prefijo; NIE = prefijo + 7 dígitos.
  if (!prefijo && digitos.length !== 8) return false;
  if (prefijo && digitos.length !== 7) return false;
  const prefNum = prefijo === "X" ? "0" : prefijo === "Y" ? "1" : prefijo === "Z" ? "2" : "";
  const numero = Number.parseInt(`${prefNum}${digitos}`, 10);
  return DNI_LETRAS[numero % 23] === letra;
}

/** Normaliza IBAN: mayúsculas, sin espacios. */
export function normalizarIban(v: string): string {
  return v.toUpperCase().replace(/\s/g, "").trim();
}

/** Valida un IBAN por su dígito de control (mod-97). Acepta cualquier país. */
export function esIbanValido(valor: string): boolean {
  const v = normalizarIban(valor);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  // Reordena (4 primeros al final) y convierte letras a números (A=10…Z=35).
  const reordenado = v.slice(4) + v.slice(0, 4);
  const expandido = reordenado.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // mod-97 por bloques para no desbordar.
  let resto = 0;
  for (let i = 0; i < expandido.length; i += 7) {
    resto = Number.parseInt(String(resto) + expandido.slice(i, i + 7), 10) % 97;
  }
  return resto === 1;
}

/**
 * Edad mínima legal para trabajar en España (Estatuto de los Trabajadores, art. 6):
 * ningún menor de 16 años puede ser contratado. Es un límite duro, no un aviso.
 */
export const EDAD_MINIMA_LABORAL = 16;

/** Edad por encima de la cual la fecha se considera un error de lectura. */
export const EDAD_MAXIMA_RAZONABLE = 75;

/** Calcula la edad cumplida a día de hoy a partir de una fecha AAAA-MM-DD. */
export function calcularEdad(fechaISO: string, hoy: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return null;
  const nac = new Date(`${fechaISO}T00:00:00Z`);
  if (Number.isNaN(nac.getTime())) return null;
  let edad = hoy.getUTCFullYear() - nac.getUTCFullYear();
  const mes = hoy.getUTCMonth() - nac.getUTCMonth();
  // Aún no ha llegado su cumpleaños este año → resta uno.
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nac.getUTCDate())) edad--;
  return edad;
}

/**
 * Comprueba que una fecha de nacimiento es admisible para contratar.
 * Devuelve `null` si es válida, o el MOTIVO exacto por el que no lo es.
 *
 * Se usa en las tres capas (lectura por IA, formulario público y API) para que
 * el motivo que ve la persona sea siempre el mismo.
 */
export function motivoFechaNacimientoNoValida(
  fechaISO: string,
  hoy: Date = new Date(),
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return "La fecha de nacimiento no es válida.";
  const nac = new Date(`${fechaISO}T00:00:00Z`);
  if (Number.isNaN(nac.getTime())) return "La fecha de nacimiento no es válida.";
  if (nac.getTime() >= hoy.getTime()) return "La fecha de nacimiento no puede estar en el futuro.";

  const edad = calcularEdad(fechaISO, hoy);
  if (edad === null) return "La fecha de nacimiento no es válida.";
  if (edad < EDAD_MINIMA_LABORAL) {
    return `Según el documento aportado tienes ${edad} años. La edad mínima legal para trabajar en España es de ${EDAD_MINIMA_LABORAL} años, así que no podemos continuar con la incorporación. Si la fecha está mal leída, corrígela; si es correcta, contacta con Recursos Humanos.`;
  }
  if (edad > EDAD_MAXIMA_RAZONABLE) {
    return `La fecha de nacimiento indica ${edad} años, lo que parece un error de lectura del documento. Revísala antes de enviar.`;
  }
  return null;
}

/** Normaliza nº Seguridad Social: solo dígitos. */
export function normalizarSeguridadSocial(v: string): string {
  return v.replace(/\D/g, "").trim();
}

/**
 * Valida el número de afiliación a la Seguridad Social español: 11 o 12 dígitos
 * (2 de provincia + 8/9 de número + 2 de control). Validación de longitud
 * (el dígito de control DGN no siempre es verificable sin tablas), tolerante.
 */
export function esSeguridadSocialValida(valor: string): boolean {
  const v = normalizarSeguridadSocial(valor);
  return /^\d{11,12}$/.test(v);
}
