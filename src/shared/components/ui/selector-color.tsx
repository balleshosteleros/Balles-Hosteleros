"use client";

/**
 * EL selector de color del software — sustituye al campo de color del navegador.
 *
 * Ese campo abre la ventana de colores del SISTEMA OPERATIVO: en Mac la rueda
 * con lupas y lápices, en Windows otra distinta, y en el móvil ni se sabe. Es
 * lo más ajeno que había en la app: se sale del software entero para elegir un
 * color de una etiqueta.
 *
 * Aquí se elige dentro: una rejilla con los colores de siempre, tres barras
 * (tono, viveza y luz) para afinar cualquier otro, y el código por si se quiere
 * teclear exacto. Todo con nuestras piezas.
 *
 * Habla como el campo nativo: `value` y `onChange` con "#RRGGBB".
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

/** Los 24 de la paleta: una fila por familia, de claro a oscuro. */
const PALETA = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E",
  "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E", "#78716C",
  "#000000", "#404040", "#737373", "#A3A3A3", "#D4D4D4", "#FFFFFF",
];

const HEX = /^#([0-9a-f]{6})$/i;

function normalizar(hex: string | null | undefined): string {
  const v = (hex ?? "").trim();
  if (HEX.test(v)) return v.toUpperCase();
  // Admite "#abc" y "abcdef" sin almohadilla, como hacía el campo nativo.
  const corto = /^#?([0-9a-f]{3})$/i.exec(v);
  if (corto) {
    const [r, g, b] = corto[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const sinAlmohadilla = /^([0-9a-f]{6})$/i.exec(v);
  if (sinAlmohadilla) return `#${sinAlmohadilla[1]}`.toUpperCase();
  return "#000000";
}

function hexAHsl(hex: string): [number, number, number] {
  const n = normalizar(hex).slice(1);
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslAHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  const dos = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${dos(r)}${dos(g)}${dos(b)}`;
}

export interface SelectorColorProps {
  /** Color en "#RRGGBB". */
  value: string | null | undefined;
  onChange: (hex: string) => void;
  disabled?: boolean;
  /** Clases del botón: hereda el alto y el ancho de donde estuviera el nativo. */
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function SelectorColor({
  value,
  onChange,
  disabled,
  className,
  id,
  "aria-label": ariaLabel = "Elegir color",
}: SelectorColorProps) {
  const color = normalizar(value);
  const [h, s, l] = hexAHsl(color);
  // Lo que se está tecleando en el código, mientras no sea un color válido.
  const [escrito, setEscrito] = React.useState<string | null>(null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "h-9 w-12 shrink-0 rounded-md border border-input shadow-sm transition-shadow",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 rounded-2xl p-3">
        <div className="grid grid-cols-6 gap-1.5">
          {PALETA.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={c}
              className={cn(
                "h-7 w-full rounded-md border transition-transform hover:scale-110",
                c === color ? "border-foreground ring-1 ring-foreground" : "border-black/10",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="space-y-2">
          <Barra etiqueta="Tono" valor={h} max={360} onValor={(v) => onChange(hslAHex(v, s, l))} />
          <Barra etiqueta="Viveza" valor={s} max={100} onValor={(v) => onChange(hslAHex(h, v, l))} />
          <Barra etiqueta="Luz" valor={l} max={100} onValor={(v) => onChange(hslAHex(h, s, v))} />
        </div>

        <div className="flex items-center gap-2">
          <span
            className="h-7 w-7 shrink-0 rounded-md border border-black/10"
            style={{ backgroundColor: color }}
          />
          <Input
            value={escrito ?? color}
            onChange={(e) => {
              const v = e.target.value;
              setEscrito(v);
              if (HEX.test(v.trim()) || /^#?[0-9a-f]{3}$/i.test(v.trim())) {
                onChange(normalizar(v));
                setEscrito(null);
              }
            }}
            onBlur={() => setEscrito(null)}
            className="h-7 font-mono text-xs uppercase"
            aria-label="Código del color"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Barra({
  etiqueta,
  valor,
  max,
  onValor,
}: {
  etiqueta: string;
  valor: number;
  max: number;
  onValor: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-muted-foreground">{etiqueta}</span>
      <Slider
        value={[valor]}
        max={max}
        step={1}
        onValueChange={([v]) => onValor(v)}
        className="flex-1"
      />
      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {valor}
      </span>
    </div>
  );
}
