/**
 * Cómo se ve cada tipo de ausencia en el calendario: color del aro que rodea
 * al avatar, icono y etiqueta.
 *
 * Vive en un solo sitio para que la leyenda, los filtros y las celdas del
 * calendario digan siempre lo mismo. Los colores van en HEX y se aplican como
 * estilo en línea a propósito: una clase de Tailwind guardada en base de datos
 * no se compila y saldría sin color.
 */

import type { SolicitudSubtipoAusencia } from "@/features/mi-panel/types";

export interface TipoCalendario {
  subtipo: SolicitudSubtipoAusencia;
  label: string;
  /** Color del aro alrededor del avatar. */
  color: string;
  /** Descripción corta para la leyenda. */
  ayuda: string;
}

export const TIPOS_CALENDARIO: TipoCalendario[] = [
  {
    subtipo: "vacaciones",
    label: "Vacaciones",
    color: "#059669", // esmeralda
    ayuda: "Días de vacaciones",
  },
  {
    subtipo: "baja_medica",
    label: "Baja médica",
    color: "#e11d48", // rosa fuerte
    ayuda: "Baja por enfermedad o accidente",
  },
  {
    subtipo: "permiso",
    label: "Permiso",
    color: "#7c3aed", // violeta
    ayuda: "Permiso o ausencia justificada",
  },
  {
    subtipo: "baja_contrato",
    label: "Baja de contrato",
    color: "#0f172a", // casi negro: deja la empresa
    ayuda: "Último día trabajado",
  },
];

/** Color del aro de un tipo. Gris si el tipo no está en el catálogo. */
export function colorDeSubtipo(subtipo: string): string {
  return TIPOS_CALENDARIO.find((t) => t.subtipo === subtipo)?.color ?? "#64748b";
}

/** Etiqueta legible de un tipo. */
export function labelDeSubtipo(subtipo: string): string {
  return TIPOS_CALENDARIO.find((t) => t.subtipo === subtipo)?.label ?? subtipo;
}

/**
 * Estados en que puede estar una ausencia dentro del calendario. Se distinguen
 * porque no es lo mismo algo ya aprobado que algo pendiente de decidir: al
 * cuadrar turnos hay que ver ambos, pero sin confundirlos.
 */
export type EstadoCalendario = "aprobada" | "pendiente";

export const ESTADOS_CALENDARIO: { estado: EstadoCalendario; label: string; ayuda: string }[] = [
  { estado: "aprobada", label: "Aprobadas", ayuda: "Ya confirmadas" },
  { estado: "pendiente", label: "Pendientes", ayuda: "Sin decidir todavía" },
];
