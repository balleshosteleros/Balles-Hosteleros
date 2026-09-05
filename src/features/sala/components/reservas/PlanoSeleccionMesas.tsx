"use client";

/**
 * El lienzo de la sala en modo SELECCIÓN, para la reasignación manual de mesas
 * de una reserva (ver `EditorMesasReserva`).
 *
 * Es el mismo plano de la vista de sala, con las mismas medidas y los mismos
 * colores de zona, pero sin popovers ni estados de ocupación: aquí una mesa
 * solo puede estar elegida o no, y elegirla nunca guarda nada por sí solo.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { DecoBody } from "@/features/sala/planos/components/DecoBody";
import type {
  FormaMesa,
  PlanoMesaPosicion,
  SalaDecoracion,
  Zona as ZonaReal,
} from "@/features/sala/planos/data/planos";
import type { Mesa, Reserva } from "@/features/sala/data/reservas";
import { colorZona } from "@/features/sala/lib/color-zona";
import {
  dimsDeMesa,
  PLANO_CANVAS_H,
  PLANO_CANVAS_W,
  type MesaMetaPlano,
} from "@/features/sala/components/reservas/plano-mesas-medidas";

/** Aire alrededor del lienzo, descontado al calcular la escala. */
const PADDING_LIENZO = 8;

/**
 * El plano en modo selección. Es el mismo lienzo de la vista de sala, pero sin
 * popovers ni estados: aquí una mesa solo puede estar elegida o no.
 */
export function PlanoSeleccionMesas({
  mesas,
  posiciones,
  mesasMeta,
  zonas,
  decoraciones,
  esOscuro,
  seleccion,
  originales,
  onToggle,
  getReservasMesa,
  reservaId,
}: {
  mesas: Mesa[];
  posiciones: Map<string, PlanoMesaPosicion>;
  mesasMeta: Map<string, MesaMetaPlano>;
  zonas: ZonaReal[];
  decoraciones: SalaDecoracion[];
  esOscuro: boolean;
  seleccion: string[];
  originales: string[];
  /** Pulsación sobre una mesa. `sumar` = Ctrl/⌘ pulsado (unir sin cambiar de modo). */
  onToggle: (codigo: string, sumar: boolean) => void;
  getReservasMesa: (mesaId: string) => Reserva[];
  reservaId: string;
}) {
  const clamp = (x: number, y: number, w: number, h: number) => ({
    x: Math.max(0, Math.min(PLANO_CANVAS_W - w, x)),
    y: Math.max(0, Math.min(PLANO_CANVAS_H - h, y)),
  });

  const labelsZonas = useMemo(() => {
    const out: { id: string; nombre: string; color: string; x: number; y: number }[] = [];
    for (const z of zonas) {
      const mesasZona = mesas.filter(
        (m) => String(m.zona ?? "").toUpperCase() === z.nombre.toUpperCase(),
      );
      if (mesasZona.length === 0) continue;
      if (z.etiquetaX != null && z.etiquetaY != null) {
        out.push({ id: z.id, nombre: z.nombre, color: z.colorPastel, x: z.etiquetaX, y: z.etiquetaY });
        continue;
      }
      let minX = Infinity;
      let minY = Infinity;
      for (const m of mesasZona) {
        const pos = posiciones.get(m.id);
        if (!pos) continue;
        const dims = dimsDeMesa(mesasMeta.get(m.id)?.forma ?? "cuadrada", pos);
        const c = clamp(pos.x, pos.y, dims.w, dims.h);
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
      }
      if (Number.isFinite(minX)) {
        out.push({ id: z.id, nombre: z.nombre, color: z.colorPastel, x: minX, y: minY - 30 });
      }
    }
    return out;
  }, [zonas, mesas, posiciones, mesasMeta]);

  // El lienzo mide siempre 1200x640 (como el editor de Ajustes) y se reduce
  // para caber ENTERO en el hueco que le queda dentro del modal: se mide el
  // ancho y el alto disponibles y manda el más apretado de los dos. Así el
  // salón se ve completo de un vistazo, sin desplazar nada, que es justo lo que
  // hace falta cuando la mesa que se quiere unir está al fondo del comedor.
  //
  // OJO con el bucle: el hueco se mide en un contenedor cuyo tamaño NO depende
  // del lienzo (el lienzo va posicionado en absoluto dentro de él). Si se
  // midiera un padre que el propio lienzo empuja, cada cambio de escala
  // dispararía otra medición y el plano se quedaría oscilando sin arrancar.
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - PADDING_LIENZO * 2;
      const h = el.clientHeight - PADDING_LIENZO * 2;
      if (w <= 0 || h <= 0) return;
      const s = Math.min(w / PLANO_CANVAS_W, h / PLANO_CANVAS_H, 1);
      if (s > 0) setScale(s);
    };
    update();
    const ro = new ResizeObserver(() => {
      // En el mismo frame que la medición el navegador aún puede reportar
      // tamaños intermedios del diálogo al abrirse; se difiere al siguiente.
      requestAnimationFrame(update);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        ref={outerRef}
        className="relative min-h-0 w-full flex-1 overflow-hidden rounded-lg border bg-muted/20"
      >
        <div
          className="absolute origin-center"
          style={{
            width: PLANO_CANVAS_W,
            height: PLANO_CANVAS_H,
            top: "50%",
            left: "50%",
            // Se centra por transform, no por layout: así el lienzo no
            // participa en el tamaño del contenedor que lo mide.
            transform: `translate(-50%, -50%) scale(${scale})`,
            visibility: scale > 0 ? "visible" : "hidden",
          }}
        >
          {decoraciones.map((d) => (
            <div
              key={d.id}
              className="absolute pointer-events-none select-none"
              style={{
                left: Math.max(0, Math.min(PLANO_CANVAS_W - d.width, d.x)),
                top: Math.max(0, Math.min(PLANO_CANVAS_H - d.height, d.y)),
                width: d.width,
                height: d.height,
                transform: `rotate(${d.rotation}deg)`,
                transformOrigin: "center",
              }}
            >
              <DecoBody tipo={d.tipo} width={d.width} height={d.height} counterRotation={d.rotation} />
            </div>
          ))}

          {labelsZonas.map((l) => (
            <span
              key={l.id}
              className={cn(
                "absolute rounded px-2 py-0.5 text-[11px] font-bold tracking-wide shadow-sm pointer-events-none",
                esOscuro ? "text-zinc-100" : "text-zinc-800",
              )}
              style={{
                left: l.x,
                top: Math.max(8, l.y),
                backgroundColor: colorZona(l.color, esOscuro),
              }}
            >
              {l.nombre}
            </span>
          ))}

          {mesas.map((m) => {
            const pos = posiciones.get(m.id)!;
            const meta = mesasMeta.get(m.id);
            const forma: FormaMesa = meta?.forma ?? "cuadrada";
            const dims = dimsDeMesa(forma, pos);
            const c = clamp(pos.x, pos.y, dims.w, dims.h);
            const codigo = m.codigo.toUpperCase();
            const elegida = seleccion.includes(codigo);
            const eraDeLaReserva = originales.includes(codigo);
            // Reservas de OTROS que ya ocupan esta mesa. No impide elegirla
            // (la decisión es del local), pero se avisa aquí y al validar.
            const otras = getReservasMesa(m.id).filter((r) => r.id !== reservaId);
            const ocupadaPorOtra = otras.length > 0;
            return (
              <button
                key={m.id}
                type="button"
                onClick={(e) => onToggle(codigo, e.metaKey || e.ctrlKey)}
                title={
                  ocupadaPorOtra
                    ? `${m.codigo} · ocupada por ${otras[0].cliente || "WALK IN"} a las ${otras[0].hora.slice(0, 5)}`
                    : `${m.codigo} · ${meta?.capacidadMin ?? "?"}-${meta?.capacidadMax ?? "?"} per`
                }
                className={cn(
                  "absolute flex flex-col items-center justify-center overflow-hidden border-2 px-1 text-[11px] font-semibold transition-all cursor-pointer",
                  // El foco del navegador se quedaba pegado tras pulsar: la
                  // mesa seguía resaltada como si el ratón estuviera encima,
                  // y con varias pulsadas no se distinguía cuál estaba elegida.
                  // Se conserva el anillo SOLO para quien navega con teclado.
                  "outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                  // Borde rojo: misma norma visual que la mesa seleccionada en
                  // el plano de la vista de sala.
                  elegida
                    ? "ring-[10px] ring-red-500 z-10 !border-red-500 !border-4"
                    : "border-foreground/30 hover:border-foreground",
                  ocupadaPorOtra && !elegida && "border-amber-500/70",
                )}
                style={{
                  left: c.x,
                  top: c.y,
                  width: dims.w,
                  height: dims.h,
                  borderRadius: forma === "redonda" ? 9999 : 6,
                  // Mismo color que en el plano de la vista: aclarado en tema
                  // claro, apagado conservando el matiz en oscuro.
                  backgroundColor: colorZona(meta?.colorZona ?? "#FDE68A", esOscuro),
                  transform: pos.rotation ? `rotate(${pos.rotation}deg)` : undefined,
                }}
              >
                <div
                  className="pointer-events-none flex flex-col items-center justify-center leading-tight text-foreground"
                  style={pos.rotation ? { transform: `rotate(${-pos.rotation}deg)` } : undefined}
                >
                  <span className="flex items-center gap-0.5 leading-none">
                    {elegida && <Check className="h-3 w-3" />}
                    {m.codigo}
                  </span>
                  <span className="mt-0.5 text-[9px] font-normal opacity-80">
                    ({m.capacidad}p)
                  </span>
                  {eraDeLaReserva && (
                    <span className="text-[8px] font-normal uppercase opacity-70">
                      actual
                    </span>
                  )}
                  {ocupadaPorOtra && !eraDeLaReserva && (
                    <span className="truncate max-w-full text-[8px] font-normal opacity-80">
                      {otras[0].hora.slice(0, 5)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 flex flex-wrap items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-red-500 ring-[3px] ring-red-500" />
          En esta reserva
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-amber-500/70" />
          Ocupada por otra reserva
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-foreground/30" />
          Libre
        </span>
      </div>
    </div>
  );
}
