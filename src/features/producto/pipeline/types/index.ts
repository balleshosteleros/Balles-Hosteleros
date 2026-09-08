/**
 * Pipeline de Producto — el embudo comercial del propio software.
 *
 * Una tarjeta = una persona interesada. La COLUMNA dice en qué paso va
 * (nuevo lead, seguimiento, reunión…) y el ESTADO dice cómo acabó (abierta,
 * ganada, perdida, abandonada). Son dos cosas distintas y se ven a la vez: una
 * ganada se queda en la columna donde se cerró, pintada en verde.
 */

export type OportunidadEstado = "ABIERTA" | "GANADA" | "PERDIDA" | "ABANDONADA";

export const OPORTUNIDAD_ESTADOS: OportunidadEstado[] = [
  "ABIERTA",
  "GANADA",
  "PERDIDA",
  "ABANDONADA",
];

/**
 * Cómo se llama cada estado en pantalla. En la base de datos la fila se guarda
 * como ABIERTA/GANADA/…, pero lo que se lee es "Activo", igual que el resto del
 * software dice Activo/Inactivo y no "abierto".
 */
export const OPORTUNIDAD_ESTADO_LABEL: Record<OportunidadEstado, string> = {
  ABIERTA: "Activo",
  GANADA: "Ganado",
  PERDIDA: "Perdido",
  ABANDONADA: "Abandonado",
};

/** El color con el que se pinta cada estado, igual en tablero, lista y ficha. */
export const OPORTUNIDAD_ESTADO_CLASE: Record<OportunidadEstado, string> = {
  ABIERTA: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  GANADA: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  PERDIDA: "bg-red-500/10 text-red-700 border-red-500/30",
  ABANDONADA: "bg-muted text-muted-foreground border-border",
};

export interface Pipeline {
  id: string;
  empresa_id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/** Una columna del tablero. `icono` es el emoji que la encabeza. */
export interface PipelineFase {
  id: string;
  pipeline_id: string;
  nombre: string;
  icono: string | null;
  color: string | null;
  orden: number;
  activa: boolean;
}

export interface Oportunidad {
  id: string;
  empresa_id: string;
  pipeline_id: string;
  fase_id: string;
  /** Ficha de la persona en Producto → Clientes. */
  cliente_id: string | null;
  nombre: string;
  telefono: string | null;
  email: string | null;
  valor: number;
  fuente: string | null;
  asignado_a: string | null;
  estado: OportunidadEstado;
  motivo_cierre: string | null;
  notas: string | null;
  etiquetas: string[];
  /** Cuándo entró en la columna en la que está: de aquí salen los días en fase. */
  fase_at: string;
  estado_at: string;
  cierre_previsto: string | null;
  external_id: string | null;
  external_contacto_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Lo que necesita el tablero para pintarse de una sola consulta. */
export interface TableroPipeline {
  pipelines: Pipeline[];
  pipeline: Pipeline | null;
  fases: PipelineFase[];
  oportunidades: Oportunidad[];
}
