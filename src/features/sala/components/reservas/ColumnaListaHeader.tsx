"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ListFilter, Search } from "lucide-react";
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

/**
 * Color del punto de una opción. Se admiten las dos formas que ya existen en
 * Reservas sin obligar a convertir ninguna: los estados tienen su clase de
 * Tailwind (`ESTADO_DOT_CLASS`) y las etiquetas un color libre en hexadecimal
 * guardado por el usuario.
 */
export type ColorOpcion = { clase?: string; hex?: string } | null | undefined;

export interface ColumnaListaHeaderProps {
  label: string;
  /** Sin campo, la columna es solo un rótulo (ni filtro ni orden). */
  campo?: string;
  /** Valores reales de la columna, ya escritos como se ven en la celda. */
  opciones?: string[];
  seleccionadas?: string[];
  onSeleccionChange?: (valores: string[]) => void;
  /**
   * Valores que la columna NO enseña mientras nadie toque el filtro.
   *
   * Es el punto de partida de la columna, no un filtro puesto: sus casillas
   * salen desmarcadas pero la cabecera no se enciende ni ofrece "Limpiar",
   * porque el usuario no ha filtrado nada todavía. En cuanto toca una casilla
   * se pasa a una selección normal, y "Limpiar" devuelve aquí.
   */
  ocultasPorDefecto?: string[];
  /**
   * Punto de color de cada opción. Sin esto la columna filtra igual, solo que
   * en blanco y negro: es para las columnas donde el color ES el dato —el
   * estado y las etiquetas se reconocen en sala por su tono antes que por su
   * nombre—, así que la casilla enseña el mismo punto que la fila.
   */
  colorOpcion?: (valor: string) => ColorOpcion;
  ordenable?: boolean;
  orden?: OrdenLista;
  onOrdenChange?: (orden: OrdenLista) => void;
  ordenLabelAsc?: string;
  ordenLabelDesc?: string;
  align?: "left" | "center";
  className?: string;
  /**
   * Clases del panel. La lista vive dentro del ámbito de tema de Reservas
   * (`.sala-tema` / `.sala-oscuro`), pero el panel se pinta en un PORTAL
   * colgado de <body>, fuera de ese contenedor: sin repetirle las clases
   * saldría con el tema CLARO del resto del software aunque la sala esté en
   * oscuro. Es el mismo apaño que ya llevan los diálogos de Reservas.
   */
  panelClassName?: string;
  /**
   * Cabecera sin rótulo: solo el embudo.
   *
   * Para las columnas cuyo nombre ya sobra —la zona se lee debajo de la mesa,
   * las etiquetas junto al nombre—, donde la palabra solo le robaba ancho a las
   * de al lado. El filtro y el orden siguen enteros: el rótulo se va al `title`
   * y el embudo se queda a la vista para que se sepa que ahí se pincha.
   */
  soloIcono?: boolean;
}

export function ColumnaListaHeader({
  label,
  campo,
  opciones = [],
  seleccionadas = [],
  onSeleccionChange,
  ocultasPorDefecto = [],
  colorOpcion,
  ordenable = false,
  orden = null,
  onOrdenChange,
  ordenLabelAsc = "A→Z",
  ordenLabelDesc = "Z→A",
  align = "left",
  className,
  panelClassName,
  soloIcono = false,
}: ColumnaListaHeaderProps) {
  const [busqueda, setBusqueda] = useState("");

  const tieneFiltro = !!campo && !!onSeleccionChange;
  const tieneOrden = ordenable && !!campo && !!onOrdenChange;
  /** Hay una selección puesta por el usuario (vacío = punto de partida). */
  const filtroActivo = seleccionadas.length > 0;
  const ordenActivo = !!campo && orden?.campo === campo;
  /**
   * Lo que de verdad se está viendo en la columna. Sin selección son todas las
   * opciones menos las que la columna esconde de salida.
   */
  const marcadas = useMemo(() => {
    if (filtroActivo) return new Set(seleccionadas);
    const fuera = new Set(ocultasPorDefecto);
    return new Set(opciones.filter((o) => !fuera.has(o)));
  }, [filtroActivo, seleccionadas, opciones, ocultasPorDefecto]);

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

  /**
   * Sin filtro se ven TODAS las casillas marcadas, no vacías.
   *
   * El filtro se usa casi siempre para quitar una o dos cosas ("todo menos las
   * canceladas"), y con las casillas vacías había que marcar las cinco que sí
   * se querían para lograrlo. Enseñándolas marcadas —que es además lo que se
   * está viendo en la lista— basta con desmarcar la que sobra.
   *
   * Por dentro no cambia nada: la lista vacía sigue significando "el punto de
   * partida de la columna" (todas, o todas menos las que esconde de salida).
   * Al tocar la primera casilla se guarda lo que queda visible; y si se acaban
   * desmarcando todas, se vuelve al punto de partida en vez de esconder la
   * lista entera, que no le sirve a nadie.
   */
  function alternar(valor: string, marcado: boolean) {
    const siguienteSet = new Set(marcadas);
    if (marcado) siguienteSet.add(valor);
    else siguienteSet.delete(valor);
    // Se guardan en el orden de la columna para que la lista sea estable.
    const siguiente = opciones.filter((v) => siguienteSet.has(v));
    // Quedarse sin nada marcado es volver al punto de partida. Enseñarlo TODO
    // solo lo es en una columna sin nada escondido de salida: donde sí lo hay
    // (Estado esconde canceladas, no-show y liberadas), "todas" es una elección
    // del usuario y hay que guardarla, o al soltar el popover volverían a
    // esconderse las tres.
    const marcadasTodas = siguiente.length === opciones.length;
    const sinFiltrar =
      siguiente.length === 0 || (marcadasTodas && ocultasPorDefecto.length === 0);
    onSeleccionChange!(sinFiltrar ? [] : siguiente);
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
          {!soloIcono && <span className="truncate">{label}</span>}
          <span className="inline-flex shrink-0 items-center gap-0.5">
            {ordenActivo &&
              (orden!.direccion === "asc" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              ))}
            {filtroActivo && <ListFilter className="h-3 w-3 fill-current" />}
            {!filtroActivo && !ordenActivo && (
              <ArrowUpDown
                className={cn(
                  "h-3 w-3 transition-opacity",
                  // Sin rótulo el embudo es lo ÚNICO que se ve: si se escondiera
                  // hasta pasar el ratón, la columna parecería un hueco vacío.
                  soloIcono
                    ? "opacity-50 group-hover:opacity-100"
                    : "opacity-0 group-hover:opacity-50",
                )}
              />
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        // `text-foreground` explícito: dentro del portal el texto se hereda del
        // <body>, que es del tema claro, y en oscuro salía casi negro.
        className={cn(
          "w-[15rem] overflow-hidden rounded-xl border-border/60 bg-popover/95 p-0 text-foreground shadow-xl backdrop-blur-sm",
          panelClassName,
        )}
        align="start"
        sideOffset={6}
      >
        {tieneOrden && (
          <div className="flex items-center gap-1 border-b border-border/60 p-1.5">
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
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium normal-case tracking-normal transition-colors hover:bg-muted",
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
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium normal-case tracking-normal transition-colors hover:bg-muted",
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
          <div className="p-1.5">
            {opciones.length > 6 && (
              <div className="relative mb-1.5">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar..."
                  className="h-8 rounded-lg pl-8 text-xs normal-case tracking-normal"
                />
              </div>
            )}

            <div className="flex items-center justify-between px-2 pb-1 pt-0.5 text-[10px] font-medium normal-case tracking-normal">
              <span className="text-muted-foreground">
                {filtroActivo || marcadas.size < opciones.length
                  ? `${marcadas.size} de ${opciones.length}`
                  : "Todas"}
              </span>
              {filtroActivo && (
                <button
                  type="button"
                  onClick={() => onSeleccionChange!([])}
                  className="rounded px-1 py-0.5 text-primary transition-colors hover:bg-primary/10"
                >
                  {/* Devuelve la columna a su punto de partida, que en Estado
                      no es "todas" sino "todas menos las que no se enseñan". */}
                  Limpiar
                </button>
              )}
            </div>

            <div className="max-h-56 space-y-px overflow-y-auto pr-0.5">
              {opcionesVisibles.map((opt) => {
                const marcado = marcadas.has(opt);
                const color = colorOpcion?.(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    role="checkbox"
                    aria-checked={marcado}
                    onClick={() => alternar(opt, !marcado)}
                    className={cn(
                      "flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-normal normal-case tracking-normal transition-colors hover:bg-muted",
                      !marcado && "text-muted-foreground",
                    )}
                  >
                    {/* Casilla propia en vez del checkbox del navegador: el
                        nativo no se puede redondear ni ajustar de tamaño y en
                        oscuro se pintaba blanco de sistema. */}
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                        marcado
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-transparent",
                      )}
                    >
                      {marcado && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    {/* Punto del color con el que la fila enseña ese valor. */}
                    {color && (
                      <span
                        className={cn(
                          // Sin borde: el punto se lee por su color y cualquier
                          // anillo fijo falla en uno de los dos temas —en
                          // oscuro un trazo negro hunde los tonos ya apagados
                          // (CANCELADA), y en claro uno blanco no se ve.
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          color.clase,
                        )}
                        style={color.hex ? { backgroundColor: color.hex } : undefined}
                      />
                    )}
                    <span className="truncate">{opt}</span>
                  </button>
                );
              })}
              {opcionesVisibles.length === 0 && (
                <p className="py-3 text-center text-xs normal-case tracking-normal text-muted-foreground">
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
