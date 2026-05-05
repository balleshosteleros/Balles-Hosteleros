"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import {
  anularMiSolicitud,
  listarMisSolicitudes,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import { ESTADO_COLOR, ESTADO_LABEL, SUBTIPO_LABEL } from "@/features/mi-panel/types";

interface MisSolicitudesListProps {
  refreshKey?: number;
  onChange?: () => void;
}

function formatFecha(s: string): string {
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}

export function MisSolicitudesList({ refreshKey = 0, onChange }: MisSolicitudesListProps) {
  const [items, setItems] = useState<SolicitudPersonal[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listarMisSolicitudes(10);
    setItems(res.ok ? res.data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function handleAnular(id: string) {
    const res = await anularMiSolicitud(id);
    if (!res.ok) {
      toast.error(res.error || "No se pudo anular");
      return;
    }
    toast.success("Solicitud anulada");
    await load();
    onChange?.();
  }

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Mis solicitudes</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm">
          <Inbox className="h-6 w-6 mb-1" />
          Aún no has enviado ninguna solicitud.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg border"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{SUBTIPO_LABEL[s.subtipo]}</span>
                  <Badge variant="outline" className={ESTADO_COLOR[s.estado]}>
                    {ESTADO_LABEL[s.estado]}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatFecha(s.fechaInicio)}
                  {s.fechaFin && s.fechaFin !== s.fechaInicio && ` – ${formatFecha(s.fechaFin)}`}
                  {s.horas != null && ` · ${s.horas}h`}
                </div>
                {s.motivo && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.motivo}</div>
                )}
              </div>
              {s.estado === "pendiente" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Anular solicitud"
                  onClick={() => handleAnular(s.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
