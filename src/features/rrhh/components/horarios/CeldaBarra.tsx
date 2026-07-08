"use client";

/**
 * Barra comparativa PREVISTO vs FICHADO de una celda (empleado × día) del
 * cuadrante. Escala fija 0–24h para que todas las celdas se alineen.
 *
 *   • Gris suave de fondo = tramo(s) PREVISTO(s) por el horario (la "sombra").
 *   • Encima, los tramos FICHADOS coloreados por origen:
 *       verde = fichaje normal directo
 *       azul  = fichaje normal por solicitud
 *       rojo  = fichaje extra por solicitud
 *
 * Al superponerse se aprecia si cumplió el horario, se pasó o se quedó corto.
 */

import type { TramoFichado } from "@/features/rrhh/actions/horas-actions";

const MIN_DIA = 1440;

/** "HH:MM" → minutos del día (0–1439). null si no válido. */
function hhmmAMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** left%/width% de un tramo en escala 0–24h (resuelve cruce de medianoche). */
function pos(iniMin: number, finMin: number): { left: string; width: string } {
  let fin = finMin;
  if (fin <= iniMin) fin += MIN_DIA; // cruza medianoche
  const dur = Math.min(fin - iniMin, MIN_DIA - iniMin); // no desbordar el día
  return {
    left: `${(iniMin / MIN_DIA) * 100}%`,
    width: `${Math.max((dur / MIN_DIA) * 100, 1.5)}%`, // mínimo visible
  };
}

function colorFichado(t: TramoFichado): string {
  if (t.extra) return "bg-rose-500"; // extra por solicitud
  if (t.origen === "solicitud") return "bg-sky-500"; // normal por solicitud
  return "bg-emerald-500"; // normal directo
}

export function CeldaBarra({
  previsto,
  fichado,
}: {
  previsto: { inicio: string; fin: string }[];
  fichado: TramoFichado[];
}) {
  const hayPrevisto = previsto.length > 0;
  const hayFichado = fichado.length > 0;
  if (!hayPrevisto && !hayFichado) return null;

  return (
    <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-muted/40">
      {/* Previsto (gris, de fondo/sombra) */}
      {previsto.map((tr, i) => {
        const ini = hhmmAMin(tr.inicio);
        const fin = hhmmAMin(tr.fin);
        if (ini == null || fin == null) return null;
        const { left, width } = pos(ini, fin);
        return (
          <div
            key={`p-${i}`}
            className="absolute top-0 h-full rounded-full bg-muted-foreground/25"
            style={{ left, width }}
          />
        );
      })}
      {/* Fichado (color según origen), encima */}
      {fichado.map((t, i) => {
        const ini = hhmmAMin(t.horaInicio);
        const fin = hhmmAMin(t.horaFin);
        if (ini == null || fin == null) return null;
        const { left, width } = pos(ini, fin);
        return (
          <div
            key={`f-${i}`}
            className={`absolute top-0 h-full rounded-full ${colorFichado(t)}`}
            style={{ left, width, opacity: 0.9 }}
          />
        );
      })}
    </div>
  );
}

/** Leyenda de colores del cuadrante (previsto + orígenes de fichaje). */
export function LeyendaBarras() {
  const items: { color: string; label: string }[] = [
    { color: "bg-muted-foreground/25", label: "Previsto (horario)" },
    { color: "bg-emerald-500", label: "Fichado normal" },
    { color: "bg-sky-500", label: "Normal por solicitud" },
    { color: "bg-rose-500", label: "Extra por solicitud" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2 w-4 rounded-full ${it.color}`} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
