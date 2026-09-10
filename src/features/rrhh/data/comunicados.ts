export type EstadoComunicado = "borrador" | "programado" | "publicado" | "archivado";
export type Recurrencia = "sin_repeticion" | "diaria" | "semanal" | "mensual" | "anual";

export const ESTADO_COMUNICADO_LABELS: Record<EstadoComunicado, string> = {
  borrador: "Borrador",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

export const RECURRENCIA_LABELS: Record<Recurrencia, string> = {
  sin_repeticion: "Sin repetición",
  diaria: "Diaria",
  semanal: "Semanal",
  mensual: "Mensual",
  anual: "Anual",
};

export interface DestinatarioInfo {
  empresas: number;
  departamentos: number;
  empleados: number;
}

import type { ComunicadoAdjunto } from "@/features/gerencia/data/comunicados-adjuntos";

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
  /** Documentos colgados del comunicado. Vacío = ninguno. */
  adjuntos: ComunicadoAdjunto[];
  /** Si al publicarlo sale además por correo a los destinatarios. */
  enviarEmail: boolean;
  /** Dirección que se abre con un botón desde el aviso y desde el comunicado. */
  enlace: string;
  /** Lo que se lee en ese botón. Vacío = "Abrir enlace". */
  enlaceTexto: string;
}
