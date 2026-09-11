/**
 * Manual del propio software: lo que el asistente tiene que saber.
 *
 * Hasta ahora la base de conocimiento eran seis artículos escritos a mano, así
 * que el asistente sabía contestar a "cómo fichar" y poco más. Todo lo demás
 * acababa en "no tengo información sobre eso". Esto es el manual completo,
 * escrito a partir de la estructura REAL del software (los mismos módulos y
 * pantallas que salen en el menú) y de cómo se comporta de verdad.
 *
 * Se escribe aquí, en código, y no en la base de datos, por tres motivos:
 *  - Es conocimiento del SOFTWARE, no de una empresa: igual para BACANAL,
 *    HABANA y BALLES. Va a `soporte_conocimiento`, que es global.
 *  - Viaja con el despliegue: una pantalla nueva trae su explicación al lado.
 *  - Se re-indexa solo y de forma idempotente por `ref`: editar un artículo
 *    actualiza su fila, no crea una segunda.
 *
 * REGLA AL AÑADIR: el `modulo` DEBE ser uno de `MODULOS_SOPORTE`. De ahí sale
 * el candado: un artículo etiquetado RECURSOS HUMANOS no lo recupera jamás
 * alguien cuyo rol no ve RECURSOS HUMANOS. Si dudas entre dos módulos, elige el
 * del menú donde vive la pantalla. Si lo puede necesitar cualquiera (fichar,
 * cambiar de empresa, mi perfil), es GENERAL.
 */

import type { ModuloSoporte } from "@/lib/soporte/modulos";

export interface ArticuloManual {
  /** Identificador estable. Es la clave del re-indexado: NO cambiarlo al editar. */
  ref: string;
  modulo: ModuloSoporte;
  titulo: string;
  /** Explicación en lenguaje llano. La lee un empleado, no un técnico. */
  contenido: string;
  /** Pantalla del software a la que lleva, si la hay. */
  ruta?: string;
  /** Nombre del enlace. Por defecto, el título de la pantalla. */
  rutaTitulo?: string;
}
