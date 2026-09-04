"use client";

/**
 * Selector de hora en desplegable, con la disponibilidad REAL del restaurante.
 *
 * El cliente no escribe una hora: elige una de las que están abiertas. Las
 * horas completas siguen listadas pero deshabilitadas, para que se vea que ese
 * pase existe y está lleno (en vez de desaparecer sin explicación).
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { HORA_CORTE_DIA_NEGOCIO } from "@/features/sala/lib/dia-negocio";

/**
 * true si esa hora cae en la madrugada, que pertenece al servicio de la noche
 * anterior. Mismo criterio que el resto del software (`dia-negocio.ts`): el
 * día no cambia a medianoche, cambia a las 06:00.
 */
function esMadrugada(hora: string): boolean {
  const h = parseInt(hora.slice(0, 2), 10);
  return !Number.isNaN(h) && h < HORA_CORTE_DIA_NEGOCIO;
}

interface Props {
  empresaSlug: string;
  fecha: string;
  personas: number;
  horaSeleccionada: string | null;
  onSelect: (hora: string) => void;
  accent: string;
  /** Campos que la empresa exige además de los fijos (email / teléfono). */
  onObligatoriosChange?: (o: CamposObligatoriosPublico) => void;
  /**
   * Filtro extra de horas. Lo usa el canje de un Ticket: las horas que su
   * producto no permite ni se enseñan, en vez de dejar que las elija y
   * rechazarlas después.
   */
  horaPermitida?: (hora: string) => boolean;
}

export function SelectorDisponibilidad({
  empresaSlug,
  fecha,
  personas,
  horaSeleccionada,
  onSelect,
  horaPermitida,
  accent,
  onObligatoriosChange,
}: Props) {
  const [slotsCrudos, setSlotsCrudos] = useState<SlotPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Las horas que el ticket no permite se quitan de la lista. A diferencia de
  // las horas completas, éstas no se enseñan deshabilitadas: para este cliente
  // ese pase no existe, y mostrarlo solo genera la duda de por qué no puede.
  const slots = useMemo(
    () => (horaPermitida ? slotsCrudos.filter((s) => horaPermitida(s.hora)) : slotsCrudos),
    [slotsCrudos, horaPermitida],
  );

  useEffect(() => {
    if (!fecha) return;
    let cancelado = false;
    setCargando(true);
    (async () => {
      const r = await listarDisponibilidadPublicaAction({ empresaSlug, fecha, personas });
      if (cancelado) return;
      if (!r.ok) {
        setSlotsCrudos([]);
        setMensaje(r.error);
      } else {
        setSlotsCrudos(r.slots);
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
          <SelectValue placeholder="Elige una hora" />
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
                  {/*
                    La cena cruza la medianoche: tras las 23:45 la lista sigue
                    en 00:00, 00:15… y el número "se da la vuelta". Está bien
                    ordenada, pero leída de corrido parece descolocada, y el
                    cliente no sabe si esas horas son de esta noche o de la
                    anterior. Con la coletilla se lee de un vistazo que son la
                    madrugada siguiente, que es la misma noche de servicio.
                  */}
                  {esMadrugada(s.hora) ? (
                    <span className="ml-2 text-xs text-zinc-500">
                      (madrugada)
                    </span>
                  ) : null}
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
    </div>
  );
}
