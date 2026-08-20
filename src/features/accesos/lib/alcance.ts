/**
 * Centinela para pedir EXPLÍCITAMENTE el alcance multiempresa al listar accesos.
 *
 * `listAllAccesosApps()` usa el cliente admin (se salta la RLS), así que el
 * filtro por empresa va a mano. Antes, omitir el argumento devolvía las
 * credenciales de TODAS las empresas: un olvido silencioso las volcaba enteras.
 * Ahora sin argumento se usa la empresa activa, y solo este centinela abre el
 * alcance —lo que hace visible en el código quién pide ver más de una empresa.
 *
 * Vive fuera del módulo de actions porque un archivo "use server" solo puede
 * exportar funciones async.
 */
export const TODAS_LAS_EMPRESAS = "__todas__";
