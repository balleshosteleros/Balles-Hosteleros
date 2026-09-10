/**
 * Tipos de la auditoría de correos (PRP-094).
 *
 * Viven fuera del archivo de acciones porque un archivo `"use server"` solo
 * puede exportar funciones async: cualquier otra exportación lo rompe.
 */

/**
 * Estado de la conexión de un buzón. Son TRES, no dos, y esa es la gracia:
 *
 *  - `sin_conectar` → nadie ha dado permiso todavía
 *  - `conectado`    → se está contando su correo
 *  - `caducado`     → hubo permiso y se ha revocado en Google
 *
 * Ninguno se enseña como «0 correos»: un cero significa que no entró ni un
 * correo, que es una información completamente distinta de no poder mirar.
 */
export type ConexionBuzon = "sin_conectar" | "conectado" | "caducado";

export interface BuzonVista {
  id: string;
  email: string;
  etiqueta: string;
  conexion: ConexionBuzon;
  /** Nombre de quien dio el permiso la última vez. Informativo. */
  conectadoPor: string | null;
  /**
   * Última vez que se trajo correo, YA formateada (dd/mm/aaaa, hh:mm) en la
   * zona de la empresa. Se formatea en servidor a propósito: el navegador puede
   * estar en otro huso y enseñaría una hora que aquí no ha existido.
   */
  ultimaSync: string | null;
  ultimoError: string | null;
}
