/**
 * Lo que devuelve `marketing_captacion_canales`: de dónde entra la gente.
 *
 * Los canales llegan con la CLAVE cruda de la base (`WEB`, `GOOGLE`,
 * `INSTAGRAM_ORGANICO`, o la palabra clave de una campaña). Para pintarlos se
 * pasan siempre por `labelOrigen()` y `colorOrigen()` de
 * `sala/data/origenes.ts`, que es la fuente única: el mismo canal se llama y se
 * colorea igual aquí que en el listado de reservas.
 */

/** Un canal en un mes concreto. */
export interface MesCanal {
  anio: number;
  /** 1-12. */
  mes: number;
  canal: string;
  reservas: number;
  comensales: number;
}

/** Cómo se porta cada canal (últimos 24 meses). */
export interface CalidadCanal {
  canal: string;
  reservas: number;
  /** Comensales de media por reserva. */
  mediaPersonas: number;
  noShow: number;
  canceladas: number;
}

/** La base de clientes que ha dejado cada canal. */
export interface ClientesCanal {
  canal: string;
  clientes: number;
  conEmail: number;
  conTelefono: number;
  /** Han venido al menos una vez. */
  hanVenido: number;
  /** Han venido dos veces o más. */
  repiten: number;
}

export interface CaptacionDatos {
  porMes: MesCanal[];
  calidad: CalidadCanal[];
  clientes: ClientesCanal[];
  /** Lo que no se sabe de dónde vino. Se enseña, no se esconde. */
  sinOrigen: { reservas: number; clientes: number };
}

export const CAPTACION_VACIA: CaptacionDatos = {
  porMes: [],
  calidad: [],
  clientes: [],
  sinOrigen: { reservas: 0, clientes: 0 },
};
