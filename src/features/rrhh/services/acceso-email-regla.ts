/**
 * Regla de qué correo da ACCESO a un empleado, y cuándo ese acceso se mueve.
 *
 * Módulo aparte y SIN `server-only` a propósito: es lógica pura, sin BD ni red,
 * y así puede probarse directamente (`tests/acceso-email-empleado.spec.ts`).
 * Equivocarse aquí deja a alguien fuera del sistema, así que conviene poder
 * verificarla sin levantar nada.
 */

/**
 * Regla única y canónica de qué correo es la IDENTIDAD DE LOGIN de un empleado.
 *
 * Login = email de EMPRESA si existe; si no, el email PERSONAL del empleado.
 * (Sustituye a la lógica antigua que decidía por área del puesto; ahora es una
 * sola regla para todas las vías: alta directa, contratación y edición.)
 *
 * Normaliza (trim + lowercase). Devuelve null si no hay ninguno de los dos:
 * en ese caso el caller no debe crear/actualizar el login.
 */
export function resolverLoginEmail(input: {
  emailEmpresa?: string | null;
  emailPersonal?: string | null;
}): string | null {
  const empresa = (input.emailEmpresa ?? "").trim().toLowerCase() || null;
  const personal = (input.emailPersonal ?? "").trim().toLowerCase() || null;
  return empresa ?? personal ?? null;
}
