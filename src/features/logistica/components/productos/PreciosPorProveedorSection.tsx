"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Truck } from "lucide-react";
import {
  listComprasPorProducto,
  type CompraProductoRow,
} from "@/features/logistica/actions/albaranes-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { formatEur as fmtEur, formatNumero } from "@/shared/lib/numero";

interface Props {
  productoId: string;
  refreshKey?: number;
}

function formatEur(n: number): string {
  return fmtEur(n, { max: 4 });
}

function formatCantidad(n: number): string {
  return formatNumero(n, { max: 3 });
}

function formatFecha(iso: string): string {
  if (!iso) return "—";
  const solo = iso.slice(0, 10);
  const [y, m, d] = solo.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function PreciosPorProveedorSection({ productoId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<CompraProductoRow[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);

  useEffect(() => {
    if (!productoId) return;
    setLoading(true);
    listComprasPorProducto(productoId).then((res) => {
      if (res.ok) setItems(res.data);
      setLoading(false);
    });
  }, [productoId, refreshKey]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          Histórico de compras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Cargando…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 py-6 text-center text-sm text-muted-foreground">
            Aún no hay compras confirmadas de este producto.
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Albarán</th>
                  <th className="px-3 py-2 font-medium">Proveedor</th>
                  <th className="px-3 py-2 font-medium">Cantidad</th>
                  <th className="px-3 py-2 font-medium">Formato</th>
                  <th className="px-3 py-2 font-medium">Precio U.</th>
                  <th className="px-3 py-2 font-medium">% IVA</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.lineaId} className="border-b last:border-b-0">
                    <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                      {formatFecha(it.fecha)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="font-medium text-foreground">{it.numero || "—"}</span>
                      {it.numeroProveedor && (
                        <span className="block text-[11px] text-muted-foreground">
                          Nº prov.: {it.numeroProveedor}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-foreground whitespace-nowrap">
                      {it.proveedor || <span className="italic text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                      {formatCantidad(it.cantidad)}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                      {it.unidad || <span className="italic">—</span>}
                    </td>
                    <td className="px-3 py-1.5 font-medium text-foreground tabular-nums whitespace-nowrap">
                      {formatEur(it.precioUC)}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                      {it.impuesto ? `${formatCantidad(it.impuesto)}%` : "—"}
                    </td>
                    <td className="px-3 py-1.5 font-bold text-foreground tabular-nums whitespace-nowrap">
                      {formatEur(it.total)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {it.estado}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/70 px-1">
          Se muestran las líneas de este producto en los albaranes ya confirmados, con el
          proveedor, la cantidad, el formato y el precio de cada compra.
        </p>
      </CardContent>
    </Card>
  );
}
