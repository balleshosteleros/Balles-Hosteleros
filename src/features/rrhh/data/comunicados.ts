export type EstadoComunicado = "borrador" | "programado" | "publicado" | "archivado";
export type Recurrencia = "sin_repeticion" | "diaria" | "semanal" | "mensual" | "anual";

export const ESTADO_COMUNICADO_LABELS: Record<EstadoComunicado, string> = {
  borrador: "Borrador",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

export const RECURRENCIA_LABELS: Record<Recurrencia, string> = {
  sin_repeticion: "No",
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
  cuerpo: string;
  estado: EstadoComunicado;
  creadorId: string;
  creadoEl: string;
  envio: string | null;
  recurrencia: Recurrencia;
  alcancePct: number;
  rolesDestinatarios: string[];
  todaEmpresa: boolean;
  /** Departamentos elegidos, por nombre. Vacío si va a toda la empresa. */
  departamentosDestinatarios: string[];
  /** Empleados elegidos, por su login. Vacío si va a toda la empresa. */
  empleadosDestinatarios: string[];
  destinatarios: DestinatarioInfo;
  tipo: TipoComunicado;
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

/**
 * TIPO de comunicado. No es una prioridad: es de qué va, y cada uno se reconoce
 * por su color (Iván, 10-09-2026).
 *   · Urgente     → rojo
 *   · Novedades   → amarillo
 *   · Informativo → verde
 */
export const TIPOS_COMUNICADO = ["urgente", "novedades", "informativo"] as const;
export type TipoComunicado = (typeof TIPOS_COMUNICADO)[number];

export const TIPO_COMUNICADO_LABEL: Record<TipoComunicado, string> = {
  urgente: "Urgente",
  novedades: "Novedades",
  informativo: "Informativo",
};

/** Lo que llegue raro (o de antes) se lee como informativo. */
export function tipoComunicado(v: unknown): TipoComunicado {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (TIPOS_COMUNICADO as readonly string[]).includes(s)
    ? (s as TipoComunicado)
    : "informativo";
}

/** Colores del tipo, para la píldora de las listas y las fichas. */
export const TIPO_COMUNICADO_COLOR: Record<TipoComunicado, string> = {
  urgente: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  novedades: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  informativo: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
};

/** Punto de color del tipo. */
export const TIPO_COMUNICADO_PUNTO: Record<TipoComunicado, string> = {
  urgente: "bg-rose-500",
  novedades: "bg-amber-400",
  informativo: "bg-emerald-500",
};

/** Recuadro del comunicado, del color de su tipo. */
export const TIPO_COMUNICADO_BORDE: Record<TipoComunicado, string> = {
  urgente: "border-rose-300 dark:border-rose-900",
  novedades: "border-amber-300 dark:border-amber-900",
  informativo: "border-emerald-300 dark:border-emerald-900",
};

/** Fondo suave del mismo color, para la cabecera plegada. */
export const TIPO_COMUNICADO_FONDO: Record<TipoComunicado, string> = {
  urgente: "bg-rose-50/60 dark:bg-rose-950/20",
  novedades: "bg-amber-50/60 dark:bg-amber-950/20",
  informativo: "bg-emerald-50/60 dark:bg-emerald-950/20",
};
