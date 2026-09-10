export type EstadoComunicado = "borrador" | "programado" | "publicado" | "archivado";
export type Recurrencia = "sin_repeticion" | "semanal" | "mensual" | "personalizado";

export const ESTADO_COMUNICADO_LABELS: Record<EstadoComunicado, string> = {
  borrador: "Borrador",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

export const RECURRENCIA_LABELS: Record<Recurrencia, string> = {
  sin_repeticion: "Sin repetición",
  semanal: "Semanal",
  mensual: "Mensual",
  personalizado: "Personalizado",
};

export interface DestinatarioInfo {
  empresas: number;
  departamentos: number;
  empleados: number;
}

export interface Comunicado {
  id: string;
  titulo: string;
  asunto: string;
  cuerpo: string;
  estado: EstadoComunicado;
  creadorId: string;
  creadoEl: string;
  envio: string | null;
  recurrencia: Recurrencia;
  alcancePct: number;
  rolesDestinatarios: string[];
  todaEmpresa: boolean;
  destinatarios: DestinatarioInfo;
  prioridad: "baja" | "normal" | "alta" | "urgente";
  observaciones: string;
}
