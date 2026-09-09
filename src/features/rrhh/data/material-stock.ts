/**
 * Almacen de uniforme y material de RRHH.
 *
 * Tres numeros, y solo tres, en todo momento y por talla:
 *   EN ALMACEN  lo que hay en la estanteria
 *   EN MANOS    lo que llevan puesto los trabajadores
 *   TOTAL       lo que tiene la empresa (la suma de los dos)
 *
 * Salen de sumar el libro de movimientos, nunca de un contador guardado: un
 * saldo guardado hay que mantenerlo sincronizado y el dia que se desincroniza
 * nadie se entera.
 *
 * CADA MOVIMIENTO MUEVE DOS NUMEROS A LA VEZ. Una entrega no es "una salida" y
 * luego "una entrada": es UN hecho que resta del almacen y suma a las manos del
 * trabajador en la misma linea. Por eso entregar y devolver no pueden crear ni
 * destruir material aunque algo falle a mitad.
 *
 * No se edita ni se borra ninguna linea del libro: para corregir se anade la
 * linea contraria.
 */

import type { CategoriaMaterial } from "./entregas";

/** Los ocho hechos que pueden mover material. */
export type TipoMovimiento =
  | "inicial"
  | "compra"
  | "entrega"
  | "devolucion"
  | "deterioro_trabajador"
  | "deterioro_almacen"
  | "no_devuelta"
  | "ajuste_recuento";

/** Donde esta una pieza: en la estanteria o puesta. */
export type UbicacionMaterial = "almacen" | "manos";

export const MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  inicial: "Saldo inicial",
  compra: "Entrada",
  entrega: "Entrega",
  devolucion: "Devolución",
  deterioro_trabajador: "Deterioro",
  deterioro_almacen: "Deterioro en almacén",
  no_devuelta: "No devuelta",
  ajuste_recuento: "Ajuste de recuento",
};

/**
 * Como se lee cada movimiento en pantalla. Verde lo que suma al total de la
 * empresa, rojo lo que lo baja, neutro lo que solo cambia de sitio.
 */
export const MOVIMIENTO_COLOR: Record<TipoMovimiento, string> = {
  inicial: "bg-zinc-50 text-zinc-700 border-zinc-200",
  compra: "bg-emerald-50 text-emerald-700 border-emerald-200",
  entrega: "bg-sky-50 text-sky-700 border-sky-200",
  devolucion: "bg-sky-50 text-sky-700 border-sky-200",
  deterioro_trabajador: "bg-rose-50 text-rose-700 border-rose-200",
  deterioro_almacen: "bg-rose-50 text-rose-700 border-rose-200",
  no_devuelta: "bg-rose-50 text-rose-700 border-rose-200",
  ajuste_recuento: "bg-amber-50 text-amber-700 border-amber-200",
};

/**
 * Los movimientos que exigen explicar por que. Son los que hacen perder
 * material a la empresa o descuadran el recuento: sin motivo, dentro de un ano
 * nadie sabria que paso con esa pieza.
 */
export const MOVIMIENTOS_CON_MOTIVO: TipoMovimiento[] = [
  "deterioro_trabajador",
  "deterioro_almacen",
  "no_devuelta",
  "ajuste_recuento",
];

/** Una linea del libro, ya en lenguaje de la aplicacion. */
export interface MovimientoMaterial {
  id: string;
  tipoId: string | null;
  tipoNombre: string;
  categoria: CategoriaMaterial;
  talla: string | null;
  fecha: string;
  tipoMovimiento: TipoMovimiento;
  deltaAlmacen: number;
  deltaManos: number;
  entregaId: string | null;
  empleadoId: string | null;
  empleadoNombre: string | null;
  motivo: string | null;
  proveedor: string | null;
  documentoReferencia: string | null;
  costeUnitario: number | null;
  /** Si esta linea deshace otra, el id de la original. */
  revierteA: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
}

/** Los tres numeros de una pieza concreta (tipo + talla). */
export interface SaldoMaterial {
  tipoId: string | null;
  tipoNombre: string;
  categoria: CategoriaMaterial;
  talla: string | null;
  enAlmacen: number;
  enManos: number;
  totalEmpresa: number;
  /** Fecha del ultimo recuento confirmado que incluyo esta pieza. */
  ultimoRecuento: string | null;
  /** Diferencia que salio en ese recuento. 0 = cuadraba. */
  ultimoDescuadre: number | null;
}

/** Los tres totales de toda la empresa, para las tarjetas de cabecera. */
export interface TotalesAlmacen {
  enAlmacen: number;
  enManos: number;
  totalEmpresa: number;
}

/**
 * Que mueve cada tipo de movimiento. Es la regla de negocio entera del almacen
 * en una sola tabla: quien escribe en el libro no decide los signos, los deriva
 * de aqui. Asi es imposible grabar una entrega que sume material de la nada.
 *
 * `unidades` siempre es positivo; el signo lo pone esta tabla.
 */
export function deltasDe(
  tipo: TipoMovimiento,
  unidades: number,
  opciones?: { ubicacion?: UbicacionMaterial; signo?: 1 | -1 },
): { deltaAlmacen: number; deltaManos: number } {
  const n = Math.abs(unidades);

  switch (tipo) {
    // Carga de partida: lo que ya habia el dia que se estrena el almacen. Puede
    // estar en la estanteria o ya puesto por alguien.
    case "inicial":
      return opciones?.ubicacion === "manos"
        ? { deltaAlmacen: 0, deltaManos: n }
        : { deltaAlmacen: n, deltaManos: 0 };

    // Entra material nuevo.
    case "compra":
      return { deltaAlmacen: n, deltaManos: 0 };

    // Del almacen a las manos del trabajador. El total de la empresa no cambia.
    case "entrega":
      return { deltaAlmacen: -1, deltaManos: 1 };

    // Vuelve a la estanteria. Tampoco cambia el total.
    case "devolucion":
      return { deltaAlmacen: 1, deltaManos: -1 };

    // Se le rompio teniendolo el: desaparece de sus manos y de la empresa.
    case "deterioro_trabajador":
      return { deltaAlmacen: 0, deltaManos: -1 };

    // Se estropeo en la estanteria.
    case "deterioro_almacen":
      return { deltaAlmacen: -n, deltaManos: 0 };

    // Se marcho y nunca la trajo. Es una perdida: sale de sus manos y no vuelve
    // al almacen. La empresa tiene una menos.
    case "no_devuelta":
      return { deltaAlmacen: 0, deltaManos: -1 };

    // Lo que aparece o falta al contar. El recuento cuenta la estanteria.
    case "ajuste_recuento":
      return { deltaAlmacen: n * (opciones?.signo ?? 1), deltaManos: 0 };
  }
}

/** Sumar los tres totales de una lista de saldos. */
export function totalesDe(saldos: SaldoMaterial[]): TotalesAlmacen {
  return saldos.reduce<TotalesAlmacen>(
    (acc, s) => ({
      enAlmacen: acc.enAlmacen + s.enAlmacen,
      enManos: acc.enManos + s.enManos,
      totalEmpresa: acc.totalEmpresa + s.totalEmpresa,
    }),
    { enAlmacen: 0, enManos: 0, totalEmpresa: 0 },
  );
}

/**
 * Como se escribe un numero con signo en el libro: "+3", "−2", "0".
 * Con el signo menos tipografico, no el guion del teclado.
 */
export function conSigno(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/**
 * El nombre completo de una pieza: "Camisa manga corta (M)". La talla entre
 * parentesis solo si la tiene: un gorro no tiene talla y "Gorro ()" sobra.
 */
export function nombrePieza(tipoNombre: string, talla: string | null): string {
  return talla ? `${tipoNombre} (${talla})` : tipoNombre;
}

/**
 * Un saldo negativo en almacen significa que se ha entregado material que el
 * sistema no sabia que existia (lo normal al empezar, antes de cargar el saldo
 * inicial). No es un error que haya que bloquear, pero la pantalla lo avisa.
 */
export function tieneSaldoImposible(saldo: SaldoMaterial): boolean {
  return saldo.enAlmacen < 0 || saldo.enManos < 0;
}
