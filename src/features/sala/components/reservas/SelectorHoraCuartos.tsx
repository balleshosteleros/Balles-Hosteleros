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
 * día: una lista de 96 elementos obliga a hacer scroll para llegar a las 21:45.
 * Aquí siempre son 24 + 4 opciones, y van DENTRO DEL MISMO RECUADRO para que
 * se lean como el dato único que son.
 */

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MINUTOS_VALIDOS_RESERVA } from "@/features/sala/lib/reserva-cuartos";

/**
 * Los dos desplegables van dentro de UN SOLO recuadro: hora y minuto son un
 * único dato ("22:30"), y con dos cajas separadas se leían como dos campos
 * distintos. El borde y el fondo los pone el contenedor; cada `select` va
 * desnudo dentro, sin borde ni fondo propios.
 */
const CLASE_CAJA =
  // `justify-center`: el par "HH : MM" va CENTRADO en su recuadro. Antes los
  // dos `select` llevaban `flex-1` y se repartían todo el ancho sobrante, así
  // que el número quedaba pegado al borde izquierdo y su flecha en la otra
  // punta, con un vacío enorme en medio (Iván, 06-sep).
  "flex h-7 items-center justify-center gap-0.5 rounded-md border border-input " +
  "bg-background px-1 focus-within:ring-1 focus-within:ring-ring";

const CLASE_SELECT =
  // Sin `flex-1`: cada desplegable ocupa SOLO lo que mide su contenido, y el
  // texto va centrado dentro. `appearance-none` quita la flecha nativa, que es
  // la que separaba el número de su propio hueco; la flecha del conjunto se
  // pinta una sola vez, al final de la caja.
  "h-full w-auto min-w-0 appearance-none border-0 bg-transparent px-0.5 " +
  "text-center text-xs tabular-nums " +
  "focus:outline-none focus-visible:outline-none " +
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
    <div className={cn(CLASE_CAJA, aviso && "border-amber-500", className)}>
      <select
        aria-label="Hora"
        disabled={disabled}
        value={hh}
        onChange={(e) => emitir(e.target.value, mm)}
        className={CLASE_SELECT}
      >
        {!requerido && <option value="">--</option>}
        {horas.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="shrink-0 text-xs text-muted-foreground">:</span>
      <select
        aria-label="Minutos"
        disabled={disabled || !hh}
        value={mm}
        onChange={(e) => emitir(hh, e.target.value)}
        className={CLASE_SELECT}
      >
        {!mm && <option value="">--</option>}
        {MINUTOS_VALIDOS_RESERVA.map((m) => (
          <option key={m} value={String(m).padStart(2, "0")}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      {/* UNA flecha para todo el control, no una por desplegable: es un solo
          dato ("22:30"). Va al final y sin puntero, para que el clic siga
          cayendo en el `select` que hay debajo. */}
      <ChevronDown
        aria-hidden
        className="ml-0.5 size-3 shrink-0 text-muted-foreground"
      />
    </div>
  );
}
