"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePOSTicket } from "../hooks/usePOSTicket";
import { formatEur } from "../services/calculo-ticket";

export function TicketEnVivo() {
  const { state, dispatch, totales } = usePOSTicket();

  return (
    <div className="flex h-full flex-col bg-background border rounded-md overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs">
        <div>
          <div className="font-semibold">{new Date().toLocaleDateString("es-ES")}</div>
          <div className="text-muted-foreground">
            {state.mesaId ? "Mesa seleccionada" : "Barra / mostrador"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="text-muted-foreground">{state.comensales} comensal{state.comensales !== 1 ? "es" : ""}</div>
        </div>
      </div>

      {/* Encabezado de tabla */}
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 border-b bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Ud</span>
        <span>Producto</span>
        <span className="text-right">Precio</span>
        <span className="text-right">Total</span>
      </div>

      {/* Líneas */}
      <div className="flex-1 overflow-y-auto">
        {state.lineas.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            Toca un producto para añadirlo al ticket.
          </div>
        ) : (
          state.lineas.map((l) => {
            const selected = state.seleccionLineaId === l.id;
            const total = l.cantidad * l.precioUnitario * (1 - l.descuentoPct / 100);
            return (
              <button
                key={l.id}
                onClick={() => dispatch({ type: "selectLinea", lineaId: l.id })}
                className={`grid w-full grid-cols-[auto_1fr_auto_auto] gap-2 border-b px-3 py-2 text-left text-sm transition-colors ${
                  selected ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/40"
                } ${l.enviadaAt ? "opacity-75" : ""}`}
              >
                <span className="tabular-nums font-medium">{l.cantidad.toFixed(l.cantidad % 1 === 0 ? 0 : 2)}</span>
                <span className="truncate">
                  {l.nombre}
                  {l.notaCocina && <span className="ml-1 text-xs text-muted-foreground">· {l.notaCocina}</span>}
                </span>
                <span className="tabular-nums text-right text-muted-foreground">{formatEur(l.precioUnitario)}</span>
                <span className="tabular-nums text-right font-semibold">{formatEur(total)}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Totales */}
      <div className="border-t bg-muted/30 p-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base</span>
          <span className="tabular-nums">{formatEur(totales.baseImponible)}</span>
        </div>
        {Object.entries(totales.ivaDesglosado).map(([pct, imp]) => (
          <div key={pct} className="flex justify-between text-xs">
            <span className="text-muted-foreground">IVA {pct}%</span>
            <span className="tabular-nums">{formatEur(imp)}</span>
          </div>
        ))}
        {totales.descuento > 0 && (
          <div className="flex justify-between text-xs text-destructive">
            <span>Descuento</span>
            <span className="tabular-nums">−{formatEur(totales.descuento)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-2 text-base font-bold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatEur(totales.total)}</span>
        </div>
      </div>

      {/* Footer acciones mínimas */}
      <div className="grid grid-cols-3 gap-1 border-t p-2">
        <Button variant="outline" size="sm" disabled={!state.seleccionLineaId}
          onClick={() => state.seleccionLineaId && dispatch({ type: "removeLinea", lineaId: state.seleccionLineaId })}>
          <Trash2 className="h-4 w-4" />
          Borrar
        </Button>
        <Button variant="outline" size="sm" disabled={state.lineas.length === 0}
          onClick={() => dispatch({ type: "reset" })}>
          Limpiar
        </Button>
        <Button variant="outline" size="sm" disabled={!state.seleccionLineaId}
          onClick={() => {
            const l = state.lineas.find((x) => x.id === state.seleccionLineaId);
            if (!l) return;
            const nota = window.prompt("Nota para cocina:", l.notaCocina);
            if (nota !== null) dispatch({ type: "setNota", lineaId: l.id, nota });
          }}>
          Nota
        </Button>
      </div>
    </div>
  );
}
