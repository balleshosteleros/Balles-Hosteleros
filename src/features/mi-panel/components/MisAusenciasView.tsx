"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Inbox, Plus, X, CalendarOff, Briefcase, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  anularMiSolicitud,
  listarMisSolicitudes,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import { ESTADO_COLOR, ESTADO_LABEL, SUBTIPO_LABEL } from "@/features/mi-panel/types";
import { SolicitudModal } from "./SolicitudModal";
import { AltaMedicaModal } from "./AltaMedicaModal";
import {
  getMiBajaMedicaAbierta,
  type BajaMedicaAbierta,
} from "@/features/mi-panel/actions/comunicaciones-actions";
import { DenunciaModal } from "./DenunciaModal";
import { MisDenunciasCard } from "./MisDenunciasCard";

function formatFecha(s: string): string {
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}

interface ColumnaProps {
  titulo: string;
  icono: React.ReactNode;
  items: SolicitudPersonal[];
  loading: boolean;
  emptyText: string;
  onAnular: (id: string) => void;
}

function ColumnaSolicitudes({ titulo, icono, items, loading, emptyText, onAnular }: ColumnaProps) {
  return (
    <Card className="p-4 md:p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          {icono}
        </div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "solicitud" : "solicitudes"}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
          <Inbox className="h-6 w-6 mb-1" />
          {emptyText}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
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
                  onClick={() => onAnular(s.id)}
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

export function MisAusenciasView() {
  const [items, setItems] = useState<SolicitudPersonal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [denunciaOpen, setDenunciaOpen] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    listarMisSolicitudes(60).then((res) => {
      if (cancel) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [refreshKey]);

  const ausencias = useMemo(() => items.filter((s) => s.tipo === "ausencia"), [items]);
  const trabajos = useMemo(() => items.filter((s) => s.tipo === "trabajo"), [items]);

  // Mientras tenga una baja médica sin alta, el botón principal deja de ser
  // "Solicitar": lo que le toca es decir que ya está bien.
  const [bajaAbierta, setBajaAbierta] = useState<BajaMedicaAbierta | null>(null);
  const [altaOpen, setAltaOpen] = useState(false);

  useEffect(() => {
    let activo = true;
    getMiBajaMedicaAbierta().then((res) => {
      if (activo) setBajaAbierta(res.data);
    });
    return () => {
      activo = false;
    };
  }, [refreshKey]);

  async function handleAnular(id: string) {
    const res = await anularMiSolicitud(id);
    if (!res.ok) {
      toast.error(res.error || "No se pudo anular");
      return;
    }
    toast.success("Solicitud anulada");
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex justify-end">
        {bajaAbierta ? (
          <Button variant="primary" size="lg" onClick={() => setAltaOpen(true)}>
            <HeartPulse className="mr-2 h-4 w-4" />
            Comunicar mi alta médica
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Solicitar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <ColumnaSolicitudes
          titulo="Ausencias"
          icono={<CalendarOff className="h-4 w-4" />}
          items={ausencias}
          loading={loading}
          emptyText="No tienes ausencias registradas."
          onAnular={handleAnular}
        />
        <ColumnaSolicitudes
          titulo="Trabajos"
          icono={<Briefcase className="h-4 w-4" />}
          items={trabajos}
          loading={loading}
          emptyText="No has registrado horas extras ni días trabajados."
          onAnular={handleAnular}
        />
      </div>

      <MisDenunciasCard refreshKey={refreshKey} />

      <SolicitudModal
        open={open}
        onOpenChange={setOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
        onElegirDenuncia={() => setDenunciaOpen(true)}
      />

      {bajaAbierta && (
        <AltaMedicaModal
          open={altaOpen}
          onOpenChange={setAltaOpen}
          solicitudId={bajaAbierta.solicitudId}
          fechaInicioBaja={bajaAbierta.fechaInicio}
          onComunicada={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <DenunciaModal
        open={denunciaOpen}
        onOpenChange={setDenunciaOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
