/**
 * Constantes de la configuración del Calendario.
 *
 * Viven fuera del fichero de acciones porque aquel es `"use server"` y ahí solo
 * se pueden exportar funciones asíncronas: una constante exportada rompe el
 * build. Además, así las puede leer también el cliente.
 */

/** Días de vacaciones que se aplican si la empresa no ha configurado los suyos. */
export const DIAS_VACACIONES_DEFECTO = 30;

/** Clave dentro de `empresas.datos_generales` donde se guardan. */
export const CLAVE_DIAS_VACACIONES = "diasVacacionesAnio";
