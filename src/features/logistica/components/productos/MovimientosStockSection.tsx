"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { listMovimientosProducto } from "@/features/logistica/actions/kardex-actions";
import {
  getControlaStock,
  setControlaStock,
} from "@/features/logistica/actions/kardex-actions";
import {
  DOCUMENTO_TIPO_LABEL,
  type StockMovimiento,
} from "@/features/logistica/data/kardex";
import { FacturaAgoraInline } from "./FacturaAgoraInline";
import { formatNumero } from "@/shared/lib/numero";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";

// `fecha` es TIMESTAMPTZ (instante): se muestra en la zona de la empresa (PRP-069).
function fmtFecha(iso: string, tz: string): string {
  return formatFechaEnZona(iso, tz, { day: "2-digit", month: "short", year: "numeric" });
}
function fmtNum(n: number): string {
  return formatNumero(Number(n), { max: 2 });
}

// Icono y color por tipo de movimiento (Compra/Venta/Inventario/Merma/Ajuste).
const ICONO_TIPO: Record<string, { Icon: typeof ArrowDownToLine; color: string }> = {
  albaran: { Icon: ArrowDownToLine, color: "text-emerald-700" },
  pos_ticket: { Icon: ArrowUpFromLine, color: "text-amber-700" },
  inventario: { Icon: ClipboardList, color: "text-sky-700" },
  merma: { Icon: Trash2, color: "text-rose-700" },
  ajuste: { Icon: ArrowDownToLine, color: "text-muted-foreground" },
};

/** Histórico de movimientos (kardex) dentro de la ficha del producto. SIN columna de almacén.
 *  Incluye el interruptor "Controlar stock" (Sí/No) con aviso y conservación del histórico. */
export function MovimientosStockSection({
  productoId,
  unidad,
}: {
  productoId: string;
  unidad?: string;
}) {
  const { empresaActual } = useEmpresa();
  const tz = empresaActual?.zonaHoraria ?? "";
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);

  const [controla, setControla] = useState<boolean | null>(null);
  const [nMovs, setNMovs] = useState(0);
  const [pendiente, setPendiente] = useState<boolean | null>(null); // valor al que se quiere cambiar
  const [guardando, setGuardando] = useState(false);

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

  useEffect(() => {
    getControlaStock(productoId).then((r) => {
      setControla(r.controlaStock);
      setNMovs(r.movimientos);
    });
  }, [productoId]);

  async function confirmarCambio() {
    if (pendiente === null) return;
    setGuardando(true);
    const res = await setControlaStock(productoId, pendiente);
    setGuardando(false);
    if (res.ok) {
      setControla(pendiente);
    } else {
      toast.error((res as { error?: string }).error ?? "No se pudo cambiar el control de stock");
    }
    setPendiente(null);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Movimientos de stock</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Controlar stock
            <select
              value={controla === null ? "" : controla ? "si" : "no"}
              disabled={controla === null}
              onChange={(e) => setPendiente(e.target.value === "si")}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>

        {controla && (
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
        )}
      </CardHeader>
      <CardContent>
        {controla === false ? (
          <div className="rounded-md border border-amber-300 bg-amber-50/60 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="font-medium text-foreground">Control de stock desactivado</p>
            <p className="mt-1 text-muted-foreground">
              Este producto no suma por albaranes ni descuenta por ventas.
              {nMovs > 0
                ? ` Su histórico (${nMovs} ${nMovs === 1 ? "movimiento" : "movimientos"}) se conserva y reaparecerá si vuelves a activarlo.`
                : ""}
            </p>
          </div>
        ) : loading ? (
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
                        <td className="py-2 whitespace-nowrap">{fmtFecha(m.fecha, tz)}</td>
                        <td className="py-2">
                          {(() => {
                            const meta = ICONO_TIPO[m.documento_tipo] ?? ICONO_TIPO.ajuste;
                            const Icon = meta.Icon;
                            return (
                              <span className={cn("inline-flex items-center gap-1", meta.color)}>
                                <Icon className="h-3.5 w-3.5" />
                                {DOCUMENTO_TIPO_LABEL[m.documento_tipo]}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {m.documento_tipo === "inventario" && Number(m.cantidad) === 0 ? (
                            <span className="text-muted-foreground">Sin cambios</span>
                          ) : (
                            <>
                              {m.signo === 1 ? "+" : "−"}
                              {fmtNum(m.cantidad)}
                              {unidad ? ` ${unidad}` : ""}
                            </>
                          )}
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

      <AlertDialog open={pendiente !== null} onOpenChange={(o) => !o && setPendiente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendiente ? "Activar control de stock" : "Desactivar control de stock"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendiente
                ? "Este producto volverá a controlar stock desde ahora: sumará por albaranes y descontará por ventas. Si tenía histórico anterior, reaparece (no se había borrado)."
                : nMovs > 0
                  ? `Este producto dejará de sumar por albaranes y de descontar por ventas. Su histórico (${nMovs} ${nMovs === 1 ? "movimiento" : "movimientos"}) NO se borra: se conserva y se oculta hasta que vuelvas a activarlo.`
                  : "Este producto no sumará por albaranes ni descontará por ventas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCambio} disabled={guardando}>
              {guardando ? "Guardando…" : pendiente ? "Activar" : "Desactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
