"use client";

/**
 * SELECTOR DE HORA EN CUARTOS
 * ===========================
 * La hora de una reserva solo puede ser :00, :15, :30 o :45 (ver
 * `reserva-cuartos`). Con un `<SelectorHora >` el usuario podía teclear
 * 12:07 y el navegador lo daba por bueno; aquí la hora se ELIGE, así que no
 * existe forma de escribir una fuera de la cuadrícula.
 *
 * Por dentro es el selector de hora del software (`selector-hora.tsx`) con DOS
 * reglas propias de reservas: los minutos solo pueden ser 00, 15, 30 y 45, y
 * una hora vieja fuera de esa cuadrícula deja el minuto en blanco, para que se
 * vea que hay que elegir uno bueno.
 */

import { MINUTOS_VALIDOS_RESERVA } from "@/features/sala/lib/reserva-cuartos";
import { SelectorHora } from "@/components/ui/selector-hora";

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
  return (
    <SelectorHora
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      disabled={disabled}
      aviso={aviso}
      className={className}
      compacto
      horasPermitidas={horasPermitidas}
      requerido={requerido}
      minutosPermitidos={MINUTOS_VALIDOS_RESERVA}
      minutoFueraDeLista="vaciar"
    />
  );
}
