"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listMovimientosProducto } from "@/features/logistica/actions/kardex-actions";
import {
  DOCUMENTO_TIPO_LABEL,
  type StockMovimiento,
} from "@/features/logistica/data/kardex";
import { FacturaAgoraInline } from "./FacturaAgoraInline";

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtNum(n: number): string {
  return Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

/** Histórico de movimientos (kardex) dentro de la ficha del producto. SIN columna de almacén. */
export function MovimientosStockSection({
  productoId,
  unidad,
}: {
  productoId: string;
  unidad?: string;
}) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    listMovimientosProducto(productoId, { desde: desde || null, hasta: hasta || null }).then((res) => {
      setMovimientos(res.data);
      setLoading(false);
    });
  }, [productoId, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Movimientos de stock</CardTitle>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="mt-1 block rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          {(desde || hasta) && (
            <button
              type="button"
              onClick={() => {
                setDesde("");
                setHasta("");
              }}
              className="pb-1 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Limpiar
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando movimientos…
          </div>
        ) : movimientos.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Sin movimientos en este periodo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 text-right font-medium">Cantidad</th>
                  <th className="py-2 text-right font-medium">Saldo</th>
                  <th className="py-2 font-medium">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const esVenta = m.documento_tipo === "pos_ticket";
                  const desplegable = esVenta && m.documento_id;
                  const abiertaEsta = abierta === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr
                        className={cn(
                          "border-b border-border/50",
                          desplegable && "cursor-pointer hover:bg-muted/40",
                        )}
                        onClick={() => desplegable && setAbierta(abiertaEsta ? null : m.id)}
                      >
                        <td className="py-2 whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                        <td className="py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              m.tipo === "entrada" ? "text-emerald-700" : "text-amber-700",
                            )}
                          >
                            {m.tipo === "entrada" ? (
                              <ArrowDownToLine className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpFromLine className="h-3.5 w-3.5" />
                            )}
                            {DOCUMENTO_TIPO_LABEL[m.documento_tipo]}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {m.signo === 1 ? "+" : "−"}
                          {fmtNum(m.cantidad)}
                          {unidad ? ` ${unidad}` : ""}
                        </td>
                        <td className="py-2 text-right tabular-nums">{fmtNum(m.saldo_resultante)}</td>
                        <td className="py-2">
                          <span className="inline-flex items-center gap-1">
                            {desplegable &&
                              (abiertaEsta ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              ))}
                            {m.referencia ?? "—"}
                          </span>
                        </td>
                      </tr>
                      {abiertaEsta && m.documento_id && (
                        <tr>
                          <td colSpan={5} className="pb-3">
                            <FacturaAgoraInline ticketId={m.documento_id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
