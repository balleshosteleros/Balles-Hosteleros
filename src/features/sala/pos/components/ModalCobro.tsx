"use client";

import * as React from "react";
import { toast } from "sonner";
import { Banknote, CreditCard, Smartphone, Ticket, MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PagoMedio } from "../types";
import { formatEur } from "../services/calculo-ticket";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onConfirmar: (pagos: { medio: PagoMedio; importe: number; referencia?: string }[]) => void;
}

const MEDIOS: { medio: PagoMedio; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { medio: "EFECTIVO", label: "Efectivo", icon: Banknote },
  { medio: "TARJETA", label: "Tarjeta", icon: CreditCard },
  { medio: "BIZUM", label: "Bizum", icon: Smartphone },
  { medio: "VALE", label: "Vale", icon: Ticket },
  { medio: "OTROS", label: "Otros", icon: MoreHorizontal },
];

export function ModalCobro({ open, onOpenChange, total, onConfirmar }: Props) {
  const [pagos, setPagos] = React.useState<{ medio: PagoMedio; importe: number }[]>([]);
  const [medioActivo, setMedioActivo] = React.useState<PagoMedio>("EFECTIVO");
  const [buffer, setBuffer] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setPagos([]);
      setBuffer("");
      setMedioActivo("EFECTIVO");
    }
  }, [open]);

  const sumaPagada = pagos.reduce((a, p) => a + p.importe, 0);
  const restante = Math.round((total - sumaPagada) * 100) / 100;

  const append = (c: string) => setBuffer((b) => (b.length >= 8 ? b : b + c));
  const clear = () => setBuffer("");
  const backspace = () => setBuffer((b) => b.slice(0, -1));

  const addPago = (importeForzado?: number) => {
    const n = importeForzado ?? Number(buffer.replace(",", "."));
    if (!n || isNaN(n) || n <= 0) {
      toast.error("Importe inválido.");
      return;
    }
    setPagos((arr) => [...arr, { medio: medioActivo, importe: Math.round(n * 100) / 100 }]);
    setBuffer("");
  };

  const quitarPago = (idx: number) => setPagos((arr) => arr.filter((_, i) => i !== idx));

  const cobrarExacto = () => addPago(restante);

  const confirmar = () => {
    if (Math.abs(sumaPagada - total) > 0.01) {
      toast.error(`Faltan ${formatEur(restante)} por cobrar.`);
      return;
    }
    onConfirmar(pagos);
    onOpenChange(false);
  };

  const numBtn = "flex h-12 items-center justify-center rounded-md border-2 bg-white text-xl font-bold hover:bg-slate-50 active:scale-95";

  const cambio = sumaPagada > total ? Math.round((sumaPagada - total) * 100) / 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cobrar ticket · Total {formatEur(total)}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_280px] gap-4">
          {/* Columna izquierda: medios + pagos registrados */}
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Medio de pago
              </div>
              <div className="grid grid-cols-5 gap-1">
                {MEDIOS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.medio}
                      onClick={() => setMedioActivo(m.medio)}
                      className={`flex flex-col items-center gap-1 rounded-md border-2 p-2 text-xs font-semibold transition-colors ${
                        medioActivo === m.medio
                          ? "border-primary bg-primary/10"
                          : "border-muted hover:bg-muted/40"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista de pagos */}
            <div className="rounded-md border bg-muted/20 p-2">
              <div className="mb-1 text-xs font-semibold uppercase">Pagos registrados</div>
              {pagos.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">Aún no hay pagos.</div>
              ) : (
                <ul className="space-y-1">
                  {pagos.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded bg-white px-2 py-1 text-sm"
                    >
                      <span className="font-semibold">{MEDIOS.find((m) => m.medio === p.medio)?.label}</span>
                      <span className="tabular-nums">{formatEur(p.importe)}</span>
                      <button
                        onClick={() => quitarPago(i)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Resumen */}
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="tabular-nums font-bold">{formatEur(total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pagado</span>
                <span className="tabular-nums">{formatEur(sumaPagada)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>{restante >= 0 ? "Restante" : "Cambio"}</span>
                <span className="tabular-nums">{formatEur(Math.abs(restante))}</span>
              </div>
              {cambio > 0 && (
                <div className="mt-1 rounded bg-emerald-100 px-2 py-1 text-center text-sm font-bold text-emerald-800">
                  Entrega cambio: {formatEur(cambio)}
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha: numpad */}
          <div className="space-y-2">
            <div className="flex h-12 items-center justify-end rounded-md border-2 bg-slate-50 px-3 text-2xl font-bold tabular-nums">
              {buffer || "—"}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((k) => (
                <button key={k} className={numBtn} onClick={() => append(k)}>
                  {k}
                </button>
              ))}
              <button className={numBtn} onClick={() => append("0")}>0</button>
              <button className={numBtn} onClick={() => append(".")}>.</button>
              <button className={`${numBtn} bg-amber-100 hover:bg-amber-200`} onClick={backspace}>
                ←
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Button variant="outline" onClick={clear}>
                CLR
              </Button>
              <Button onClick={() => addPago()} disabled={!buffer}>
                Añadir
              </Button>
            </div>
            <Button variant="secondary" className="w-full" onClick={cobrarExacto} disabled={restante <= 0}>
              Cobrar restante {formatEur(restante)}
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={Math.abs(restante) > 0.01}>
            Confirmar y cerrar ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
