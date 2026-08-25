/**
 * Constantes compartidas de la devolución de nóminas a la gestoría.
 *
 * Viven aquí, y no en la acción de servidor, porque un archivo `"use server"`
 * solo puede exportar funciones async: una constante exportada desde ahí rompe
 * la compilación. Y las necesitan los dos lados — el formulario que valida antes
 * de enviar y la acción que valida en el servidor —, así que el mínimo se
 * escribe UNA vez.
 */

/** Mínimo de caracteres del mensaje de anomalías. Mismo valor que el CHECK de BD. */
export const MOTIVO_MIN_CARACTERES = 10;
