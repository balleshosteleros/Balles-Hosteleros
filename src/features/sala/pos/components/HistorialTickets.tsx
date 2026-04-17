"use client";

import * as React from "react";
import { toast } from "sonner";
import { Printer, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listTicketsHoy, getTicket, anularTicket } from "../actions/tickets-actions";
import { formatEur, calcularTotales } from "../services/calculo-ticket";
import { htmlTicketVenta, imprimirHTML } from "../services/impresion";
import type { Ticket } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistorialTickets({ open, onOpenChange }: Props) {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [trabajando, setTrabajando] = React.useState<string | null>(null);
  const [filtro, setFiltro] = React.useState<"TODOS" | Ticket["estado"]>("TODOS");

  const recargar = React.useCallback(async () => {
    setLoading(true);
    const r = await listTicketsHoy();
    if (r.ok) setTickets(r.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (open) recargar();
  }, [open, recargar]);

  const filtrados = filtro === "TODOS" ? tickets : tickets.filter((t) => t.estado === filtro);

  const reimprimir = async (ticketId: string) => {
    setTrabajando(ticketId);
    try {
      const r = await getTicket(ticketId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const totales = calcularTotales(r.data.lineas, null);
      imprimirHTML(
        htmlTicketVenta(r.data.lineas, totales, {
          empresa: "Balles Hosteleros",
          numero: r.data.numero,
          mesa: r.data.mesaId ? "Mesa" : "Barra",
          comensales: r.data.comensales,
        })
      );
    } finally {
      setTrabajando(null);
    }
  };

  const anular = async (ticketId: string) => {
    const motivo = window.prompt("Motivo de anulación:");
    if (!motivo) return;
    setTrabajando(ticketId);
    try {
      const r = await anularTicket({ ticketId, motivo });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Ticket anulado. Stock revertido.");
      await recargar();
    } finally {
      setTrabajando(null);
    }
  };

  const colorEstado = (estado: Ticket["estado"]) => {
    switch (estado) {
      case "ABIERTO":
      case "ENVIADO":
        return "bg-amber-100 text-amber-900";
      case "COBRADO":
        return "bg-emerald-100 text-emerald-900";
      case "ANULADO":
        return "bg-rose-100 text-rose-900";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Tickets de hoy</DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex gap-2">
          {(["TODOS", "ABIERTO", "ENVIADO", "COBRADO", "ANULADO"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filtro === f ? "default" : "outline"}
              onClick={() => setFiltro(f)}
            >
              {f}
            </Button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sin tickets.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Nº</th>
                  <th className="px-3 py-2 text-left">Hora</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2 font-mono font-semibold">{t.numero}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(t.abiertoAt).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${colorEstado(t.estado)}`}>
                        {t.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatEur(t.total)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={trabajando === t.id}
                          onClick={() => reimprimir(t.id)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Imprimir
                        </Button>
                        {t.estado !== "ANULADO" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={trabajando === t.id}
                            onClick={() => anular(t.id)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Anular
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
