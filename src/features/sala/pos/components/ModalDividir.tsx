"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePOSTicket } from "../hooks/usePOSTicket";
import { formatEur } from "../services/calculo-ticket";
import {
  dividirPorArticulos,
  dividirPartesIguales,
  dividirMitades,
} from "../services/division-cuenta";
import type { SubTicket } from "../types";

type Modo = "articulos" | "partesIguales" | "mitades";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (subs: SubTicket[]) => void;
}

export function ModalDividir({ open, onOpenChange, onConfirmar }: Props) {
  const { state, totales } = usePOSTicket();
  const [modo, setModo] = React.useState<Modo>("partesIguales");
  const [numPartes, setNumPartes] = React.useState(state.comensales || 2);
  const [importe1, setImporte1] = React.useState(Math.round((totales.total / 2) * 100) / 100);
  const [asignacion, setAsignacion] = React.useState<Map<string, number>>(new Map());
  const [comensalActivo, setComensalActivo] = React.useState(1);

  React.useEffect(() => {
    if (!open) return;
    setNumPartes(state.comensales || 2);
    setImporte1(Math.round((totales.total / 2) * 100) / 100);
    setAsignacion(new Map());
    setComensalActivo(1);
  }, [open, state.comensales, totales.total]);

  const subs: SubTicket[] = React.useMemo(() => {
    if (modo === "articulos") return dividirPorArticulos(state.lineas, asignacion, numPartes);
    if (modo === "partesIguales") return dividirPartesIguales(state.lineas, numPartes);
    return dividirMitades(state.lineas, importe1).subs;
  }, [modo, state.lineas, asignacion, numPartes, importe1]);

  const toggleLinea = (lineaId: string) => {
    setAsignacion((m) => {
      const n = new Map(m);
      if (n.get(lineaId) === comensalActivo) n.delete(lineaId);
      else n.set(lineaId, comensalActivo);
      return n;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Dividir cuenta · Total {formatEur(totales.total)}</DialogTitle>
        </DialogHeader>

        {/* Selector de modo */}
        <div className="flex gap-2">
          {(["partesIguales", "articulos", "mitades"] as Modo[]).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={modo === m ? "default" : "outline"}
              onClick={() => setModo(m)}
            >
              {m === "partesIguales" ? "Partes iguales" : m === "articulos" ? "Por artículo" : "Importes libres"}
            </Button>
          ))}
        </div>

        {/* Controles por modo */}
        {modo === "partesIguales" && (
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
            <span>Dividir entre</span>
            <input
              type="number"
              min={1}
              max={20}
              value={numPartes}
              onChange={(e) => setNumPartes(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-md border px-2 py-1 text-center font-bold"
            />
            <span>personas</span>
          </div>
        )}

        {modo === "mitades" && (
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
            <span>Parte A pagará</span>
            <input
              type="number"
              step="0.01"
              min={0}
              max={totales.total}
              value={importe1}
              onChange={(e) => setImporte1(Math.max(0, Number(e.target.value) || 0))}
              className="w-28 rounded-md border px-2 py-1 text-right font-bold"
            />
            <span>€ · Parte B pagará {formatEur(totales.total - importe1)}</span>
          </div>
        )}

        {modo === "articulos" && (
          <>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
              <span>Comensales:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={numPartes}
                onChange={(e) => setNumPartes(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded-md border px-2 py-1 text-center font-bold"
              />
              <div className="ml-2 flex flex-wrap gap-1">
                {Array.from({ length: numPartes }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={comensalActivo === n ? "default" : "outline"}
                    onClick={() => setComensalActivo(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {state.lineas.map((l) => {
                const asignado = asignacion.get(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggleLinea(l.id)}
                    className={`flex items-center justify-between rounded-md border-2 p-2 text-left text-sm transition-all ${
                      asignado ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <div>
                      <div className="font-medium">{l.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.cantidad} × {formatEur(l.precioUnitario)}
                      </div>
                    </div>
                    {asignado && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {asignado}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Preview subtickets */}
        <div className="max-h-[30vh] overflow-y-auto rounded-md border bg-muted/20 p-2">
          <div className="mb-2 text-xs font-semibold uppercase">Subtickets</div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {subs.map((s) => (
              <div key={s.id} className="rounded-md border bg-white p-2 text-sm shadow-sm">
                <div className="font-bold">{s.label}</div>
                {s.lineas.length > 0 && (
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {s.lineas.map((l) => (
                      <li key={l.id}>
                        · {l.cantidad} × {l.nombre}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 text-right text-lg font-bold tabular-nums">
                  {formatEur(s.totales.total)}
                </div>
              </div>
            ))}
            {subs.length === 0 && (
              <div className="col-span-full p-4 text-center text-xs text-muted-foreground">
                Asigna líneas para generar subtickets.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onConfirmar(subs);
              onOpenChange(false);
            }}
            disabled={subs.length === 0}
          >
            Cobrar subtickets
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
