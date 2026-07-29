/**
 * Constantes de albaranes (módulo de datos, no "use server": puede exportar constantes).
 */

/**
 * "Revisión": estado de un albarán subido por foto que aún tiene líneas sin producto
 * asociado (la IA leyó productos que no casan con el catálogo). El albarán se GUARDA en
 * este estado —no se descarta— pero NO suma stock ni se considera compra confirmada hasta
 * que una persona resuelve cada línea (vincular / crear / ignorar) y lo aprueba a
 * "Confirmado". Decisión de Iván (2026-07-29): no existe "bloqueado"; existe "Revisión".
 */
export const ESTADO_REVISION = "Revisión";

/** Estados con la mercancía ya recepcionada (stock aplicado): "Entregado" y "Confirmado". */
export const ESTADOS_COMPRA_CONFIRMADA = ["Entregado", "Confirmado"] as const;
