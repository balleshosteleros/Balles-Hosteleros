"use client";

/**
 * SELECTOR DE MESA CON AVISOS
 * ===========================
 * Antes de elegir mesa hay que ver de un golpe cuáles sirven y cuáles no. Cada
 * mesa lleva su diagnóstico delante del código:
 *
 *   ✅  vale: cabe el grupo y está libre a esa hora.
 *   ⏰  choca por HORARIO: ya tiene reserva en esa franja (se pisaría).
 *   👥  choca por AFORO: el grupo no encaja en su capacidad.
 *   ⏰👥 los dos problemas a la vez.
 *
 * Son dos diagnósticos independientes a propósito: una mesa puede estar
 * completamente libre y aun así ser demasiado pequeña, y al revés. Mezclarlos
 * en un único "no disponible" obliga a abrir la mesa para saber qué le pasa.
 *
 * Vive aparte de la vista porque lo usan CREAR y EDITAR reserva, y los avisos
 * tienen que decir exactamente lo mismo en los dos sitios: la mesa que sale
 * verde al crear no puede salir sin marcar al editar.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Mesa } from "@/features/sala/data/reservas";

/** Capacidad real del catálogo para una mesa. */
export interface AforoMesa {
  tipo: "excede" | "insuficiente";
  min: number;
  max: number;
}

export interface EstadoMesaParaReserva {
  /** ⏰ La mesa ya tiene reserva viva que solapa con la franja pedida. */
  ocupada: boolean;
  /** 👥 El grupo no encaja en la capacidad de la mesa (o null si encaja). */
  aforo: AforoMesa | null;
}

/**
 * Prefijo visual de una mesa. El tick solo aparece cuando NO hay ningún
 * problema: un ✅ junto a un ⏰ diría dos cosas contrarias a la vez.
 */
export function iconosMesa(estado: EstadoMesaParaReserva): string {
  const avisos = `${estado.ocupada ? "⏰" : ""}${estado.aforo ? "👥" : ""}`;
  return avisos || "✅";
}

export interface SelectorMesaConAvisosProps {
  /** Mesa elegida (id) o "" si no hay ninguna. */
  value: string;
  onChange: (mesaId: string) => void;
  /** Mesas ofrecidas, ya filtradas por zona/local. */
  mesas: Mesa[];
  /** Diagnóstico de cada mesa. La clave es el id de mesa. */
  estadoPorMesa: Map<string, EstadoMesaParaReserva>;
  disabled?: boolean;
  /** Texto de la opción vacía. */
  placeholder?: string;
  /** Permite dejar la reserva sin mesa (opción vacía). */
  permitirSinMesa?: boolean;
  className?: string;
  /** Etiqueta de estado operativo ("Libre", "Sentada"…), si la vista la tiene. */
  etiquetaEstado?: (m: Mesa) => string;
}

export function SelectorMesaConAvisos({
  value,
  onChange,
  mesas,
  estadoPorMesa,
  disabled,
  placeholder = "— Sin asignar —",
  permitirSinMesa = true,
  className,
  etiquetaEstado,
}: SelectorMesaConAvisosProps) {
  /** ¿Hay algo marcado? Si no, la leyenda sobra y solo mete ruido. */
  const hayAvisos = useMemo(
    () =>
      mesas.some((m) => {
        const e = estadoPorMesa.get(m.id);
        return e ? e.ocupada || e.aforo != null : false;
      }),
    [mesas, estadoPorMesa],
  );

  return (
    <div className="space-y-1">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 w-full rounded-md border border-input bg-background px-2 text-xs",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {(permitirSinMesa || !value) && <option value="">{placeholder}</option>}
        {mesas.map((m) => {
          const estado = estadoPorMesa.get(m.id) ?? { ocupada: false, aforo: null };
          // La etiqueta de la vista ("Libre", "Sentada"…) describe el TURNO
          // entero, mientras que el ⏰ mira solo la franja que se está
          // reservando. Cuando la mesa está ocupada en esa franja, decir
          // "Libre" contradice al icono de al lado: se pone "Reservada", que
          // es lo que de verdad pasa a esa hora.
          const etiqueta = etiquetaEstado?.(m) ?? "";
          const tag =
            estado.ocupada && etiqueta === "Libre" ? "Reservada" : etiqueta;
          return (
            <option key={m.id} value={m.id}>
              {iconosMesa(estado)} {m.codigo} · {m.capacidad}p{tag ? ` · ${tag}` : ""}
            </option>
          );
        })}
      </select>
      {hayAvisos && (
        <p className="text-[10px] text-muted-foreground">
          ✅ disponible · ⏰ ya reservada a esa hora · 👥 el grupo no encaja
        </p>
      )}
    </div>
  );
}

/**
 * Aviso a pie de selector para la mesa YA elegida. Es el detalle que el icono
 * de la lista no puede dar: cuánta gente admite la mesa y cuánta viene.
 */
export function AvisoAforoMesa({
  aforo,
  comensales,
}: {
  aforo: AforoMesa | null;
  comensales: number;
}) {
  if (!aforo) return null;
  return (
    <p className="flex items-start gap-1 text-[10px] text-rose-700 dark:text-rose-300">
      <span aria-hidden>👥</span>
      <span>
        {aforo.tipo === "excede"
          ? `Esta mesa admite máximo ${aforo.max} y quieres sentar a ${comensales}.`
          : `Esta mesa es para mínimo ${aforo.min} y solo vienen ${comensales}.`}
      </span>
    </p>
  );
}
