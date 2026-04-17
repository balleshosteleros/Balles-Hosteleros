/**
 * Clasificador de estados de cocina.
 * Encapsula la lógica de transiciones válidas y el mapeo a columnas del kanban.
 */

import type {
  ColumnaKDS,
  LineaEstadoCocina,
  NivelAlerta,
  UmbralesAlarma,
} from "../types";

// ─── Transiciones permitidas ──────────────────────────────────
const TRANSICIONES_VALIDAS: Record<LineaEstadoCocina, LineaEstadoCocina[]> = {
  PENDIENTE: ["PREPARANDO", "CANCELADA"],
  PREPARANDO: ["LISTO", "PENDIENTE", "CANCELADA"], // PENDIENTE = undo manual
  LISTO: ["SERVIDO", "PREPARANDO", "CANCELADA"], // PREPARANDO = undo
  SERVIDO: ["LISTO"], // undo
  CANCELADA: ["PENDIENTE"], // re-abrir
};

export function transicionValida(
  desde: LineaEstadoCocina,
  hasta: LineaEstadoCocina,
): boolean {
  if (desde === hasta) return true;
  return TRANSICIONES_VALIDAS[desde]?.includes(hasta) ?? false;
}

// ─── Mapeo a columnas del kanban ──────────────────────────────
export function columnaDeLinea(estado: LineaEstadoCocina): ColumnaKDS | null {
  if (estado === "CANCELADA") return null;
  return estado;
}

export const COLUMNAS_ORDEN: ColumnaKDS[] = [
  "PENDIENTE",
  "PREPARANDO",
  "LISTO",
  "SERVIDO",
];

export const COLUMNA_LABELS: Record<ColumnaKDS, string> = {
  PENDIENTE: "Pendiente",
  PREPARANDO: "En curso",
  LISTO: "Listo",
  SERVIDO: "Servido",
};

// ─── Nivel de alerta según minutos transcurridos desde enviada_at
export function nivelAlerta(
  minutosTranscurridos: number,
  umbrales: Pick<
    UmbralesAlarma,
    "umbralAmbarMin" | "umbralRojoMin" | "umbralParpadeoMin"
  >,
): NivelAlerta {
  if (minutosTranscurridos >= umbrales.umbralParpadeoMin) return "PARPADEO";
  if (minutosTranscurridos >= umbrales.umbralRojoMin) return "ROJO";
  if (minutosTranscurridos >= umbrales.umbralAmbarMin) return "AMBAR";
  return "OK";
}

// ─── Minutos entre un ISO string y ahora ──────────────────────
export function minutosDesde(isoDate: string, now: Date = new Date()): number {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now.getTime() - t) / 60_000);
}
