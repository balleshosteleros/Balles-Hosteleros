"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePOSTicket } from "../hooks/usePOSTicket";
import type { ProductoPOS } from "../types";
import { formatEur } from "../services/calculo-ticket";

interface Props {
  productos: ProductoPOS[];
  categoriaActiva: string | null;
}

const POR_PAGINA = 15; // 3 columnas × 5 filas

export function ProductoGrid({ productos, categoriaActiva }: Props) {
  const { dispatch } = usePOSTicket();
  const [pagina, setPagina] = React.useState(0);

  const filtrados = React.useMemo(
    () =>
      categoriaActiva ? productos.filter((p) => p.categoria === categoriaActiva) : productos,
    [productos, categoriaActiva]
  );

  React.useEffect(() => setPagina(0), [categoriaActiva]);

  const totalPag = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pagActual = Math.min(pagina, totalPag - 1);
  const slice = filtrados.slice(pagActual * POR_PAGINA, (pagActual + 1) * POR_PAGINA);

  const coloresFallback = [
    "#fed7aa", // naranja pastel
    "#fde68a", // amarillo pastel
    "#bacde2", // azul pastel
    "#bbf7d0", // verde pastel
    "#ddd6fe", // morado pastel
    "#fbcfe8", // rosa pastel
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid flex-1 grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
        {slice.map((p, idx) => {
          const tieneImagen = !!p.imagenUrl;
          const bg = tieneImagen ? "#ffffff" : p.colorBg ?? coloresFallback[idx % coloresFallback.length];
          return (
            <button
              key={p.id}
              onClick={() => dispatch({ type: "addProducto", producto: p })}
              className="group flex min-h-[80px] flex-col overflow-hidden rounded-lg border-2 border-border/60 text-center text-xs font-medium shadow-sm transition-all hover:brightness-95 active:scale-95"
              style={{ background: bg }}
            >
              {tieneImagen ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imagenUrl!}
                    alt={p.nombre}
                    className="h-12 w-full flex-1 object-contain p-1"
                  />
                  <div className="bg-black/60 px-1 py-0.5 text-[11px] font-semibold text-white line-clamp-2 leading-tight">
                    {p.nombre}
                  </div>
                  <div className="px-1 pb-0.5 text-[10px] text-muted-foreground">
                    {formatEur(p.precioVenta)}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-2 py-2">
                  <div className="text-sm font-bold leading-tight line-clamp-3">{p.nombre}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{formatEur(p.precioVenta)}</div>
                </div>
              )}
            </button>
          );
        })}
        {slice.length === 0 && (
          <div className="col-span-full flex items-center justify-center p-8 text-sm text-muted-foreground">
            No hay productos en esta categoría.
          </div>
        )}
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <Button
          variant="outline"
          size="sm"
          disabled={pagActual === 0}
          onClick={() => setPagina((p) => Math.max(0, p - 1))}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <div className="tabular-nums text-muted-foreground">
          {pagActual + 1} / {totalPag}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pagActual >= totalPag - 1}
          onClick={() => setPagina((p) => Math.min(totalPag - 1, p + 1))}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
