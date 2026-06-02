"use client";

import type { EmpresaReservasRegla, VigenciaSpec } from "../data/reglas";
import { vigenciaEnHumano } from "../lib/vigencia-format";

interface Props {
  /** Acepta una regla persistida o una vigencia "intencional" (form). */
  value: EmpresaReservasRegla | VigenciaSpec;
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
