/**
 * Subtipos de ausencia del sistema: LISTA CERRADA. No se pueden añadir tipos
 * nuevos porque cada uno lleva asociado un comportamiento propio del programa
 * (cupo de vacaciones, parte médico, baja de contrato con firma y preaviso).
 * El admin configura los de aquí: nombre visible, color, límite, `activo`…
 *
 * Vive fuera de `actions/horarios-config-actions.ts` porque aquel archivo es
 * `"use server"` y ahí solo pueden exportarse funciones async: una constante
 * exportada desde un módulo así tumba TODO el módulo de server actions de la
 * página que lo importe.
 */
export const SUBTIPOS_AUSENCIA = [
  "vacaciones",
  "baja_medica",
  "permiso",
  "baja_contrato",
] as const;

export type SubtipoAusencia = (typeof SUBTIPOS_AUSENCIA)[number];
