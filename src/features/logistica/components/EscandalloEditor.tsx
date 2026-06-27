"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Lock } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  listEscandallosConPrecios,
  getCosteEscandallo,
} from "@/features/logistica/actions/escandallos-actions";
import { formatEur, parseDecimal } from "@/shared/lib/numero";

type EscandalloLinea = {
  id: string;
  ingredienteId: string;
  ingredienteNombre: string;
  ingredienteUnidad: string;
  cantidad: number;
  mermaPct: number;
  precioUnitario: number;
  subtotal: number;
};

/**
 * Vista de SOLO LECTURA del escandallo (receta) de un producto venta/elaboración.
 * La receta se crea y edita en Cocina › Escandallos (editor con barras). Aquí
 * solo se muestra: no hay botones para añadir, quitar ni modificar ingredientes.
 */
export function EscandalloEditor({
  productoVentaId,
  precioVenta,
}: {
  productoVentaId: string;
  precioVenta?: string | number;
}) {
  const [lineas, setLineas] = useState<EscandalloLinea[]>([]);
  const [costeTotal, setCosteTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [escandalloRes, costeRes] = await Promise.all([
      listEscandallosConPrecios(productoVentaId),
      getCosteEscandallo(productoVentaId),
    ]);
    if (escandalloRes.ok) setLineas(escandalloRes.data);
    if (costeRes.ok) setCosteTotal(costeRes.coste);
    setLoading(false);
  }, [productoVentaId]);

  useEffect(() => {
    load();
  }, [load]);

  const pvNum =
    typeof precioVenta === "number"
      ? precioVenta
      : parseDecimal(String(precioVenta ?? "")) ?? 0;
  const margen = pvNum > 0 && costeTotal > 0 ? ((pvNum - costeTotal) / pvNum) * 100 : null;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ChefHat className="h-4 w-4" /> ESCANDALLO
          <Badge variant="secondary" className="text-[10px]">
            {lineas.length}
          </Badge>
        </CardTitle>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> Solo lectura · se edita en Cocina
        </span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner className="py-6" />
        ) : lineas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Este plato no tiene escandallo. Créalo en Cocina › Escandallos y asócialo a este producto.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-bold">INGREDIENTE</th>
                    <th className="text-right py-2 font-bold">CANTIDAD</th>
                    <th className="text-right py-2 font-bold">MERMA %</th>
                    <th className="text-right py-2 font-bold">REAL</th>
                    <th className="text-right py-2 font-bold">COSTE MERMA</th>
                    <th className="text-right py-2 font-bold">PRECIO/U</th>
                    <th className="text-right py-2 font-bold">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const real = l.cantidad * (1 + l.mermaPct / 100);
                    const costeMerma =
                      l.mermaPct > 0 && l.subtotal > 0
                        ? l.subtotal * (l.mermaPct / (100 + l.mermaPct))
                        : 0;
                    return (
                      <tr key={l.id} className="border-b">
                        <td className="py-2 font-medium">{l.ingredienteNombre}</td>
                        <td className="py-2 text-right">
                          {l.cantidad} {l.ingredienteUnidad}
                        </td>
                        <td className="py-2 text-right">{l.mermaPct}%</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {real.toFixed(3)} {l.ingredienteUnidad}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {costeMerma > 0 ? formatEur(costeMerma, { min: 3, max: 3 }) : "—"}
                        </td>
                        <td className="py-2 text-right">
                          {l.precioUnitario > 0 ? (
                            <span className="text-muted-foreground">
                              {formatEur(l.precioUnitario)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">sin precio</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {l.subtotal > 0 ? formatEur(l.subtotal, { min: 3, max: 3 }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {costeTotal > 0 && (
              <div className="flex flex-wrap gap-3 pt-1 border-t">
                <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-1.5">
                  <ChefHat className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-muted-foreground">Food cost:</span>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    {formatEur(costeTotal)}
                  </span>
                </div>
                {pvNum > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">P.V.P:</span>
                    <span className="text-sm font-bold">{formatEur(pvNum)}</span>
                  </div>
                )}
                {margen !== null && (
                  <div
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 border ${
                      margen >= 65
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700"
                        : margen >= 50
                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                    }`}
                  >
                    <span className="text-xs text-muted-foreground">Margen:</span>
                    <span
                      className={`text-sm font-bold ${
                        margen >= 65
                          ? "text-emerald-700 dark:text-emerald-300"
                          : margen >= 50
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {margen.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
