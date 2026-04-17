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

  const colores = [
    "bg-orange-100 hover:bg-orange-200 border-orange-300",
    "bg-yellow-100 hover:bg-yellow-200 border-yellow-300",
    "bg-blue-100 hover:bg-blue-200 border-blue-300",
    "bg-green-100 hover:bg-green-200 border-green-300",
    "bg-purple-100 hover:bg-purple-200 border-purple-300",
    "bg-pink-100 hover:bg-pink-200 border-pink-300",
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid flex-1 grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
        {slice.map((p, idx) => (
          <button
            key={p.id}
            onClick={() => dispatch({ type: "addProducto", producto: p })}
            className={`flex min-h-[80px] flex-col items-center justify-center rounded-lg border-2 p-2 text-center text-xs font-medium shadow-sm transition-all active:scale-95 ${colores[idx % colores.length]}`}
          >
            {p.imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagenUrl} alt={p.nombre} className="h-10 w-10 object-contain" />
            ) : (
              <div className="text-lg font-bold leading-tight">{p.nombre.slice(0, 2).toUpperCase()}</div>
            )}
            <div className="mt-1 line-clamp-2 leading-tight">{p.nombre}</div>
            <div className="text-[10px] text-muted-foreground">{formatEur(p.precioVenta)}</div>
          </button>
        ))}
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
