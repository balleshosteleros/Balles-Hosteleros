"use client";

import * as React from "react";
import { Percent, Euro } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listDescuentos } from "@/features/sala/actions/descuentos-actions";
import { usePOSTicket } from "../hooks/usePOSTicket";
import type { DescuentoCabecera } from "../services/calculo-ticket";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

interface DescuentoRow {
  id: string;
  nombre: string;
  tipo: string | null;
  porcentaje: number | string | null;
  importe_fijo: number | string | null;
  activo: boolean | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalDescuento({ open, onOpenChange }: Props) {
  const { state, dispatch, totales } = usePOSTicket();
  const [descuentos, setDescuentos] = React.useState<DescuentoRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    listDescuentos()
      .then((r) => {
        if (r.ok) setDescuentos(filtrarVigentes(r.data as DescuentoRow[]));
      })
      .finally(() => setLoading(false));
  }, [open]);

  const aplicar = (d: DescuentoRow) => {
    const pct = Number(d.porcentaje ?? 0);
    const fijo = Number(d.importe_fijo ?? 0);
    let desc: DescuentoCabecera;
    if (pct > 0) {
      desc = { tipo: "PCT", valor: pct };
    } else if (fijo > 0) {
      desc = { tipo: "FIJO", valor: fijo };
    } else {
      // Descuento sin valor numérico → intentar extraer del nombre ("10%", "CALIDAD 25%")
      const m = d.nombre.match(/(\d{1,3})\s*%/);
      if (m) {
        desc = { tipo: "PCT", valor: Math.min(100, Number(m[1])) };
      } else {
        desc = { tipo: "PCT", valor: 0 };
      }
    }
    dispatch({ type: "setDescuento", descuento: desc });
    onOpenChange(false);
  };

  const quitar = () => {
    dispatch({ type: "setDescuento", descuento: null });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar descuento</DialogTitle>
        </DialogHeader>

        {state.descuento && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div>
              <div className="text-xs text-muted-foreground">Aplicado</div>
              <div className="font-semibold">
                {state.descuento.tipo === "PCT"
                  ? `${state.descuento.valor}%`
                  : `${state.descuento.valor.toFixed(2)}€`}
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={quitar}>
              Quitar
            </Button>
          </div>
        )}

        {loading ? (
          <LoadingSpinner className="p-8" />
        ) : descuentos.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay descuentos activos. Créalos en Gerencia → Descuentos.
          </div>
        ) : (
          <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {descuentos.map((d) => {
              const valor = etiquetaDescuento(d);
              return (
                <button
                  key={d.id}
                  onClick={() => aplicar(d)}
                  className="flex min-h-[80px] flex-col items-center justify-center rounded-md border-2 bg-white p-3 text-center shadow-sm transition-transform hover:bg-amber-50 active:scale-95"
                >
                  {valor.tipo === "pct" ? (
                    <Percent className="mb-1 h-5 w-5 text-amber-600" />
                  ) : (
                    <Euro className="mb-1 h-5 w-5 text-amber-600" />
                  )}
                  <div className="text-xs font-bold uppercase leading-tight">{d.nombre}</div>
                  {valor.label && (
                    <div className="mt-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {valor.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="border-t pt-2 text-xs text-muted-foreground">
          Total sin descuento: {(totales.total + totales.descuento).toFixed(2)}€ ·{" "}
          Total con descuento actual: {totales.total.toFixed(2)}€
        </div>
      </DialogContent>
    </Dialog>
  );
}

function filtrarVigentes(rows: DescuentoRow[]): DescuentoRow[] {
  const hoy = new Date().toISOString().slice(0, 10);
  return rows.filter((d) => {
    if (d.activo === false) return false;
    if (d.fecha_inicio && d.fecha_inicio > hoy) return false;
    if (d.fecha_fin && d.fecha_fin < hoy) return false;
    return true;
  });
}

function etiquetaDescuento(d: DescuentoRow): { tipo: "pct" | "fijo" | "otro"; label: string } {
  const pct = Number(d.porcentaje ?? 0);
  const fijo = Number(d.importe_fijo ?? 0);
  if (pct > 0) return { tipo: "pct", label: `${pct}%` };
  if (fijo > 0) return { tipo: "fijo", label: `${fijo.toFixed(2)}€` };
  const m = d.nombre.match(/(\d{1,3})\s*%/);
  if (m) return { tipo: "pct", label: `${m[1]}%` };
  return { tipo: "otro", label: "" };
}
