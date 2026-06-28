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
