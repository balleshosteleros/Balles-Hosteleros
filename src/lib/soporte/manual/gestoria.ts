import type { ArticuloManual } from "./tipos";

/** GESTORÍA: lo que se habla con la gestoría, fiscal y laboral. */
export const MANUAL_GESTORIA: ArticuloManual[] = [
  {
    ref: "sw:gestoria-fiscal",
    modulo: "GESTORÍA",
    titulo: "Fiscal: modelos de Hacienda",
    contenido: `En Gestoría, Fiscal están los modelos que se presentan a Hacienda, con sus casillas, su periodo y su estado.

De cada casilla se distingue lo que ha calculado el software y lo que ha puesto la gestoría, para poder compararlo.

El software avisa de los modelos que tocan, con días de antelación.

El modelo 130 no aplica a sociedades.`,
    ruta: "/gestoria/modelos",
    rutaTitulo: "Fiscal",
  },
  {
    ref: "sw:gestoria-laboral",
    modulo: "GESTORÍA",
    titulo: "Laboral: altas y bajas en la Seguridad Social",
    contenido: `En Gestoría, Laboral se tramita con la gestoría lo que afecta a los contratos: altas de gente nueva y bajas de quien se va.

Un aviso a la gestoría lleva dos bloques de datos: los FISCALES, que son de la empresa, y los del CENTRO de trabajo, que son del local. El código de cuenta de cotización es del LOCAL y se elige en la vacante.

Si faltan datos obligatorios, el software no deja mandar el aviso: es a propósito, porque un alta mal comunicada se paga.

Los correos a la gestoría se confirman de uno en uno antes de salir.`,
    ruta: "/gestoria/contrataciones",
    rutaTitulo: "Laboral",
  },
  {
    ref: "sw:gestoria-baja",
    modulo: "GESTORÍA",
    titulo: "Dar de baja a alguien",
    contenido: `Una baja tiene dos momentos distintos que no hay que confundir.

Aprobar la baja es solo aceptar el PREAVISO: no se toca nada más, la persona sigue trabajando y con acceso.

La baja se tramita de verdad cuando el proceso llega a "Baja contrato": ahí se avisa a la gestoría y se prepara la salida.

El preaviso va entre 15 y 45 días según el caso, y la carta se firma con código de confirmación.

Cuando llega el último día, el software quita el acceso solo, a las seis de la mañana de la hora de la empresa (para no cortarle el turno de noche a nadie), y la persona pasa a Entregas: todavía hay que recoger su material y pagarle el finiquito.`,
    ruta: "/gestoria/contrataciones",
    rutaTitulo: "Laboral",
  },
];
