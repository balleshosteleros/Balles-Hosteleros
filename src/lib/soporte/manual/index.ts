/**
 * El manual completo del software: lo que el asistente tiene que saber.
 *
 * Se indexa en `soporte_conocimiento` con fuente 'software', de forma
 * idempotente por `ref`. Ver `services/indexar-manual.ts`.
 */

import { MANUAL_GENERAL } from "./general";
import { MANUAL_DIRECCION } from "./direccion";
import { MANUAL_SALA } from "./sala";
import { MANUAL_COCINA } from "./cocina";
import { MANUAL_LOGISTICA } from "./logistica";
import { MANUAL_GERENCIA } from "./gerencia";
import { MANUAL_CALIDAD } from "./calidad";
import { MANUAL_RRHH } from "./rrhh";
import { MANUAL_MARKETING } from "./marketing";
import { MANUAL_CONTABILIDAD } from "./contabilidad";
import { MANUAL_GESTORIA } from "./gestoria";
import { MANUAL_OTROS } from "./otros";
import type { ArticuloManual } from "./tipos";

export type { ArticuloManual } from "./tipos";

export const MANUAL_SOFTWARE: ArticuloManual[] = [
  ...MANUAL_GENERAL,
  ...MANUAL_DIRECCION,
  ...MANUAL_SALA,
  ...MANUAL_COCINA,
  ...MANUAL_LOGISTICA,
  ...MANUAL_GERENCIA,
  ...MANUAL_CALIDAD,
  ...MANUAL_RRHH,
  ...MANUAL_MARKETING,
  ...MANUAL_CONTABILIDAD,
  ...MANUAL_GESTORIA,
  ...MANUAL_OTROS,
];

/** Prefijo de `origen_ref` en la base de conocimiento. */
export const PREFIJO_MANUAL = "sw:";
