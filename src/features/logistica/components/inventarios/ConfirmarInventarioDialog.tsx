"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertTriangle } from "lucide-react";
import { getUltimoDiaCerrable } from "@/features/logistica/actions/cierre-almacen-actions";

/**
 * Lo que va a pasar al confirmar un inventario, dicho antes de hacerlo.
 *
 * Hasta ahora el botón confirmaba en seco. Al confirmar se ajustan las existencias de
 * todo lo contado, y desde aquí se puede además **cerrar el almacén**, que es una
 * decisión bastante más seria: a partir de ese día nadie podrá corregir nada hacia
 * atrás. Merece una pantalla que lo diga con todas las letras.
 */

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: (opciones: { cerrarHasta?: string }) => void;
  /** Cuántos productos se han contado. */
  conteos: number;
  /** Fecha del inventario (YYYY-MM-DD). */
  fechaInventario: string;
  /** Solo quien puede editar Logística ve la opción de cerrar. */
  puedeCerrar: boolean;
  guardando?: boolean;
}

function formatearDia(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

export default function ConfirmarInventarioDialog({
  abierto,
  onCerrar,
  onConfirmar,
  conteos,
  fechaInventario,
  puedeCerrar,
  guardando = false,
}: Props) {
  const [cerrarAlmacen, setCerrarAlmacen] = useState(false);
  const [dia, setDia] = useState("");
  const [maxDia, setMaxDia] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setCerrarAlmacen(false);
    // El tope es ayer, en el día natural de la empresa: solo se cierran días
    // terminados, porque las ventas del TPV llegan a la mañana siguiente.
    getUltimoDiaCerrable().then(({ dia: tope }) => {
      if (!tope) return;
      setMaxDia(tope);
      setDia(fechaInventario < tope ? fechaInventario : tope);
    });
  }, [abierto, fechaInventario]);

  const inventarioEsDeHoy = maxDia !== "" && fechaInventario > maxDia;

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onCerrar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar inventario</DialogTitle>
          <DialogDescription>
            Las existencias de los {conteos} productos contados pasarán a ser las que has
            apuntado. Queda registrado en el historial de almacén, y se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {puedeCerrar && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="cerrar-almacen"
                checked={cerrarAlmacen}
                onCheckedChange={(v) => setCerrarAlmacen(v === true)}
                disabled={!maxDia}
              />
              <div className="space-y-1">
                <Label htmlFor="cerrar-almacen" className="flex items-center gap-1.5 font-medium">
                  <Lock className="h-3.5 w-3.5" /> Cerrar el almacén con este recuento
                </Label>
                <p className="text-xs text-muted-foreground">
                  A partir de entonces <strong>nadie podrá tocar nada anterior a esa fecha</strong>:
                  ni mermas, ni albaranes, ni ventas, ni correcciones. Lo que aparezca después se
                  arregla en el inventario siguiente.
                </p>
              </div>
            </div>

            {cerrarAlmacen && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="dia-cierre" className="text-xs">Cerrar hasta el día (incluido)</Label>
                <Input
                  id="dia-cierre"
                  type="date"
                  value={dia}
                  max={maxDia}
                  onChange={(e) => setDia(e.target.value)}
                  className="w-44"
                />
                {inventarioEsDeHoy && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Este inventario es de hoy y <strong>hoy todavía no se puede cerrar</strong>: las
                    ventas del día no llegan del TPV hasta mañana. Se cerrará hasta el{" "}
                    {maxDia ? formatearDia(maxDia) : "día anterior"}.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirmar({ cerrarHasta: cerrarAlmacen && dia ? dia : undefined })}
            disabled={guardando || (cerrarAlmacen && !dia)}
          >
            {guardando ? "Confirmando…" : cerrarAlmacen ? "Confirmar y cerrar almacén" : "Confirmar inventario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
