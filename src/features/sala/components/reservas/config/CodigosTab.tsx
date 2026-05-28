"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type ReservaCodigo,
  RESERVA_CODIGO_TIPO_LABELS,
  RESERVA_CODIGO_TURNOS_LABELS,
} from "@/features/sala/data/reservas";
import {
  listReservaCodigos,
  deleteReservaCodigo,
} from "@/features/sala/actions/reserva-codigos-actions";
import { CodigoForm } from "./CodigoForm";

function fmtFecha(s: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export function CodigosTab() {
  const [codigos, setCodigos] = useState<ReservaCodigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<ReservaCodigo | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await listReservaCodigos();
    if (r.ok) setCodigos(r.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleDelete(c: ReservaCodigo) {
    if (!confirm(`¿Borrar el código "${c.nombre}"?`)) return;
    const r = await deleteReservaCodigo(c.id);
    if (!r.ok) {
      toast.error(r.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Código borrado");
    cargar();
  }

  const dialogOpen = creando || editando !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold mb-1">Códigos promocionales</h4>
          <p className="text-xs text-muted-foreground max-w-xl">
            Códigos únicos (promociones, influencers, grupos…). Si un cliente
            los introduce al reservar, queda registrado como aviso en la
            reserva. Los descuentos y reglas se aplicarán más adelante desde
            el punto de venta.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreando(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : codigos.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
          Aún no hay códigos. Crea el primero con <span className="font-medium">+ Nuevo</span>.
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {codigos.map((c) => {
            const stockLibre = c.stockTotal === 0
              ? "Sin límite"
              : `${Math.max(0, c.stockTotal - c.stockConsumido)} / ${c.stockTotal}`;
            return (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{c.nombre}</span>
                    {c.activo ? (
                      <Badge variant="default" className="h-5 text-[10px]">Activo</Badge>
                    ) : (
                      <Badge variant="secondary" className="h-5 text-[10px]">Inactivo</Badge>
                    )}
                    {c.esDescuento && c.porcentajeDescuento != null && (
                      <Badge variant="outline" className="h-5 text-[10px]">
                        -{c.porcentajeDescuento}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{RESERVA_CODIGO_TIPO_LABELS[c.tipoPromocion]}</span>
                    <span>{RESERVA_CODIGO_TURNOS_LABELS[c.turnos]}</span>
                    <span>{fmtFecha(c.fechaInicio)} → {fmtFecha(c.fechaFin)}</span>
                    <span>Stock: {stockLibre}</span>
                    <span>
                      Personas: {c.minPersonas}–{c.maxPersonas === -1 ? "∞" : c.maxPersonas}
                    </span>
                    {c.diasSemana.length > 0 && (
                      <span>Días: {c.diasSemana.join(", ")}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setEditando(c)}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(c)}
                  title="Borrar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreando(false);
            setEditando(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar código promocional" : "Crear código promocional"}
            </DialogTitle>
          </DialogHeader>
          <CodigoForm
            codigo={editando}
            onSaved={() => {
              setCreando(false);
              setEditando(null);
              cargar();
            }}
            onCancel={() => {
              setCreando(false);
              setEditando(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
