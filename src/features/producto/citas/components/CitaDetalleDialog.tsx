"use client";

/**
 * Ficha de una cita (PRP-088): quién viene, cuándo, de qué embudo salió y en
 * qué ha quedado. El estado se cambia aquí, sin salir del calendario.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFechaHoraEnZona, formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { cambiarEstadoCita } from "../actions/citas-actions";
import { CITA_ESTADOS, CITA_ESTADO_LABEL, type CitaConDetalle, type CitaEstado } from "../types";

interface Props {
  cita: CitaConDetalle | null;
  zonaHoraria: string;
  onOpenChange: (abierto: boolean) => void;
  onCambiado: () => void;
}

export function CitaDetalleDialog({ cita, zonaHoraria, onOpenChange, onCambiado }: Props) {
  const [guardando, setGuardando] = useState(false);

  const cambiar = async (estado: CitaEstado) => {
    if (!cita) return;
    setGuardando(true);
    const res = await cambiarEstadoCita(cita.id, estado);
    setGuardando(false);
    if (res.ok) {
      toast.success(`Cita marcada como ${CITA_ESTADO_LABEL[estado].toLowerCase()}`);
      onCambiado();
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={Boolean(cita)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {cita && (
          <>
            <DialogHeader>
              <DialogTitle>{cita.cliente_nombre ?? "Sin nombre"}</DialogTitle>
              <DialogDescription>
                {formatFechaHoraEnZona(cita.inicio, zonaHoraria)} —{" "}
                {formatHoraEnZona(cita.fin, zonaHoraria)}
              </DialogDescription>
            </DialogHeader>

            <dl className="space-y-2 text-sm">
              <Fila etiqueta="Calendario" valor={cita.calendario_nombre} />
              <Fila etiqueta="Atiende" valor={cita.empleado_nombre} />
              <Fila etiqueta="Correo" valor={cita.cliente_email} />
              <Fila etiqueta="Teléfono" valor={cita.cliente_telefono} />
              <Fila etiqueta="Viene de" valor={cita.origen} />
              {cita.notas && <Fila etiqueta="Notas" valor={cita.notas} />}
              <div className="flex items-center gap-2 pt-1">
                <dt className="w-24 shrink-0 text-muted-foreground">Estado</dt>
                <dd>
                  <Badge variant={cita.estado === "CANCELADA" ? "outline" : "secondary"}>
                    {CITA_ESTADO_LABEL[cita.estado]}
                  </Badge>
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 pt-2">
              {CITA_ESTADOS.filter((e) => e !== cita.estado).map((e) => (
                <Button
                  key={e}
                  variant="outline"
                  size="sm"
                  disabled={guardando}
                  onClick={() => cambiar(e)}
                >
                  {CITA_ESTADO_LABEL[e]}
                </Button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 break-words">{valor}</dd>
    </div>
  );
}
