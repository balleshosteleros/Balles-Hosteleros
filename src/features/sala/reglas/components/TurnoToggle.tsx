"use client";

import { Label } from "@/components/ui/label";
import { type TurnoRegla, TURNO_REGLA_LABELS } from "../data/reglas";

interface Props {
  value: TurnoRegla;
  onChange: (v: TurnoRegla) => void;
  /** Opciones permitidas. Por defecto las 3 (COMIDA, CENA, AMBOS). */
  options?: TurnoRegla[];
  label?: string;
}

const DEFAULT_OPTIONS: TurnoRegla[] = ["COMIDA", "CENA", "AMBOS"];

/**
 * Toggle group segmentado para elegir el turno al que aplica una regla.
 * Sentence case en todas las etiquetas.
 */
export function TurnoToggle({ value, onChange, options = DEFAULT_OPTIONS, label = "Aplicar a" }: Props) {
  return (
    <div className="space-y-1.5">
      {label ? <Label className="text-xs">{label}</Label> : null}
      <div className="inline-flex rounded-md border border-input p-0.5 bg-background">
        {options.map((opt) => {
          const activo = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={
                "px-3 py-1 text-xs rounded transition-colors " +
                (activo
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted")
              }
            >
              {TURNO_REGLA_LABELS[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
