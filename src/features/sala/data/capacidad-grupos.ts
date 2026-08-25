/**
 * Rangos de tamaño de grupo compartidos entre servidor y cliente.
 *
 * Viven fuera de los archivos `"use server"`: esos solo pueden exportar
 * funciones async, así que una constante ahí rompe la compilación.
 */

/** Tamaños de grupo que se pueden ordenar en Configuración → Orden. */
export const COMENSALES_MIN = 1;
export const COMENSALES_MAX = 20;

/** Tamaños que se muestran en la tabla de capacidad de las estadísticas. */
export const GRUPO_MIN = 1;
export const GRUPO_MAX = 16;
