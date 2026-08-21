"use client";

/**
 * Selector de mesas sobre el PLANO real, para armar una combinación.
 *
 * Antes se elegían de una lista de casillas: había que saberse los códigos de
 * memoria y no se veía si las mesas estaban pegadas o en extremos opuestos del
 * local — que es justo lo que decide si una combinación se puede montar.
 *
 * Aquí se pincha directamente sobre el plano. Las mesas de OTRA zona se
 * deshabilitan en cuanto eliges la primera: una combinación solo se puede
 * montar dentro de la misma zona, así que ni siquiera se ofrece el error.
 */

import { useMemo } from "react";
import type { Mesa, MesaPosicion, Zona } from "@/features/sala/planos/data/planos";

interface Props {
  mesas: Mesa[];
  posiciones: Map<string, MesaPosicion>;
  zonas: Zona[];
  seleccionadas: string[];
  onToggle: (mesaId: string) => void;
  color: string;
}

const LADO = 46;

export function SelectorMesasPlano({
  mesas,
  posiciones,
  zonas,
  seleccionadas,
  onToggle,
  color,
}: Props) {
  const conPos = useMemo(
    () => mesas.filter((m) => posiciones.has(m.id)),
    [mesas, posiciones],
  );

  // Zona de la primera mesa elegida: manda sobre el resto de la selección.
  const zonaFijada = useMemo(() => {
    if (seleccionadas.length === 0) return null;
    const primera = mesas.find((m) => m.id === seleccionadas[0]);
    return primera?.zonaId ?? null;
  }, [seleccionadas, mesas]);

  // Lienzo ajustado al contenido, con margen.
  const caja = useMemo(() => {
    const pts = conPos.map((m) => posiciones.get(m.id)!);
    if (pts.length === 0) return { w: 400, h: 300, minX: 0, minY: 0 };
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs) - 20;
    const minY = Math.min(...ys) - 20;
    return {
      minX,
      minY,
      w: Math.max(...xs) - minX + LADO + 20,
      h: Math.max(...ys) - minY + LADO + 20,
    };
  }, [conPos, posiciones]);

  if (conPos.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
        Las mesas de este local todavía no están colocadas en el plano. Colócalas
        en Estructura → editar plano de la sala para poder elegirlas aquí.
      </div>
    );
  }

  const nombreZona = (id: string | null) =>
    zonas.find((z) => z.id === id)?.nombre ?? "";

  return (
    <div className="space-y-1.5">
      <div className="relative overflow-auto rounded-md border bg-muted/20 max-h-[46vh]">
        <div
          className="relative"
          style={{ width: caja.w, height: caja.h, minWidth: "100%" }}
        >
          {conPos.map((m) => {
            const p = posiciones.get(m.id)!;
            const sel = seleccionadas.includes(m.id);
            // Bloqueada = de otra zona que la ya elegida. No se puede montar.
            const bloqueada = zonaFijada !== null && m.zonaId !== zonaFijada && !sel;
            return (
              <button
                key={m.id}
                type="button"
                disabled={bloqueada}
                onClick={() => onToggle(m.id)}
                title={
                  bloqueada
                    ? `${m.codigo} — otra zona (${nombreZona(m.zonaId)})`
                    : `${m.codigo} · ${m.capacidadMin}-${m.capacidadMax} pax`
                }
                className={[
                  "absolute flex flex-col items-center justify-center rounded-md border-2 text-[10px] font-bold leading-none transition-colors",
                  sel
                    ? "text-white"
                    : bloqueada
                      ? "border-dashed border-muted-foreground/25 bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
                      : "border-zinc-400 bg-background text-foreground hover:border-foreground",
                ].join(" ")}
                style={{
                  left: p.x - caja.minX,
                  top: p.y - caja.minY,
                  width: p.width ?? LADO,
                  height: p.height ?? LADO,
                  borderRadius: m.forma === "redonda" ? "50%" : undefined,
                  ...(sel ? { backgroundColor: color, borderColor: color } : {}),
                }}
              >
                <span>{m.codigo}</span>
                <span className="font-normal opacity-70">{m.capacidadMax}p</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {zonaFijada
          ? `Pincha las mesas de ${nombreZona(zonaFijada)} que se juntan. Las de otras zonas quedan deshabilitadas.`
          : "Pincha las mesas que se juntan. Al elegir la primera, solo podrás añadir mesas de su misma zona."}
      </p>
    </div>
  );
}
