"use client";

/**
 * EL selector de hora del software — sustituye al `<input type="time">`.
 *
 * El reloj del navegador lo pinta el sistema operativo: en Mac sale una rueda
 * diminuta, en Windows otra cosa, y en un Chrome en inglés pide AM/PM. Además
 * deja TECLEAR dentro, así que se podía guardar "7:5" o una hora que no existe.
 *
 * Aquí la hora se ELIGE: dos desplegables nuestros —hora y minuto— dentro de un
 * mismo recuadro, porque "22:30" es un dato único y con dos cajas separadas se
 * leía como dos campos. Se prefiere esto a una sola lista con las 288 horas del
 * día, que obliga a bajar hasta el final para llegar a las 23:45.
 *
 * Habla como el campo nativo —`value` y `onChange` con "HH:MM"— para poder
 * sustituirlo sin tocar la lógica de ningún formulario. Admite "HH:MM:SS", que
 * es como vienen las horas de la base de datos.
 */

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Desplegable } from "@/components/ui/desplegable";

/** Los dos desplegables van desnudos dentro de un único recuadro. */
const CLASE_CAJA =
  "inline-flex h-9 items-center justify-center gap-0.5 rounded-md border border-input " +
  "bg-background px-1 focus-within:ring-1 focus-within:ring-ring";

const CLASE_SELECT =
  // Sin flecha propia ni borde: la flecha se pinta UNA vez para todo el
  // control, al final, porque hora y minuto son el mismo dato.
  "h-full w-auto min-w-0 appearance-none border-0 bg-transparent px-0.5 shadow-none " +
  "text-center text-sm tabular-nums " +
  "focus:outline-none focus-visible:outline-none focus-visible:ring-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface SelectorHoraProps {
  /** Hora en "HH:MM" (admite "HH:MM:SS"). Vacío = sin elegir. */
  value: string;
  /** Recibe "HH:MM", o "" mientras falte una de las dos mitades. */
  onChange: (hora: string) => void;
  /** Se dispara al quedar la hora completa (equivale al blur del campo nativo). */
  onCommit?: (hora: string) => void;
  disabled?: boolean;
  /** Marca el recuadro en ámbar: hay un aviso sobre esta hora (p. ej. solape). */
  aviso?: boolean;
  /** Más bajo y con letra pequeña: para filas de tabla y fichas apretadas. */
  compacto?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  /** Cada cuántos minutos se ofrece. Por defecto, de 5 en 5. */
  paso?: number;
  /** Minutos concretos, cuando el negocio solo admite unos pocos (cuartos). */
  minutosPermitidos?: readonly number[];
  /** Horas ofrecidas ("HH" o "HH:MM"). Sin esto, las 24 del día. */
  horasPermitidas?: readonly string[];
  /** Sin opción vacía: la hora es obligatoria (el extremo de un turno). */
  requerido?: boolean;
  /**
   * Qué hacer con un minuto que no está en la lista (un dato viejo, 12:07 en
   * un selector de cuartos): enseñarlo tal cual —lo normal, no se toca el dato
   * de nadie— o vaciarlo para obligar a elegir uno bueno.
   */
  minutoFueraDeLista?: "mostrar" | "vaciar";
}

export function SelectorHora({
  value,
  onChange,
  onCommit,
  disabled,
  aviso,
  compacto = false,
  className,
  id,
  paso = 5,
  minutosPermitidos,
  horasPermitidas,
  requerido = false,
  minutoFueraDeLista = "mostrar",
  "aria-label": ariaLabel,
}: SelectorHoraProps) {
  const minutos = useMemo(() => {
    if (minutosPermitidos && minutosPermitidos.length > 0) return [...minutosPermitidos];
    const salto = paso > 0 ? paso : 5;
    return Array.from({ length: Math.ceil(60 / salto) }, (_, i) => i * salto);
  }, [minutosPermitidos, paso]);

  const [hh, mm] = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})/.exec((value ?? "").trim());
    if (!m) return ["", ""] as const;
    const horas = String(Number(m[1])).padStart(2, "0");
    const min = Number(m[2]);
    if (!minutos.includes(min) && minutoFueraDeLista === "vaciar") return [horas, ""] as const;
    return [horas, String(min).padStart(2, "0")] as const;
  }, [value, minutos, minutoFueraDeLista]);

  /** Horas ofrecidas: las acotadas, o las 24 del día. */
  const horas = useMemo(() => {
    if (horasPermitidas && horasPermitidas.length > 0) {
      const vistas = new Set<string>();
      for (const h of horasPermitidas) {
        const trozo = h.slice(0, 2);
        if (trozo) vistas.add(trozo);
      }
      // Su propia hora nunca desaparece, aunque el horario haya cambiado luego.
      if (hh) vistas.add(hh);
      return [...vistas].sort();
    }
    return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  }, [horasPermitidas, hh]);

  // Un minuto de fuera de la lista (dato viejo) se ofrece igualmente, o al
  // desplegar no aparecería el que la propia ficha tiene puesto.
  const minutosVisibles = useMemo(() => {
    const n = Number(mm);
    if (mm !== "" && !minutos.includes(n)) return [...minutos, n].sort((a, b) => a - b);
    return minutos;
  }, [minutos, mm]);

  const emitir = (nuevaHH: string, nuevoMM: string) => {
    // Elegir la hora sin tocar el minuto asume "en punto": es lo que se espera
    // al escoger "21" y evita dejar el campo a medias.
    const minutoFinal = nuevoMM || (nuevaHH ? "00" : "");
    const completa = nuevaHH && minutoFinal ? `${nuevaHH}:${minutoFinal}` : "";
    onChange(completa);
    if (completa) onCommit?.(completa);
  };

  const dosCifras = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      id={id}
      aria-label={ariaLabel}
      className={cn(
        CLASE_CAJA,
        compacto && "h-7",
        aviso && "border-amber-500",
        className,
      )}
    >
      <Desplegable
        aria-label="Hora"
        disabled={disabled}
        value={hh}
        onChange={(e) => emitir(e.target.value, mm)}
        className={cn(CLASE_SELECT, compacto && "text-xs")}
      >
        {!requerido && <option value="">--</option>}
        {horas.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Desplegable>
      <span className={cn("shrink-0 text-muted-foreground", compacto ? "text-xs" : "text-sm")}>
        :
      </span>
      <Desplegable
        aria-label="Minutos"
        disabled={disabled || !hh}
        value={mm}
        onChange={(e) => emitir(hh, e.target.value)}
        className={cn(CLASE_SELECT, compacto && "text-xs")}
      >
        {!mm && <option value="">--</option>}
        {minutosVisibles.map((m) => (
          <option key={m} value={dosCifras(m)}>
            {dosCifras(m)}
          </option>
        ))}
      </Desplegable>
      {/* UNA flecha para todo el control. Sin puntero, para que el clic caiga
          en el desplegable que hay debajo. */}
      <ChevronDown aria-hidden className="ml-0.5 size-3 shrink-0 text-muted-foreground" />
    </div>
  );
}
