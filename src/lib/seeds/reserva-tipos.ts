/**
 * Seed canónico de TIPOS DE RESERVA (etiquetas visuales).
 *
 * Un tipo es solo una etiqueta de color + emoji + nombre que se asigna a una
 * reserva para distinguirla operativamente (Cumpleaños, Evento, Otra…). No
 * vincula con políticas, cupos ni notificaciones — solo sirve para filtrar y
 * pintar un chip en la fila/celda de la reserva.
 *
 * Cualquier cambio aquí se propaga a TODAS las empresas existentes vía
 * `syncSeedsToAllEmpresas()` (modo aditivo: solo crea los nombres que falten,
 * NO sobreescribe los que el cliente ya tenga) y se aplica a las empresas
 * nuevas vía `seedEmpresaDefaults()`.
 */

export interface ReservaTipoSeed {
  nombre: string;
  emoji: string;
  color: string;
  orden: number;
}

export const RESERVA_TIPOS_SEED: ReservaTipoSeed[] = [
  { nombre: "Cumpleaños", emoji: "🎂", color: "#ec4899", orden: 1 },
  { nombre: "Evento",     emoji: "🎉", color: "#f59e0b", orden: 2 },
  { nombre: "Otra",       emoji: "📌", color: "#64748b", orden: 3 },
];

export function normalizeTipoNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}
