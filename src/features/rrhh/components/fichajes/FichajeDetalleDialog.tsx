"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  TIPO_FICHAJE_BADGE,
  TIPO_FICHAJE_LABEL,
  type Fichaje,
  type TipoFichajeCodigo,
} from "@/features/rrhh/data/fichajes";
import {
  ficharSalida,
  updateFichaje,
} from "@/features/rrhh/actions/fichajes-actions";
import { obtenerPosicionActual } from "@/features/rrhh/utils/geo";
import { formatHorasDecimal } from "@/shared/lib/timeUtils";
import { FichajeUbicacionMiniMap } from "@/features/rrhh/components/fichajes/FichajeUbicacionMiniMap";

async function intentarGeo() {
  try {
    return await obtenerPosicionActual();
  } catch {
    return null;
  }
}

function formatHora(s: string | null): string {
  if (!s) return "—";
  if (s.includes("T")) {
    return new Date(s).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return s.slice(0, 5);
}

interface Props {
  fichaje: Fichaje | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback tras guardar observaciones, resolver incidencia o fichar salida. */
  onUpdated: () => void;
  /**
   * Resuelve el aspecto del badge del tipo a partir de su código, usando el
   * color configurado en `tipos_fichaje` de la empresa. Si no se pasa, se usa
   * el fallback legacy por código.
   */
  tipoBadge?: (codigo?: string | null) => { className: string; label: string };
}

function legacyTipoBadge(codigo?: string | null): { className: string; label: string } {
  const c = (codigo ?? "ENT") as TipoFichajeCodigo;
  return {
    className: TIPO_FICHAJE_BADGE[c] ?? TIPO_FICHAJE_BADGE.NOR,
    label: TIPO_FICHAJE_LABEL[c] ?? String(codigo ?? ""),
  };
}

/**
 * Modal de detalle de un fichaje extraído de `FichajesView` (TASK-002.04).
 * Comportamiento idéntico al inline anterior, pero ahora reutilizable desde
 * la tab Mapa que también necesita abrir este detalle al hacer click en un
 * pin. Maneja su propio estado interno de observaciones y loading.
 */
export function FichajeDetalleDialog({ fichaje, open, onOpenChange, onUpdated, tipoBadge }: Props) {
  const resolveTipo = tipoBadge ?? legacyTipoBadge;
  const [detalleNotas, setDetalleNotas] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDetalleNotas(fichaje?.observaciones ?? "");
  }, [fichaje]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle de fichaje</DialogTitle>
        </DialogHeader>
        {fichaje && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Empleado:</span>
                <p className="font-medium">{fichaje.empleadoNombre}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Departamento:</span>
                <p className="font-medium">{fichaje.departamento}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fecha:</span>
                <p className="font-medium">{fichaje.fecha}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                {(() => {
                  const tb = resolveTipo(fichaje.tipo);
                  return (
                    <Badge
                      variant="outline"
                      className={`mt-1 text-xs ${tb.className}`}
                    >
                      {tb.label}
                    </Badge>
                  );
                })()}
              </div>
              <div>
                <span className="text-muted-foreground">Entrada:</span>
                <p className="font-medium">{formatHora(fichaje.horaEntrada)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Salida:</span>
                <p className="font-medium">{formatHora(fichaje.horaSalida)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Descanso:</span>
                <p className="font-medium">
                  {fichaje.pausaInicio && fichaje.pausaFin
                    ? `${fichaje.pausaInicio.slice(0, 5)} – ${fichaje.pausaFin.slice(0, 5)}`
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Horas totales:</span>
                <p className="font-semibold">
                  {fichaje.horaSalida ? formatHorasDecimal(fichaje.horasTotales) : "—"}
                </p>
              </div>
            </div>
            {fichaje.incidencia && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm font-medium text-destructive">{fichaje.incidencia}</p>
              </div>
            )}
            {fichaje.cierreAnticipado && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Paralizado antes de horario · a revisar
                </p>
                {fichaje.cierreAnticipadoMotivo && (
                  <p className="mt-1 text-sm text-amber-900">
                    {fichaje.cierreAnticipadoMotivo}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Ubicación</Label>
              <FichajeUbicacionMiniMap fichaje={fichaje} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones RRHH</Label>
              <Textarea
                value={detalleNotas}
                onChange={(e) => setDetalleNotas(e.target.value)}
                placeholder="Añade contexto o corrección manual"
                rows={4}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {fichaje && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const res = await updateFichaje(fichaje.id, { notas: detalleNotas });
                setSaving(false);
                if (res.ok) {
                  toast.success("Observaciones guardadas");
                  onUpdated();
                } else {
                  toast.error(res.error ?? "No se pudieron guardar las observaciones");
                }
              }}
            >
              {saving ? "Guardando…" : "Guardar observaciones"}
            </Button>
          )}
          {fichaje && fichaje.incidencia && fichaje.horaSalida && (
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const res = await updateFichaje(fichaje.id, {
                  notas: detalleNotas,
                  incidencia: null,
                  estado: "completado",
                });
                setSaving(false);
                if (res.ok) {
                  toast.success("Incidencia resuelta");
                  onUpdated();
                } else {
                  toast.error(res.error ?? "No se pudo resolver la incidencia");
                }
              }}
            >
              Resolver incidencia
            </Button>
          )}
          {fichaje && !fichaje.horaSalida && fichaje.horaEntrada && (
            <Button
              onClick={async () => {
                const geo = await intentarGeo();
                const res = await ficharSalida(fichaje.id, geo);
                if (res.ok) {
                  toast.success("Salida registrada");
                  onOpenChange(false);
                  onUpdated();
                } else {
                  toast.error(res.error ?? "Error al fichar salida");
                }
              }}
            >
              Fichar salida
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
