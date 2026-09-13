"use client";

/**
 * Pulgar arriba / pulgar abajo de un comunicado.
 *
 * Va en la esquina de abajo de cada comunicado, en todos y sin configurar
 * nada. Es un termómetro para quien lo publica —si lo que se cuenta llega bien
 * o no—: no responde a nadie ni abre ninguna conversación.
 *
 * Pulsar el que ya está marcado RETIRA el voto. No hay forma de equivocarse sin
 * arreglo: se cambia y se quita cuando se quiera.
 */

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { valorarComunicado } from "../actions/comunicados-vistos-actions";

export function ValoracionComunicado({
  comunicadoId,
  valorInicial,
  className,
}: {
  comunicadoId: string;
  /** `true` arriba, `false` abajo, `null` sin votar. */
  valorInicial: boolean | null;
  className?: string;
}) {
  const [valor, setValor] = useState<boolean | null>(valorInicial);
  const [guardando, setGuardando] = useState(false);

  async function votar(nuevo: boolean) {
    // Volver a pulsar lo ya marcado = retirar el voto.
    const destino = valor === nuevo ? null : nuevo;
    const anterior = valor;
    setValor(destino);
    setGuardando(true);
    const res = await valorarComunicado(comunicadoId, destino);
    setGuardando(false);
    if (!res.ok) {
      setValor(anterior);
      toast.error(res.error ?? "No se pudo guardar tu valoración.");
    }
  }

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      {/* Sin rótulo: dos pulgares no necesitan que nadie explique para qué son,
          y la pregunta escrita solo añadía ruido (Iván, 13-09-2026). Lo que
          hace cada botón sigue dicho en su `aria-label`, para quien lo lea con
          un lector de pantalla. */}
      <button
        type="button"
        onClick={() => void votar(true)}
        disabled={guardando}
        aria-pressed={valor === true}
        aria-label={valor === true ? "Quitar el me gusta" : "Me gusta"}
        title={valor === true ? "Quitar el me gusta" : "Me gusta"}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border transition-colors active:scale-95",
          valor === true
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-border text-muted-foreground hover:bg-muted",
        )}
      >
        <ThumbsUp className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={() => void votar(false)}
        disabled={guardando}
        aria-pressed={valor === false}
        aria-label={valor === false ? "Quitar el no me gusta" : "No me gusta"}
        title={valor === false ? "Quitar el no me gusta" : "No me gusta"}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border transition-colors active:scale-95",
          valor === false
            ? "border-rose-500 bg-rose-500 text-white"
            : "border-border text-muted-foreground hover:bg-muted",
        )}
      >
        <ThumbsDown className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
    </div>
  );
}
