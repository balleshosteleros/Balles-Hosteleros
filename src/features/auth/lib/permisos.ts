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
  "PRODUCTO",
] as const;

/**
 * Módulos INTERNOS DEL PROVEEDOR: solo existen en la empresa matriz (la que
 * gestiona el propio software, `empresas.es_matriz`). Una empresa cliente no
 * los ve nunca, ni siquiera creando un departamento con ese nombre desde
 * Ajustes → Departamentos: el catálogo del software no se los dibuja.
 */
export const MODULOS_SOLO_MATRIZ = ["PRODUCTO"] as const;

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Normaliza un nombre de módulo para comparar sin acentos, mayúsculas ni
 * espacios sobrantes. "Dirección" === "DIRECCIÓN" === " direccion ".
 */
export function normalizarModulo(m: string): string {
  return m.normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase().trim();
}

/**
 * ¿El rol puede VER el módulo indicado? SIEMPRE según los permisos reales
 * configurados en Ajustes → Roles.
 *
 * No existe bypass de `es_admin_plataforma`: el rol concede, no la etiqueta de
 * director. La firma NO acepta el flag a propósito —igual que
 * `puedeVerHerramienta`—, para que el bypass sea imposible de reintroducir por
 * descuido. Antes, dirección veía módulos que tenía apagados en su propio rol.
 */
export function puedeVerModulo(
  permisos: PermisoModulo[],
  modulo: string,
): boolean {
  const target = normalizarModulo(modulo);
  return permisos.some((p) => p.ver && normalizarModulo(p.modulo) === target);
}

/**
 * Herramientas de la BARRA (CÁMARAS, agenda, cohete, candado). A diferencia de los
 * módulos-departamento, NO se rigen por el bypass de `es_admin_plataforma`:
 * cada una tiene su propio toggle en Ajustes → Roles y ese toggle manda para
 * TODOS los roles, dirección incluida. Si dirección apaga CÁMARAS, deja de ver
 * el icono aunque sea admin de plataforma.
 */
export const HERRAMIENTAS_BARRA = [
  "CÁMARAS",
  "HERR_AGENDA",
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
 * ¿El rol puede EDITAR el módulo indicado? SIEMPRE según los permisos reales.
 * Sin bypass de admin de plataforma (ver `puedeVerModulo`).
 */
export function puedeEditarModulo(
  permisos: PermisoModulo[],
  modulo: string,
): boolean {
  const target = normalizarModulo(modulo);
  return permisos.some((p) => p.editar && normalizarModulo(p.modulo) === target);
}

/**
 * ¿Tiene acceso a la vista "Mis Departamentos"? Sí si puede ver AL MENOS UN
 * departamento. Un rol sin ningún departamento no ve ni el conmutador ni la
 * vista — dirección incluida, si los tiene todos apagados.
 */
export function tieneAccesoDepartamentos(
  permisos: PermisoModulo[],
): boolean {
  return MODULOS_DEPARTAMENTO.some((m) => puedeVerModulo(permisos, m));
}

/**
 * Lista de módulos-departamento que el rol puede ver (formato canónico).
 * Vacía si no tiene acceso a ninguno.
 */
export function departamentosVisibles(
  permisos: PermisoModulo[],
): string[] {
  return MODULOS_DEPARTAMENTO.filter((m) => puedeVerModulo(permisos, m));
}

// ─── Catálogo de módulos por EMPRESA ───────────────────────────────────────
//
// Los permisos del rol dicen qué PUEDE ver una persona; esto dice qué OFRECE
// la empresa en la que está. Son dos llaves distintas y hacen falta las dos.
//
// El interruptor no es una lista aparte que haya que mantener: son los
// DEPARTAMENTOS que la empresa tiene dados de alta (Ajustes → Departamentos).
// Una empresa que no es un restaurante borra SALA y deja de ver el módulo SALA,
// sin que eso roce a ninguna otra empresa ni a los clientes futuros, que nacen
// con el sembrado canónico completo.

/** Módulos internos del proveedor, normalizados (uso interno). */
const MODULOS_SOLO_MATRIZ_NORM = MODULOS_SOLO_MATRIZ.map(normalizarModulo);

/** ¿`modulo` es un módulo interno del proveedor (solo empresa matriz)? */
export function esModuloSoloMatriz(modulo: string): boolean {
  return MODULOS_SOLO_MATRIZ_NORM.includes(normalizarModulo(modulo));
}

/** Contexto de la empresa activa necesario para resolver su catálogo. */
export interface CatalogoEmpresa {
  /** Nombres de los departamentos ACTIVOS de la empresa (tal cual en BD). */
  departamentos: string[];
  /** `empresas.es_matriz`: la empresa que gestiona el propio software. */
  esMatriz: boolean;
}

/**
 * ¿La EMPRESA activa ofrece este módulo?
 *
 * Un módulo del menú existe en una empresa si esa empresa tiene el departamento
 * homónimo. Los módulos internos del proveedor exigen además que la empresa sea
 * la matriz — así un cliente que cree un departamento llamado PRODUCTO se queda
 * con un departamento normal para organizar a su gente, pero sin módulo.
 *
 * Si la lista de departamentos llega vacía (fallo de carga, sesión a medio
 * resolver) NO escondemos el software entero: se permiten todos los módulos
 * salvo los internos del proveedor. Dejar a alguien sin menú por un fallo de red
 * es peor que mostrar un módulo de más.
 */
export function moduloDisponibleEnEmpresa(
  modulo: string,
  catalogo: CatalogoEmpresa,
): boolean {
  if (esModuloSoloMatriz(modulo) && !catalogo.esMatriz) return false;
  if (catalogo.departamentos.length === 0) return true;
  const target = normalizarModulo(modulo);
  return catalogo.departamentos.some((d) => normalizarModulo(d) === target);
}
