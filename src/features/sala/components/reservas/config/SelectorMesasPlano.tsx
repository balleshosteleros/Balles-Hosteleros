"use client";

/**
 * Selector de mesas para armar una combinación.
 *
 * Las mesas se listan agrupadas por zona. Se muestran como chips porque el
 * plano dibujado a escala salía ilegible dentro del modal.
 *
 * Una combinación no puede mezclar zonas: en cuanto se elige la primera mesa,
 * las de otras zonas se deshabilitan en vez de dejar armar algo imposible y
 * rechazarlo al guardar.
 */

import { useMemo } from "react";
import type { Mesa, Zona } from "@/features/sala/planos/data/planos";

interface Props {
  mesas: Mesa[];
  zonas: Zona[];
  seleccionadas: string[];
  onToggle: (mesaId: string) => void;
  color: string;
}

export function SelectorMesasPlano({
  mesas,
  zonas,
  seleccionadas,
  onToggle,
  color,
}: Props) {
  /** Zona de la primera mesa elegida: manda sobre el resto de la selección. */
  const zonaFijada = useMemo(() => {
    if (seleccionadas.length === 0) return null;
    return mesas.find((m) => m.id === seleccionadas[0])?.zonaId ?? null;
  }, [seleccionadas, mesas]);

  const grupos = useMemo(() => {
    const porZona = new Map<string, Mesa[]>();
    for (const m of mesas) {
      porZona.set(m.zonaId, [...(porZona.get(m.zonaId) ?? []), m]);
    }
    return [...porZona.entries()]
      .map(([zonaId, lista]) => ({
        zonaId,
        nombre: zonas.find((z) => z.id === zonaId)?.nombre ?? "Sin zona",
        // Orden natural: TE2 antes que TE10.
        mesas: [...lista].sort((a, b) =>
          a.codigo.localeCompare(b.codigo, undefined, { numeric: true }),
        ),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [mesas, zonas]);

  if (mesas.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic px-1">
        No hay mesas creadas en este local.
      </p>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[42vh] overflow-y-auto rounded-md border p-3">
      {grupos.map((g) => {
        const zonaBloqueada = zonaFijada !== null && g.zonaId !== zonaFijada;
        return (
          <div key={g.zonaId}>
            <p
              className={`text-[11px] uppercase tracking-wider mb-1.5 ${
                zonaBloqueada ? "text-muted-foreground/40" : "text-muted-foreground"
              }`}
            >
              {g.nombre}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.mesas.map((m) => {
                const sel = seleccionadas.includes(m.id);
                const bloqueada = zonaBloqueada && !sel;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={bloqueada}
                    onClick={() => onToggle(m.id)}
                    title={
                      bloqueada
                        ? `Otra zona (${g.nombre}). Quita las mesas elegidas para cambiar.`
                        : `${m.codigo} · ${m.capacidadMin}-${m.capacidadMax} per`
                    }
                    className={[
                      "rounded border px-2 h-8 text-xs font-semibold transition-colors",
                      sel
                        ? "border-transparent text-white"
                        : bloqueada
                          ? "border-dashed text-muted-foreground/35 cursor-not-allowed"
                          : "hover:border-foreground",
                    ].join(" ")}
                    style={sel ? { backgroundColor: color } : undefined}
                  >
                    {m.codigo}
                    <span className="ml-1 font-normal opacity-70">
                      {m.capacidadMax}p
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
