"use client";

import type { VigenciaSource, VigenciaSpec } from "../data/reglas";
import { vigenciaEnHumano } from "../lib/vigencia-format";

interface Props {
  /**
   * Acepta una regla persistida (cualquier entidad con los 4 campos de
   * vigencia: fechaDesde, fechaHasta, diasSemana, fechasExtra) o una
   * vigencia "intencional" (form).
   */
  value: VigenciaSource | VigenciaSpec;
  className?: string;
}

/** Badge minimalista con la vigencia en sentence-case. */
export function VigenciaBadge({ value, className }: Props) {
  return (
    <span
      className={`inline-flex items-center text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground ${className ?? ""}`}
    >
      {vigenciaEnHumano(value)}
    </span>
  );
}
