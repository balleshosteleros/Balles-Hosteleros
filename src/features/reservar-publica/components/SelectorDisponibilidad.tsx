"use client";

/**
 * Selector de hora en desplegable, con la disponibilidad REAL del restaurante.
 *
 * El cliente no escribe una hora: elige una de las que están abiertas. Las
 * horas completas siguen listadas pero deshabilitadas, para que se vea que ese
 * pase existe y está lleno (en vez de desaparecer sin explicación).
 */

import { useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listarDisponibilidadPublicaAction,
  type SlotPublico,
  type CamposObligatoriosPublico,
} from "@/features/reservar-publica/actions/listar-disponibilidad-publica";

interface Props {
  empresaSlug: string;
  fecha: string;
  personas: number;
  horaSeleccionada: string | null;
  onSelect: (hora: string) => void;
  accent: string;
  /** Campos que la empresa exige además de los fijos (email / teléfono). */
  onObligatoriosChange?: (o: CamposObligatoriosPublico) => void;
}

export function SelectorDisponibilidad({
  empresaSlug,
  fecha,
  personas,
  horaSeleccionada,
  onSelect,
  accent,
  onObligatoriosChange,
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
        onObligatoriosChange?.(r.obligatorios);
      }
      setCargando(false);
    })();
    return () => {
      cancelado = true;
    };
    // `onObligatoriosChange` se omite a propósito: el padre la redefine en cada
    // render y volvería a lanzar la consulta de disponibilidad en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaSlug, fecha, personas]);

  // Si la hora elegida deja de estar disponible (cambio de fecha o de
  // comensales), se deselecciona para no enviar una hora inválida.
  useEffect(() => {
    if (!horaSeleccionada || cargando) return;
    const sigueValida = slots.some((s) => s.hora === horaSeleccionada && s.disponible);
    if (!sigueValida) onSelect("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, cargando]);

  if (cargando) {
    return (
      <div className="flex h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Buscando horarios…
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center text-sm text-amber-900">
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

  const libres = slots.filter((s) => s.disponible).length;

  if (libres === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center text-sm text-amber-900">
        No quedan mesas para {personas} {personas === 1 ? "persona" : "personas"} este día.
        Prueba otra fecha.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Select value={horaSeleccionada || undefined} onValueChange={onSelect}>
        <SelectTrigger
          className="h-12 rounded-xl border-zinc-200 bg-white text-base data-[placeholder]:text-zinc-400 sm:h-11 sm:text-sm"
          style={horaSeleccionada ? { borderColor: accent } : undefined}
        >
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
            <SelectValue placeholder="Elige una hora" />
          </span>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {grupos.map((g) => (
            <SelectGroup key={g.clave}>
              <SelectLabel className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {g.titulo}
              </SelectLabel>
              {g.items.map((s) => (
                <SelectItem
                  key={`${g.clave}-${s.hora}`}
                  value={s.hora}
                  disabled={!s.disponible}
                  className="tabular-nums"
                >
                  {s.hora}
                  {!s.disponible ? (
                    <span className="ml-2 text-xs text-zinc-400">
                      {s.motivo ?? "Completo"}
                    </span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-zinc-400">
        {libres} {libres === 1 ? "hora disponible" : "horas disponibles"} para {personas}{" "}
        {personas === 1 ? "persona" : "personas"}.
      </p>
    </div>
  );
}
