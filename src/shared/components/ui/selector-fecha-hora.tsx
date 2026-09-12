"use client";

/**
 * Fecha Y hora en un solo campo — sustituye al `<input type="datetime-local">`.
 *
 * El nativo es el peor de todos: junta el calendario y el reloj del sistema
 * operativo en un mismo recuadro, con el formato del navegador (mm/dd/yyyy,
 * AM/PM) y dejando teclear encima.
 *
 * Aquí son las dos piezas de la casa, una al lado de la otra. Habla como el
 * nativo: `value` y `onChange` con "AAAA-MM-DDTHH:MM".
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { SelectorHora } from "@/components/ui/selector-hora";

export interface SelectorFechaHoraProps {
  /** "AAAA-MM-DDTHH:MM" (admite segundos). Vacío = sin elegir. */
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Primer día elegible, "AAAA-MM-DD". */
  min?: string;
  /** Cada cuántos minutos se ofrece la hora. */
  paso?: number;
}

export function SelectorFechaHora({
  value,
  onChange,
  disabled,
  className,
  id,
  min,
  paso,
}: SelectorFechaHoraProps) {
  const [fecha, hora] = React.useMemo(() => {
    const v = (value ?? "").trim();
    if (!v) return ["", ""] as const;
    const [f, h = ""] = v.split("T");
    return [f, h.slice(0, 5)] as const;
  }, [value]);

  // Hasta que no están las dos mitades no hay dato: una fecha sin hora no es
  // un "cuándo", y guardarla a medias dejaba campañas programadas a las 00:00.
  const emitir = (f: string, h: string) => onChange(f && h ? `${f}T${h}` : "");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SelectorFecha
        id={id}
        value={fecha}
        min={min}
        disabled={disabled}
        onChange={(f) => emitir(f, hora)}
        className="flex-1"
      />
      <SelectorHora
        value={hora}
        paso={paso}
        disabled={disabled}
        onChange={(h) => emitir(fecha, h)}
      />
    </div>
  );
}
