"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { listPuntosTimeline } from "@/features/calidad/cuestionarios/actions";
import type {
  PuntoTimeline,
  EstadoPunto,
} from "@/features/calidad/cuestionarios/types";

interface Props {
  campanaId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAbrirEmpleado?: (envioId: string) => void;
}

export function PuntosTimelineDialog({
  campanaId,
  open,
  onOpenChange,
  onAbrirEmpleado,
}: Props) {
  const [puntos, setPuntos] = useState<PuntoTimeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoPunto | "todos">("todos");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listPuntosTimeline(campanaId).then((data) => {
      setPuntos(data);
      setLoading(false);
    });
  }, [open, campanaId]);

  const filtrados = useMemo(() => {
    const q = filtroEmpleado.trim().toLowerCase();
    return puntos.filter((p) => {
      if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
      if (q && !p.empleadoNombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [puntos, filtroEmpleado, filtroEstado]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Puntos de seguimiento</DialogTitle>
          <DialogDescription>
            {campanaId
              ? "Puntos extraídos de las reuniones de esta campaña."
              : "Todos los puntos de la empresa."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Empleado</Label>
            <Input
              value={filtroEmpleado}
              onChange={(e) => setFiltroEmpleado(e.target.value)}
              placeholder="Buscar empleado..."
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoPunto | "todos")}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Sin puntos que mostrar.
              </div>
            )}
            {filtrados.map((p) => (
              <button
                key={p.id}
                onClick={() => onAbrirEmpleado?.(p.envioId)}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{p.texto}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.empleadoNombre} · {labelPeriodoCorto(p.campanaPeriodo)} ·{" "}
                      {new Date(p.createdAt).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <EstadoPuntoBadge estado={p.estado} />
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EstadoPuntoBadge({ estado }: { estado: EstadoPunto }) {
  if (estado === "cerrado")
    return (
      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
        Cerrado
      </Badge>
    );
  if (estado === "en_curso")
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-200">
        En curso
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-200">
      Pendiente
    </Badge>
  );
}

function labelPeriodoCorto(p: string): string {
  if (!p) return "";
  const [year, semestre] = p.split("-");
  return `${year}·${semestre}`;
}
