/**
 * FUENTE ÚNICA de resolución de permisos por rol REAL.
 *
 * Toda la app decide visibilidad de departamentos/módulos leyendo los permisos
 * reales del rol (`empresa_roles.permisos`, gestionados en Ajustes → Roles), NO
 * un enum técnico hardcodeado. Estas utilidades son isomórficas (cliente y
 * servidor) y no importan nada de React ni de Supabase.
 *
 * Regla de acceso:
 *   - `es_admin_plataforma` (rol DIRECCIÓN) → bypass total: ve TODO.
 *   - resto de roles → ven un módulo si `permisos[modulo].ver === true`.
 *   - un rol con 0 departamentos permitidos NO ve la vista "Mis Departamentos".
 */

import type { PermisoModulo } from "@/features/ajustes/data/ajustes";

/**
 * Módulos que representan un DEPARTAMENTO (aparecen como tiles en la cuadrícula
 * de "Mis Departamentos"). Formato canónico — debe coincidir con
 * `empresa_roles.permisos[].modulo` y con `MODULOS_NAV` de RolesTab.
 * AJUSTES no es un departamento: se controla aparte (solo dirección).
 */
export const MODULOS_DEPARTAMENTO = [
  "DIRECCIÓN",
  "SALA",
  "COCINA",
  "GERENCIA",
  "CALIDAD",
  "RECURSOS HUMANOS",
  "MARKETING",
  "LOGÍSTICA",
  "CONTABILIDAD",
  "GESTORÍA",
  "JURÍDICO",
] as const;

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Normaliza un nombre de módulo para comparar sin acentos, mayúsculas ni
 * espacios sobrantes. "Dirección" === "DIRECCIÓN" === " direccion ".
 */
export function normalizarModulo(m: string): string {
  return m.normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase().trim();
}

/**
 * ¿El rol (dado su flag de admin y su lista de permisos reales) puede VER el
 * módulo indicado? Admin de plataforma ve todo; el resto según `permisos`.
 */
export function puedeVerModulo(
  esAdminPlataforma: boolean,
  permisos: PermisoModulo[],
  modulo: string,
): boolean {
  if (esAdminPlataforma) return true;
  const target = normalizarModulo(modulo);
  return permisos.some((p) => p.ver && normalizarModulo(p.modulo) === target);
}

/**
 * Herramientas de la BARRA (CÁMARAS, cohete, candado). A diferencia de los
 * módulos-departamento, NO se rigen por el bypass de `es_admin_plataforma`:
 * cada una tiene su propio toggle en Ajustes → Roles y ese toggle manda para
 * TODOS los roles, dirección incluida. Si dirección apaga CÁMARAS, deja de ver
 * el icono aunque sea admin de plataforma.
 */
export const HERRAMIENTAS_BARRA = [
  "CÁMARAS",
  "HERR_APLICACIONES",
  "HERR_ACCESOS",
] as const;

const HERRAMIENTAS_BARRA_NORM = HERRAMIENTAS_BARRA.map(normalizarModulo);

/** ¿`modulo` es una herramienta de barra (toggle explícito, sin bypass)? */
export function esHerramientaBarra(modulo: string): boolean {
  return HERRAMIENTAS_BARRA_NORM.includes(normalizarModulo(modulo));
}

/**
 * ¿El rol puede VER una HERRAMIENTA DE BARRA? Siempre según su permiso real,
 * ignorando el bypass de admin de plataforma. Una herramienta desactivada en
 * Ajustes → Roles se oculta también para dirección.
 */
export function puedeVerHerramienta(
  permisos: PermisoModulo[],
  modulo: string,
): boolean {
  const target = normalizarModulo(modulo);
  return permisos.some((p) => p.ver && normalizarModulo(p.modulo) === target);
}

/**
 * ¿El rol puede EDITAR el módulo indicado? Admin de plataforma siempre; el
 * resto según `permisos`.
 */
export function puedeEditarModulo(
  esAdminPlataforma: boolean,
  permisos: PermisoModulo[],
  modulo: string,
): boolean {
  if (esAdminPlataforma) return true;
  const target = normalizarModulo(modulo);
  return permisos.some((p) => p.editar && normalizarModulo(p.modulo) === target);
}

/**
 * ¿Tiene acceso a la vista "Mis Departamentos"? Sí si es admin de plataforma o
 * si puede ver AL MENOS UN departamento. Un rol sin ningún departamento no ve
 * ni el conmutador ni la vista.
 */
export function tieneAccesoDepartamentos(
  esAdminPlataforma: boolean,
  permisos: PermisoModulo[],
): boolean {
  if (esAdminPlataforma) return true;
  return MODULOS_DEPARTAMENTO.some((m) => puedeVerModulo(false, permisos, m));
}

/**
 * Lista de módulos-departamento que el rol puede ver (formato canónico).
 * Vacía si no tiene acceso a ninguno.
 */
export function departamentosVisibles(
  esAdminPlataforma: boolean,
  permisos: PermisoModulo[],
): string[] {
  if (esAdminPlataforma) return [...MODULOS_DEPARTAMENTO];
  return MODULOS_DEPARTAMENTO.filter((m) => puedeVerModulo(false, permisos, m));
}
