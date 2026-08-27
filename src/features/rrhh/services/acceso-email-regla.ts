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

/**
 * ¿Debe MOVERSE el correo de acceso al guardar la ficha de un empleado?
 *
 * Regla de Iván (27-ago-2026): editar en la ficha el correo QUE ESA PERSONA USA
 * PARA ENTRAR arrastra el acceso; editar el otro buzón, no. Y el de empresa
 * manda sobre el personal, igual que en el alta.
 *
 * Se decide comparando el correo de acceso ACTUAL con los que la ficha tenía
 * ANTES de guardar:
 *
 *   · entraba con el de empresa y cambia el de empresa      → se mueve
 *   · entraba con el personal y cambia el personal          → se mueve
 *   · entraba con el personal y se le PONE uno de empresa   → se mueve (empresa manda)
 *   · entraba con el personal y solo se edita el de empresa
 *     que ya tenía                                          → NO se mueve
 *   · entraba con el de empresa y se le BORRA ese buzón     → se mueve al personal
 *   · el acceso no coincide con ninguno de los dos (se cambió
 *     a mano en Ajustes → Usuarios)                         → NO se mueve
 *
 * Función pura y exportada para poder probarla sin BD. `accesoActual` null
 * (cuenta sin correo aún) siempre deja fijar el login.
 */
export function debeMoverAccesoAlEditarFicha(input: {
  accesoActual: string | null;
  emailEmpresaAntes: string | null;
  emailPersonalAntes: string | null;
  emailEmpresaAhora: string | null;
  emailPersonalAhora: string | null;
}): boolean {
  const norm = (v: string | null) => (v ?? "").trim().toLowerCase() || null;
  const acceso = norm(input.accesoActual);
  const empresaAntes = norm(input.emailEmpresaAntes);
  const personalAntes = norm(input.emailPersonalAntes);
  const empresaAhora = norm(input.emailEmpresaAhora);

  // Cuenta sin correo de acceso todavía: se fija sin más.
  if (!acceso) return true;

  const nuevoLogin = resolverLoginEmail({
    emailEmpresa: input.emailEmpresaAhora,
    emailPersonal: input.emailPersonalAhora,
  });
  if (!nuevoLogin) return false; // sin ningún correo no hay login que fijar
  if (nuevoLogin === acceso) return false; // ya coincide

  // Sin estado anterior no se puede razonar: conservador, no se toca.
  if (empresaAntes === null && personalAntes === null) return false;

  const entrabaConEmpresa = empresaAntes !== null && acceso === empresaAntes;
  const entrabaConPersonal = personalAntes !== null && acceso === personalAntes;
  // Estrena correo de empresa: antes no tenía y ahora sí → empresa manda.
  const estrenaEmpresa = empresaAntes === null && empresaAhora !== null;

  // El acceso es ajeno a la ficha (cambio manual previo): manda ese.
  if (!entrabaConEmpresa && !entrabaConPersonal && !estrenaEmpresa) return false;

  // Entraba con el personal y solo se ha editado el buzón de empresa que ya
  // tenía: su acceso no es ese buzón, así que no se mueve.
  if (
    entrabaConPersonal &&
    !estrenaEmpresa &&
    empresaAhora !== null &&
    nuevoLogin === empresaAhora
  ) {
    return false;
  }

  return true;
}
