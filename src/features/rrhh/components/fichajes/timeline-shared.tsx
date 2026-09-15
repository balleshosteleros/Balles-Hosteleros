"use client";

/**
 * Piezas compartidas del timeline de fichajes (escala 0–24h): helpers de
 * posición, la regla horaria, la barra de una fila (previsto gris + fichado por
 * color con tooltips) y la leyenda. Lo usan la vista por día (fila=empleado) y la
 * vista mensual del empleado (fila=día).
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TramoFichado, TramoPrevisto } from "@/features/rrhh/actions/horas-actions";

export const MIN_DIA = 1440;
export const HORAS = Array.from({ length: 24 }, (_, i) => i); // 0..23 (columnas)

export function hhmmAMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function pos(iniMin: number, finMin: number | null): { left: string; width: string } {
  const fin = finMin == null ? iniMin + 30 : finMin <= iniMin ? finMin + MIN_DIA : finMin;
  const dur = Math.min(fin - iniMin, MIN_DIA - iniMin);
  return {
    left: `${(iniMin / MIN_DIA) * 100}%`,
    width: `${Math.max((dur / MIN_DIA) * 100, 0.8)}%`,
  };
}

/**
 * Color de un tramo fichado. Mismos tres del catálogo `tipos_fichaje`: normal
 * verde, por solicitud azul, horas extras rojo.
 */
export function colorFichado(t: TramoFichado): string {
  if (t.extra) return "bg-red-500";
  if (t.origen === "solicitud") return "bg-blue-500";
  return "bg-emerald-500";
}

/** "8h 30min" a partir de horas decimales. */
export function fmtHM(h: number): string {
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  return min === 0 ? `${horas}h 00min` : `${horas}h ${String(min).padStart(2, "0")}min`;
}

/** Regla horaria 0–24 (cabecera). Alinea con la barra de cada fila. */
export function ReglaHoras() {
  return (
    <div className="relative flex-1 border-r">
      <div className="flex">
        {HORAS.map((h) => (
          <div key={h} className="flex-1 border-l py-2 pl-1 tabular-nums">
            {String(h).padStart(2, "0")}
          </div>
        ))}
      </div>
      <span className="absolute right-0 top-2 -mr-2 tabular-nums">24</span>
    </div>
  );
}

/**
 * Barra de una fila del timeline, en escala 0–24h. Son DOS líneas que nunca se
 * tapan:
 *
 *   • arriba, gruesa y de color, los FICHAJES (verde normal, azul por
 *     solicitud, rojo horas extras);
 *   • debajo, fina y gris, el HORARIO previsto — solo dice a qué hora le tocaba
 *     entrar y salir, y está siempre, no se puede quitar.
 *
 * Antes iban superpuestas y el gris pasaba por encima del color, así que el
 * fichaje quedaba partido por la mitad y no se leía ninguno de los dos.
 */
export function TimelineBarra({
  previsto,
  fichado,
}: {
  previsto: TramoPrevisto[];
  fichado: TramoFichado[];
}) {
  return (
    <div className="relative h-5 w-full border-r border-muted/40">
      {/* Líneas de hora de fondo (24 columnas = 24 horas completas) */}
      <div className="absolute inset-0 flex">
        {HORAS.map((h) => (
          <div key={h} className="flex-1 border-l border-muted/40" />
        ))}
      </div>
      {/* Fichaje (color), arriba y grueso. Tooltip con tipo + horario realizado. */}
      {fichado.map((t, i) => {
        const ini = hhmmAMin(t.horaInicio);
        if (ini == null) return null;
        const { left, width } = pos(ini, hhmmAMin(t.horaFin));
        const etiquetaTipo = t.extra
          ? "Fichaje horas extras"
          : t.origen === "solicitud"
            ? "Fichaje por solicitud"
            : "Fichaje normal";
        return (
          <Tooltip key={`f-${i}`}>
            <TooltipTrigger asChild>
              <div
                className={`absolute top-0.5 z-20 h-2.5 cursor-help rounded-full ${colorFichado(t)}`}
                style={{ left, width }}
              />
            </TooltipTrigger>
            <TooltipContent className="text-center">
              <div className="font-semibold">{etiquetaTipo}</div>
              <div className="tabular-nums">
                {t.horaInicio} – {t.horaFin ?? "en curso"}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {/* Horario previsto (gris), abajo y fino: la referencia, siempre visible. */}
      {previsto.map((tr, i) => {
        const ini = hhmmAMin(tr.inicio);
        const fin = hhmmAMin(tr.fin);
        if (ini == null || fin == null) return null;
        const { left, width } = pos(ini, fin);
        let dur = fin - ini;
        if (dur < 0) dur += 1440;
        return (
          <Tooltip key={`p-${i}`}>
            <TooltipTrigger asChild>
              <div
                className="absolute bottom-0.5 z-10 h-1 cursor-help rounded-full bg-zinc-400/80"
                style={{ left, width }}
              />
            </TooltipTrigger>
            <TooltipContent className="text-center">
              {tr.turnoNombre && <div className="font-semibold uppercase">{tr.turnoNombre}</div>}
              <div className="text-muted-foreground">turno · {fmtHM(dur / 60)}</div>
              <div className="tabular-nums">
                {tr.inicio} – {tr.fin}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Leyenda de colores del timeline. */
export function LeyendaTimeline() {
  const items = [
    { c: "bg-zinc-400/80", l: "Horario previsto" },
    { c: "bg-emerald-500", l: "Fichaje normal" },
    { c: "bg-blue-500", l: "Fichaje por solicitud" },
    { c: "bg-red-500", l: "Fichaje horas extras" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.l} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2 w-4 rounded-full ${it.c}`} />
          {it.l}
        </span>
      ))}
    </div>
  );
}
