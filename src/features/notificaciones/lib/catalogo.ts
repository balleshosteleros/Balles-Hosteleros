/**
 * Catálogo central de tipos de notificación (PRP-065).
 *
 * Fuente única de verdad para etiqueta, color, label de acuse por defecto y si
 * el tipo requiere acción. Lo consumen la bandeja (NotificacionBell), la cola
 * (NotificacionesGate), el registro de Dirección y la capa `emitirNotificacion`.
 *
 * Módulo de datos puro (sin componentes React) para que pueda importarse tanto
 * en componentes cliente como en Server Actions sin problemas de bundling/SSR.
 * Los iconos viven en `catalogo-iconos.ts` (mapa clave → LucideIcon).
 */

export type TipoNotificacion =
  // Existentes (PRP-064 y previos)
  | "info"
  | "alerta"
  | "error"
  | "exito"
  | "recordatorio"
  | "liquidacion"
  | "liquidacion_pagada"
  // Motor de alertas (PRP-065)
  | "aviso_manual"
  | "vencimiento"
  | "cronograma"
  | "comunicado"
  // Flujo alta a gestoría → contrato → firma (PRP-068)
  | "gestoria_alta_enviada"
  | "gestoria_recordatorio"
  | "gestoria_contrato_subido"
  | "gestoria_contrato_firmado";

export interface TipoMeta {
  /** Etiqueta legible (sentence case). */
  label: string;
  /** Clave del icono en `catalogo-iconos.ts`. */
  icono: string;
  /** Color del icono / acento (clase Tailwind text-*). */
  color: string;
  /** Clase del badge de tipo en el registro. */
  badge: string;
  /** Texto por defecto del botón de acuse. */
  accionLabel: string;
  /** Si por defecto exige acción explícita del empleado. */
  requiereAccion: boolean;
}

export const TIPOS_NOTIFICACION: Record<TipoNotificacion, TipoMeta> = {
  info: {
    label: "Aviso",
    icono: "info",
    color: "text-sky-600",
    badge: "bg-sky-100 text-sky-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  alerta: {
    label: "Alerta",
    icono: "alerta",
    color: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  error: {
    label: "Error",
    icono: "error",
    color: "text-red-600",
    badge: "bg-red-100 text-red-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  exito: {
    label: "Aviso",
    icono: "exito",
    color: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  recordatorio: {
    label: "Recordatorio",
    icono: "recordatorio",
    color: "text-violet-600",
    badge: "bg-violet-100 text-violet-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  liquidacion: {
    label: "Liquidación",
    icono: "liquidacion",
    color: "text-primary",
    badge: "bg-primary/10 text-primary",
    accionLabel: "LIQUIDAR",
    requiereAccion: true,
  },
  liquidacion_pagada: {
    label: "Liquidación pagada",
    icono: "liquidacion",
    color: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  aviso_manual: {
    label: "Aviso",
    icono: "aviso_manual",
    color: "text-rose-500",
    badge: "bg-rose-100 text-rose-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  vencimiento: {
    label: "Vencimiento",
    icono: "vencimiento",
    color: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  cronograma: {
    label: "Tarea",
    icono: "cronograma",
    color: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  comunicado: {
    label: "Comunicado",
    icono: "comunicado",
    color: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  gestoria_alta_enviada: {
    label: "Gestoría",
    icono: "info",
    color: "text-sky-600",
    badge: "bg-sky-100 text-sky-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  gestoria_recordatorio: {
    label: "Gestoría",
    icono: "alerta",
    color: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  gestoria_contrato_subido: {
    label: "Contrato",
    icono: "info",
    color: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
  gestoria_contrato_firmado: {
    label: "Contrato firmado",
    icono: "exito",
    color: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    accionLabel: "Visto",
    requiereAccion: false,
  },
};

const FALLBACK: TipoMeta = {
  label: "Aviso",
  icono: "info",
  color: "text-muted-foreground",
  badge: "bg-muted text-muted-foreground",
  accionLabel: "Visto",
  requiereAccion: false,
};

/** Devuelve el meta del tipo, con fallback seguro para tipos desconocidos. */
export function getTipoMeta(tipo: string): TipoMeta {
  return TIPOS_NOTIFICACION[tipo as TipoNotificacion] ?? FALLBACK;
}
