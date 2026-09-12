/**
 * Lo que una sanción deja guardado mientras espera a que llegue su día.
 *
 * Vive en el campo `sancion` del comunicado: son los tres datos que ningún
 * comunicado había necesitado nunca —la calificación de la falta, el día de los
 * hechos y los días que tiene para firmarla— y sin los cuales, el día que sale,
 * no se puede montar el documento.
 *
 * Aparte de las acciones a propósito: un archivo `"use server"` solo puede
 * exportar funciones async, y esto no lo es.
 */

import { GRAVEDAD_LABEL, type GravedadSancion } from "@/features/gerencia/services/sancion-disciplinaria-pdf";

export interface SancionProgramada {
  gravedad: GravedadSancion;
  fechaHechos: string;
  plazoDias: number;
}

/** Lee el campo `sancion` de un comunicado. Lo que venga a medias no vale. */
export function leerSancionProgramada(raw: unknown): SancionProgramada | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const gravedad = typeof r.gravedad === "string" ? r.gravedad : "";
  if (!(gravedad in GRAVEDAD_LABEL)) return null;
  const fechaHechos = typeof r.fechaHechos === "string" ? r.fechaHechos : "";
  if (!fechaHechos) return null;
  const plazo = Number(r.plazoDias);
  return {
    gravedad: gravedad as GravedadSancion,
    fechaHechos,
    plazoDias: Number.isFinite(plazo) && plazo > 0 ? Math.min(60, Math.round(plazo)) : 15,
  };
}
