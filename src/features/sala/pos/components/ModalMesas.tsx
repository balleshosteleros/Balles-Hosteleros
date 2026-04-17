"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listMesasPOS, type MesaPOS } from "../actions/mesas-pos-actions";
import { formatEur } from "../services/calculo-ticket";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mesa: MesaPOS) => void;
  titulo?: string;
  /** Si se indica, solo permite mesas en este estado */
  filtroEstado?: MesaPOS["estado"];
}

export function ModalMesas({ open, onOpenChange, onSelect, titulo = "Seleccionar mesa", filtroEstado }: Props) {
  const [mesas, setMesas] = React.useState<MesaPOS[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [zonaActiva, setZonaActiva] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    listMesasPOS()
      .then((r) => {
        if (r.ok) setMesas(r.data);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const zonas = Array.from(new Set(mesas.map((m) => m.zona))).sort();
  const filtradas = mesas.filter(
    (m) =>
      (zonaActiva === null || m.zona === zonaActiva) &&
      (filtroEstado === undefined || m.estado === filtroEstado)
  );

  const colorEstado = (estado: MesaPOS["estado"]) => {
    switch (estado) {
      case "LIBRE":
        return "bg-emerald-100 border-emerald-400 hover:bg-emerald-200";
      case "OCUPADA":
        return "bg-rose-100 border-rose-400 hover:bg-rose-200";
      case "RESERVADA":
        return "bg-amber-100 border-amber-400 hover:bg-amber-200";
      case "BLOQUEADA":
        return "bg-slate-200 border-slate-400 opacity-60";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        {/* Filtro de zonas */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={zonaActiva === null ? "default" : "outline"}
            onClick={() => setZonaActiva(null)}
          >
            Todas
          </Button>
          {zonas.map((z) => (
            <Button
              key={z}
              size="sm"
              variant={zonaActiva === z ? "default" : "outline"}
              onClick={() => setZonaActiva(z)}
            >
              {z.replace("_", " ")}
            </Button>
          ))}
        </div>

        {/* Grid mesas */}
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay mesas disponibles{filtroEstado ? ` (filtro: ${filtroEstado})` : ""}.
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto md:grid-cols-5 lg:grid-cols-6">
            {filtradas.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onSelect(m);
                  onOpenChange(false);
                }}
                disabled={m.estado === "BLOQUEADA"}
                className={`flex min-h-[90px] flex-col items-center justify-center rounded-md border-2 p-2 text-center shadow-sm transition-transform active:scale-95 ${colorEstado(m.estado)}`}
              >
                <div className="text-lg font-bold">{m.codigo || m.numero}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.estado}</div>
                <div className="text-[10px]">Cap. {m.capacidad}</div>
                {m.ticketAbierto && (
                  <div className="mt-1 rounded bg-white/70 px-1 text-[10px] font-semibold">
                    {formatEur(m.ticketAbierto.total)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
