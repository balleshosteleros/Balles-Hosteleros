"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Cabecera de una columna de la LISTA DE RESERVAS: filtro + orden, como en el
 * resto de tablas del software.
 *
 * POR QUÉ no se reutiliza `TableColumnHeader`: aquel pinta un `<th>` y vive
 * dentro de una `<table>`. La lista del servicio es un grid de `<div>` —tiene
 * que compartir rejilla con las filas, que llevan dos líneas por celda—, así
 * que un `<th>` aquí rompería la cuadrícula. El comportamiento es el mismo:
 * casillas con los valores REALES de la columna, sin nada marcado = sin
 * filtrar, y las columnas se combinan con Y.
 */

export type OrdenListaDireccion = "asc" | "desc";

export type OrdenLista = {
  campo: string;
  direccion: OrdenListaDireccion;
} | null;

export interface ColumnaListaHeaderProps {
  label: string;
  /** Sin campo, la columna es solo un rótulo (ni filtro ni orden). */
  campo?: string;
  /** Valores reales de la columna, ya escritos como se ven en la celda. */
  opciones?: string[];
  seleccionadas?: string[];
  onSeleccionChange?: (valores: string[]) => void;
  ordenable?: boolean;
  orden?: OrdenLista;
  onOrdenChange?: (orden: OrdenLista) => void;
  ordenLabelAsc?: string;
  ordenLabelDesc?: string;
  align?: "left" | "center";
  className?: string;
}

export function ColumnaListaHeader({
  label,
  campo,
  opciones = [],
  seleccionadas = [],
  onSeleccionChange,
  ordenable = false,
  orden = null,
  onOrdenChange,
  ordenLabelAsc = "A→Z",
  ordenLabelDesc = "Z→A",
  align = "left",
  className,
}: ColumnaListaHeaderProps) {
  const [busqueda, setBusqueda] = useState("");

  const tieneFiltro = !!campo && !!onSeleccionChange;
  const tieneOrden = ordenable && !!campo && !!onOrdenChange;
  const filtroActivo = seleccionadas.length > 0;
  const ordenActivo = !!campo && orden?.campo === campo;

  const opcionesVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => o.toLowerCase().includes(q));
  }, [opciones, busqueda]);

  if (!tieneFiltro && !tieneOrden) {
    return (
      <span className={cn("truncate", align === "center" && "text-center", className)}>
        {label}
      </span>
    );
  }

  function alternar(valor: string, marcado: boolean) {
    onSeleccionChange!(
      marcado
        ? [...seleccionadas, valor]
        : seleccionadas.filter((v) => v !== valor),
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex min-w-0 items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground",
            align === "center" ? "justify-center" : "justify-start",
            (filtroActivo || ordenActivo) && "text-primary",
            className,
          )}
          title={`${label} — filtrar y ordenar`}
        >
          <span className="truncate">{label}</span>
          <span className="inline-flex shrink-0 items-center gap-0.5">
            {ordenActivo &&
              (orden!.direccion === "asc" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              ))}
            {filtroActivo && <ListFilter className="h-3 w-3 fill-current" />}
            {!filtroActivo && !ordenActivo && (
              <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        {tieneOrden && (
          <div className="mb-2 flex items-center gap-1 border-b pb-2">
            <button
              type="button"
              onClick={() =>
                onOrdenChange!(
                  ordenActivo && orden!.direccion === "asc"
                    ? null
                    : { campo: campo!, direccion: "asc" },
                )
              }
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted",
                ordenActivo &&
                  orden!.direccion === "asc" &&
                  "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <ArrowUp className="h-3 w-3" /> {ordenLabelAsc}
            </button>
            <button
              type="button"
              onClick={() =>
                onOrdenChange!(
                  ordenActivo && orden!.direccion === "desc"
                    ? null
                    : { campo: campo!, direccion: "desc" },
                )
              }
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted",
                ordenActivo &&
                  orden!.direccion === "desc" &&
                  "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <ArrowDown className="h-3 w-3" /> {ordenLabelDesc}
            </button>
          </div>
        )}

        {tieneFiltro && (
          <div className="space-y-2">
            {opciones.length > 6 && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-between px-1 text-[11px] normal-case tracking-normal">
              <span className="text-muted-foreground">
                {filtroActivo
                  ? `${seleccionadas.length} seleccionad${seleccionadas.length === 1 ? "a" : "as"}`
                  : "Sin filtrar"}
              </span>
              {filtroActivo && (
                <button
                  type="button"
                  onClick={() => onSeleccionChange!([])}
                  className="text-primary hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="max-h-52 space-y-0.5 overflow-y-auto pr-1">
              {opcionesVisibles.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer select-none items-center gap-2 rounded px-1.5 py-1 text-sm font-normal normal-case tracking-normal hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={seleccionadas.includes(opt)}
                    onChange={(e) => alternar(opt, e.target.checked)}
                    className="rounded accent-primary"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              ))}
              {opcionesVisibles.length === 0 && (
                <p className="py-2 text-center text-xs normal-case tracking-normal text-muted-foreground">
                  Sin opciones
                </p>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
