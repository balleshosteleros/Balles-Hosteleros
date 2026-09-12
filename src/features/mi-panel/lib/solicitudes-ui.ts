import type { EstadoDenuncia } from "@/features/mi-panel/actions/denuncias-actions";

/**
 * Lo común entre la pantalla de solicitudes del móvil y la del ordenador: las
 * dos enseñan exactamente lo mismo, en pestañas por tipo, y solo cambian las
 * medidas. Vive aquí para que al tocar una no se quede la otra distinta.
 */

/**
 * Los cuatro tipos que puede pedir un empleado, cada uno en su pestaña. No hay
 * vista «todas» a propósito: mezclarlos no dice nada, se miran por tipo.
 */
export type SolicitudTabKey = "ausencias" | "trabajos" | "entregas" | "quejas";

export const SOLICITUD_TABS: Array<{ key: SolicitudTabKey; label: string }> = [
  { key: "ausencias", label: "Ausencias" },
  { key: "trabajos", label: "Trabajos" },
  { key: "entregas", label: "Entregas" },
  { key: "quejas", label: "Quejas" },
];

export const ESTADO_DOT: Record<string, string> = {
  pendiente: "bg-amber-500",
  aprobada: "bg-emerald-500",
  rechazada: "bg-rose-500",
  anulada: "bg-slate-400",
};

/**
 * Una queja sigue su propio ciclo (recibida → investigación → resuelta), así
 * que no se traduce al estado de una solicitud: se muestra el suyo. Los
 * nombres salen de `DENUNCIA_ESTADO_LABEL`, comunes con el panel.
 */
export const DENUNCIA_ESTADO_DOT: Record<EstadoDenuncia, string> = {
  recibida: "bg-blue-500",
  en_investigacion: "bg-amber-500",
  informacion_solicitada: "bg-purple-500",
  resuelta: "bg-emerald-500",
  archivada: "bg-slate-400",
};

/** Día/mes/año, como en toda la app. */
export function formatFechaSolicitud(s: string): string {
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}
