"use client";

/**
 * Selector de hora al estilo del módulo de CoverManager: el cliente NO escribe
 * una hora, pulsa una de las que el restaurante tiene realmente abiertas.
 *
 * Las horas se agrupan por turno (Comida / Cena) y las que están completas se
 * muestran deshabilitadas en vez de ocultarse, para que se vea que ese pase
 * existe pero está lleno.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  listarDisponibilidadPublicaAction,
  type SlotPublico,
} from "@/features/reservar-publica/actions/listar-disponibilidad-publica";

interface Props {
  empresaSlug: string;
  fecha: string;
  personas: number;
  horaSeleccionada: string | null;
  onSelect: (hora: string) => void;
  accent: string;
  onAccent: string;
}

export function SelectorDisponibilidad({
  empresaSlug,
  fecha,
  personas,
  horaSeleccionada,
  onSelect,
  accent,
  onAccent,
}: Props) {
  const [slots, setSlots] = useState<SlotPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!fecha) return;
    let cancelado = false;
    setCargando(true);
    (async () => {
      const r = await listarDisponibilidadPublicaAction({ empresaSlug, fecha, personas });
      if (cancelado) return;
      if (!r.ok) {
        setSlots([]);
        setMensaje(r.error);
      } else {
        setSlots(r.slots);
        setMensaje(r.mensaje);
      }
      setCargando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaSlug, fecha, personas]);

  // Si la hora elegida deja de estar disponible (cambio de fecha o de
  // comensales), se deselecciona para no enviar una hora inválida.
  useEffect(() => {
    if (!horaSeleccionada) return;
    const sigueValida = slots.some((s) => s.hora === horaSeleccionada && s.disponible);
    if (!sigueValida && !cargando) onSelect("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, cargando]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Buscando horarios…
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
        {mensaje ?? "No hay horarios disponibles para este día."}
      </div>
    );
  }

  const grupos = (
    [
      { clave: "COMIDA", titulo: "Comida", items: slots.filter((s) => s.turno === "COMIDA") },
      { clave: "CENA", titulo: "Cena", items: slots.filter((s) => s.turno === "CENA") },
    ] as Array<{ clave: "COMIDA" | "CENA"; titulo: string; items: SlotPublico[] }>
  ).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.clave}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {g.titulo}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {g.items.map((s) => {
              const activa = horaSeleccionada === s.hora;
              return (
                <button
                  key={`${g.clave}-${s.hora}`}
                  type="button"
                  disabled={!s.disponible}
                  onClick={() => onSelect(s.hora)}
                  title={s.motivo ?? undefined}
                  className={[
                    "h-11 rounded-lg border text-sm font-semibold transition-colors tabular-nums",
                    s.disponible
                      ? activa
                        ? "border-transparent"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                      : "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-300 line-through",
                  ].join(" ")}
                  style={
                    activa && s.disponible
                      ? { background: accent, color: onAccent }
                      : undefined
                  }
                >
                  {s.hora}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-zinc-400">
        Las horas tachadas están completas para {personas}{" "}
        {personas === 1 ? "persona" : "personas"}.
      </p>
    </div>
  );
}
