/**
 * El grosor de las pastillas de la cabecera. UNA sola medida para todas.
 *
 * La fila de arriba está hecha de pastillas —herramientas, fichaje, música,
 * Points, empresa + foto— y todas tienen que empezar y terminar a la misma
 * altura. Cada una llevaba el suyo (46, 42, 40, 38 y 36 píxeles) porque el alto
 * salía de sumar lo que hubiera dentro, y se veían escalonadas (Iván, 13-sep).
 *
 * Los 46 píxeles son los de la pastilla de empresa + empleado, que es la que
 * manda: borde, 4px de aire y dentro piezas de 36 (el isotipo y la foto). Las
 * demás se ajustan a ella, en el teléfono y en el ordenador.
 */
export const PILDORA_CABECERA = "h-[46px]";
