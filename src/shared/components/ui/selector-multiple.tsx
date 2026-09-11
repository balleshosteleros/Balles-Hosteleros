"use client";

import * as React from "react";
import { ChevronDown, Search, Star, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Desplegable PROPIO de varias opciones — el hermano multi de `SelectorOpcion`.
 *
 * Nace de los puestos de la ficha del empleado: veintitantas casillas sueltas
 * ocupaban la pantalla entera para enseñar, casi siempre, UN puesto marcado.
 * Aquí el campo cerrado dice solo lo que la persona lleva (en píldoras, el
 * destacado el primero) y la lista completa se abre al pulsarlo.
 *
 * Una de las opciones puede ir DESTACADA (el puesto principal): sale con
 * estrella y se cambia desde la propia lista.
 */

export interface OpcionMultiple {
  value: string;
  label: string;
  /** Nota a la derecha, en gris: el departamento del puesto, p. ej. */
  nota?: string;
  /** No se puede marcar ni desmarcar. */
  disabled?: boolean;
}

export interface SelectorMultipleProps {
  /** Valores marcados, en el orden en que se marcaron. */
  values: string[];
  opciones: OpcionMultiple[];
  /** Marcar o desmarcar una opción. Quien lo recibe decide si lo permite. */
  onToggle: (value: string, marcado: boolean) => void;
  id?: string;
  disabled?: boolean;
  /** Texto del campo cuando no hay nada marcado. */
  placeholder?: string;
  /** Texto cuando no hay ninguna opción que ofrecer. */
  vacioTexto?: string;
  /** Buscador dentro del panel. Por defecto, a partir de 8 opciones. */
  buscador?: boolean;
  className?: string;
  /** Valor con estrella (el principal). */
  destacado?: string;
  onDestacar?: (value: string) => void;
  /** Palabra de la etiqueta del destacado. */
  etiquetaDestacado?: string;
  "aria-label"?: string;
}

export function SelectorMultiple({
  values,
  opciones,
  onToggle,
  id,
  disabled,
  placeholder = "Selecciona…",
  vacioTexto = "No hay opciones",
  buscador,
  className,
  destacado,
  onDestacar,
  etiquetaDestacado = "Principal",
  "aria-label": ariaLabel,
}: SelectorMultipleProps) {
  const [abierto, setAbierto] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");

  const conBuscador = buscador ?? opciones.length > 8;

  // Lo marcado se enseña con el destacado delante: es el que manda y el que
  // el usuario busca con la vista.
  const marcadas = React.useMemo(() => {
    const elegidas = opciones.filter((o) => values.includes(o.value));
    return elegidas.sort((a, b) => {
      if (a.value === destacado) return -1;
      if (b.value === destacado) return 1;
      return a.label.localeCompare(b.label, "es");
    });
  }, [opciones, values, destacado]);

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.nota ?? "").toLowerCase().includes(q),
    );
  }, [opciones, busqueda]);

  return (
    <Popover
      open={abierto}
      onOpenChange={(o) => {
        setAbierto(o);
        if (!o) setBusqueda("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-left text-sm",
            "transition-colors hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1.5">
            {marcadas.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              marcadas.map((o) => {
                const esDestacado = o.value === destacado;
                return (
                  <span
                    key={o.value}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      esDestacado
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {esDestacado && <Star className="h-3 w-3 shrink-0 fill-current" />}
                    {o.label}
                    {!disabled && !o.disabled && (
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={`Quitar ${o.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle(o.value, false);
                        }}
                        className="cursor-pointer opacity-60 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                );
              })
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] rounded-xl p-0 shadow-xl"
      >
        {conBuscador && (
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              // Dentro de un Dialog, el focus-trap se come las teclas del
              // panel (vive en un portal, fuera del diálogo).
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Buscar…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div className="max-h-72 overflow-y-auto py-1">
          {filtradas.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {opciones.length === 0 ? vacioTexto : "Ningún resultado"}
            </p>
          ) : (
            filtradas.map((o) => {
              const marcado = values.includes(o.value);
              const esDestacado = o.value === destacado;
              return (
                <div
                  key={o.value}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-accent/40"
                >
                  <label
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 text-sm",
                      o.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    )}
                  >
                    <Checkbox
                      checked={marcado}
                      disabled={o.disabled}
                      onCheckedChange={(v) => onToggle(o.value, v === true)}
                    />
                    <span className="truncate">{o.label}</span>
                    {o.nota && (
                      <span className="truncate text-[11px] text-muted-foreground">· {o.nota}</span>
                    )}
                  </label>
                  {marcado && onDestacar && (
                    esDestacado ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Star className="h-3 w-3 fill-current" />
                        {etiquetaDestacado}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDestacar(o.value)}
                        className="shrink-0 text-[10px] text-muted-foreground underline hover:text-foreground"
                      >
                        Hacer {etiquetaDestacado.toLowerCase()}
                      </button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
