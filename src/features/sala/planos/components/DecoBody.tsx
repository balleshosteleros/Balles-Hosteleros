/**
 * Render visual de una decoración de plano (sin posición/rotación).
 *
 * Componente compartido entre el editor (`SalaPlanoEditor`) y la vista de
 * reservas (`ReservasView`/`PlanoCanvas`). Mantener un único origen evita que
 * el lienzo del editor y el del board de reservas diverjan visualmente.
 *
 * Paleta: solo blancos, grises y negros. La sala no debe parecer un mapa de
 * colores — los colores quedan reservados para zonas y estados de mesa.
 */
import { DoorOpen, Flower2, Trees } from "lucide-react";
import type { TipoDecoracion } from "@/features/sala/planos/data/planos";

/** Tamaños por defecto de cada decoración (en px del canvas estándar 1200x640). */
export const DECO_DEFAULTS: Record<TipoDecoracion, { width: number; height: number }> = {
  maceta: { width: 40, height: 40 },
  planta_grande: { width: 72, height: 72 },
  pasillo: { width: 220, height: 32 },
  pared: { width: 180, height: 14 },
  puerta: { width: 50, height: 50 },
  escaleras: { width: 90, height: 60 },
  barra: { width: 220, height: 40 },
  cocina: { width: 220, height: 40 },
  columna: { width: 36, height: 36 },
  ventana: { width: 120, height: 14 },
  wc: { width: 50, height: 50 },
};

export function DecoBody({
  tipo,
  width,
  height,
  counterRotation = 0,
}: {
  tipo: TipoDecoracion;
  width: number;
  height: number;
  /** Para tipos con texto, contra-rota la etiqueta para mantenerla legible. */
  counterRotation?: number;
}) {
  const baseStyle = { width, height } as const;
  switch (tipo) {
    case "maceta":
      return (
        <div
          className="flex items-center justify-center rounded-md bg-white border border-zinc-500 text-zinc-700"
          style={baseStyle}
        >
          <Flower2 className="h-1/2 w-1/2" />
        </div>
      );
    case "planta_grande":
      return (
        <div
          className="flex items-center justify-center rounded-full bg-white border border-zinc-500 text-zinc-700"
          style={baseStyle}
        >
          <Trees className="h-1/2 w-1/2" />
        </div>
      );
    case "pared":
      return (
        <div
          className="bg-white border border-zinc-700"
          style={{ ...baseStyle, borderRadius: 2 }}
        />
      );
    case "pasillo":
      return (
        <div
          className="bg-transparent border-y-2 border-dashed border-zinc-500"
          style={baseStyle}
        />
      );
    case "columna":
      return (
        <div
          className="rounded-full bg-white border border-zinc-700"
          style={baseStyle}
        />
      );
    case "ventana":
      return (
        <div
          className="bg-white border border-zinc-500"
          style={{
            ...baseStyle,
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 14px, rgba(0,0,0,0.45) 14px 16px)",
          }}
        />
      );
    case "puerta":
      return (
        <div
          className="flex items-center justify-center rounded-md bg-white border border-zinc-500 text-zinc-700"
          style={baseStyle}
        >
          <DoorOpen className="h-3/5 w-3/5" />
        </div>
      );
    case "escaleras":
      return (
        <div
          className="rounded-sm border border-zinc-500 bg-white overflow-hidden"
          style={baseStyle}
        >
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, rgba(0,0,0,0.55) 0 6px, transparent 6px 12px)",
            }}
          />
        </div>
      );
    case "barra":
      return (
        <div
          className="flex items-center justify-center rounded-md bg-white border border-zinc-500 text-zinc-700 text-[11px] font-bold"
          style={baseStyle}
        >
          <span style={{ transform: `rotate(${-counterRotation}deg)` }}>BARRA</span>
        </div>
      );
    case "cocina":
      return (
        <div
          className="flex items-center justify-center rounded-md bg-white border border-zinc-500 text-zinc-700 text-[11px] font-bold"
          style={baseStyle}
        >
          <span style={{ transform: `rotate(${-counterRotation}deg)` }}>COCINA</span>
        </div>
      );
    case "wc":
      return (
        <div
          className="flex items-center justify-center rounded-md bg-white border border-zinc-500 text-zinc-700 text-[11px] font-bold"
          style={baseStyle}
        >
          <span style={{ transform: `rotate(${-counterRotation}deg)` }}>WC</span>
        </div>
      );
  }
}
