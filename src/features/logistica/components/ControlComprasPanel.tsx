"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, PackageX, Link2Off } from "lucide-react";
import {
  getProductosSinCompras,
  type ControlCompras,
  type ProductosSinCompras,
} from "@/features/logistica/actions/control-compras-actions";
import { formatEur } from "@/shared/lib/numero";

const eur = (n: number) => formatEur(n);

const PERIODOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
  { dias: 365, label: "365 días" },
];

export function ControlComprasPanel({
  control,
  sinComprasInit,
}: {
  control: ControlCompras;
  sinComprasInit: ProductosSinCompras;
}) {
  const [sinCompras, setSinCompras] = useState<ProductosSinCompras>(sinComprasInit);
  const [pending, startTransition] = useTransition();

  const cambiarPeriodo = (dias: number) => {
    startTransition(async () => {
      const res = await getProductosSinCompras(dias);
      setSinCompras(res);
    });
  };

  return (
    <div className="space-y-4">
      {/* Recuadros 1 y 2: control de asociación a venta/elaboración */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box 1 — SIN producto de venta/elaboración */}
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2Off className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Compras SIN producto de venta/elaboración
            </span>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-black text-amber-700 dark:text-amber-400">{control.sinAsociar}</div>
            <div className="text-xs text-muted-foreground mb-1.5">
              de {control.total} productos de compra
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Gasto último mes</div>
              <div className="font-bold text-foreground">{control.hayGasto ? eur(control.gastoSin) : "—"}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">% del gasto total</div>
              <div className="font-bold text-amber-700 dark:text-amber-400">
                {control.hayGasto ? `${control.pctSin}%` : "—"}
              </div>
            </div>
          </div>
          {control.hayGasto && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/40">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${control.pctSin}%` }} />
            </div>
          )}
          {!control.hayGasto && (
            <p className="mt-2 text-[11px] text-muted-foreground">Sin datos de compra todavía (no hay pedidos en el último mes).</p>
          )}
        </div>

        {/* Box 2 — CON producto de venta/elaboración */}
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              Compras CON producto de venta/elaboración
            </span>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-black text-emerald-700 dark:text-emerald-400">{control.asociados}</div>
            <div className="text-xs text-muted-foreground mb-1.5">
              de {control.total} productos de compra
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Gasto último mes</div>
              <div className="font-bold text-foreground">{control.hayGasto ? eur(control.gastoAsoc) : "—"}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">% del gasto total</div>
              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                {control.hayGasto ? `${control.pctAsoc}%` : "—"}
              </div>
            </div>
          </div>
          {control.hayGasto && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${control.pctAsoc}%` }} />
            </div>
          )}
          {!control.hayGasto && (
            <p className="mt-2 text-[11px] text-muted-foreground">Sin datos de compra todavía (no hay pedidos en el último mes).</p>
          )}
        </div>
      </div>

      {/* Panel 3 — Productos SIN compras en el periodo */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 border-b">
          <PackageX className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-wide">PRODUCTOS SIN COMPRAS</span>
          <div className="ml-auto flex items-center gap-1">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                onClick={() => cambiarPeriodo(p.dias)}
                disabled={pending}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  sinCompras.dias === p.dias
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background hover:bg-muted/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-3 mb-3">
            <div className={`text-4xl font-black ${pending ? "opacity-50" : ""} text-foreground`}>
              {sinCompras.sinCompras}
            </div>
            <div className="text-xs text-muted-foreground mb-1.5">
              de {sinCompras.total} productos sin comprar en los últimos {sinCompras.dias} días
            </div>
          </div>
          {sinCompras.productos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {sinCompras.productos.map((p) => (
                <span key={p.id} className="rounded-md border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                  {p.nombre}
                </span>
              ))}
              {sinCompras.sinCompras > sinCompras.productos.length && (
                <span className="rounded-md px-2 py-0.5 text-xs font-medium text-primary">
                  +{sinCompras.sinCompras - sinCompras.productos.length} más
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              <CheckCircle2 className="inline h-4 w-4 text-emerald-500 mr-1" />
              Todos los productos de compra tienen alguna compra en este periodo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
