/**
 * Seed canónico de ETIQUETAS DE RESERVA.
 *
 * Una etiqueta es una categoría visual (color + emoji + nombre) que se asigna
 * a una reserva para distinguirla operativamente (Cumpleaños, Evento, Otra…).
 * No vincula con políticas, cupos ni notificaciones — solo sirve para filtrar
 * y pintar un chip en la fila/celda de la reserva.
 *
 * Cualquier cambio aquí se propaga a TODAS las empresas existentes vía
 * `syncSeedsToAllEmpresas()` (modo aditivo: solo crea los nombres que falten,
 * NO sobreescribe los que el cliente ya tenga) y se aplica a las empresas
 * nuevas vía `seedEmpresaDefaults()`.
 */

export interface ReservaEtiquetaSeed {
  nombre: string;
  emoji: string;
  color: string;
  orden: number;
}

export const RESERVA_ETIQUETAS_SEED: ReservaEtiquetaSeed[] = [
  { nombre: "Cumpleaños", emoji: "🎂", color: "#ec4899", orden: 1 },
  { nombre: "Evento",     emoji: "🎉", color: "#f59e0b", orden: 2 },
];

export function normalizeReservaEtiquetaNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}
