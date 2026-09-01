"use client";

/**
 * SELECTOR DE HORA EN CUARTOS
 * ===========================
 * La hora de una reserva solo puede ser :00, :15, :30 o :45 (ver
 * `reserva-cuartos`). Con un `<input type="time">` el usuario podía teclear
 * 12:07 y el navegador lo daba por bueno; aquí la hora se ELIGE, así que no
 * existe forma de escribir una fuera de la cuadrícula.
 *
 * Dos desplegables (hora y minuto) en vez de uno solo con las ~96 horas del
 * día: una lista de 96 elementos obliga a hacer scroll para llegar a las 21:45,
 * y era parte de lo que hacía que el selector se viera descuadrado y con
 * huecos. Aquí siempre son 24 + 4 opciones, y los dos controles ocupan
 * exactamente el ancho disponible sin dejar espacios muertos.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { MINUTOS_VALIDOS_RESERVA } from "@/features/sala/lib/reserva-cuartos";

const CLASE_SELECT =
  "h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface SelectorHoraCuartosProps {
  /** Hora actual en "HH:MM" (admite "HH:MM:SS"). Vacío = sin elegir. */
  value: string;
  /** Recibe siempre "HH:MM" ya en cuarto, o "" mientras falte una de las dos mitades. */
  onChange: (hora: string) => void;
  /** Se dispara al terminar de elegir (equivalente al blur de un input). */
  onCommit?: (hora: string) => void;
  disabled?: boolean;
  /** Marca el control en ámbar: hay un aviso sobre esta hora (p. ej. solape). */
  aviso?: boolean;
  className?: string;
  /**
   * Horas del turno permitidas ("HH:MM"). Si se pasan, el desplegable de horas
   * solo ofrece esas: fuera del horario de apertura no se sienta a nadie.
   */
  horasPermitidas?: string[];
  /**
   * Cuando la hora es obligatoria (un horario de apertura, el extremo de un
   * tramo), no se ofrece la opción vacía: dejarla en blanco guardaría un
   * horario sin hora. Por defecto sí se permite, porque al crear una reserva
   * "sin elegir" es un estado legítimo mientras se rellena el formulario.
   */
  requerido?: boolean;
}

export function SelectorHoraCuartos({
  value,
  onChange,
  onCommit,
  disabled,
  aviso,
  className,
  horasPermitidas,
  requerido = false,
}: SelectorHoraCuartosProps) {
  const [hh, mm] = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})/.exec((value ?? "").trim());
    if (!m) return ["", ""] as const;
    const horas = String(Number(m[1])).padStart(2, "0");
    // Una hora que venga fuera de cuadrícula (dato viejo) no se inventa: se
    // deja el minuto vacío para que se vea que hay que elegirlo.
    const min = Number(m[2]);
    const minuto = MINUTOS_VALIDOS_RESERVA.includes(min as 0 | 15 | 30 | 45)
      ? String(min).padStart(2, "0")
      : "";
    return [horas, minuto] as const;
  }, [value]);

  /** Horas ofrecidas: las del turno si se acotan, o las 24 del día. */
  const horas = useMemo(() => {
    if (horasPermitidas && horasPermitidas.length > 0) {
      const vistas = new Set<string>();
      for (const h of horasPermitidas) {
        const trozo = h.slice(0, 2);
        if (trozo) vistas.add(trozo);
      }
      // La hora que ya tiene la reserva se mantiene aunque el horario haya
      // cambiado después: si no, al abrir la ficha desaparecería su propia hora.
      if (hh) vistas.add(hh);
      return [...vistas].sort();
    }
    return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  }, [horasPermitidas, hh]);

  const emitir = (nuevaHH: string, nuevoMM: string) => {
    // Elegir la hora sin haber tocado el minuto asume el cuarto en punto: es lo
    // que se espera al escoger "21" y evita dejar el campo a medias.
    const minutoFinal = nuevoMM || (nuevaHH ? "00" : "");
    const completa = nuevaHH && minutoFinal ? `${nuevaHH}:${minutoFinal}` : "";
    onChange(completa);
    if (completa) onCommit?.(completa);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <select
        aria-label="Hora"
        disabled={disabled}
        value={hh}
        onChange={(e) => emitir(e.target.value, mm)}
        className={cn(CLASE_SELECT, aviso && "border-amber-500")}
      >
        {!requerido && <option value="">--</option>}
        {horas.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">:</span>
      <select
        aria-label="Minutos"
        disabled={disabled || !hh}
        value={mm}
        onChange={(e) => emitir(hh, e.target.value)}
        className={cn(CLASE_SELECT, aviso && "border-amber-500")}
      >
        {!mm && <option value="">--</option>}
        {MINUTOS_VALIDOS_RESERVA.map((m) => (
          <option key={m} value={String(m).padStart(2, "0")}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}
