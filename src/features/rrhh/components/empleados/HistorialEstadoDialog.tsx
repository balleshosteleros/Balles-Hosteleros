"use client";

import { useEffect, useState } from "react";
import { History, Loader2, UserRoundCheck, UserRoundX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getHistorialEstadoEmpleado,
  type MovimientoEstado,
} from "@/features/rrhh/actions/empleado-estado-historial-actions";
import { TEXTO_PASO_OMITIDO } from "@/features/rrhh/data/empleado-estado-pasos";

type Props = {
  empleadoId: string;
  /** Sube al padre cuántos movimientos hay, para el contador del icono. */
  onCargado?: (total: number) => void;
  /** Cambia al guardar un estado, para recargar sin remontar el diálogo. */
  refreshKey?: number;
};

/**
 * Historial de altas y bajas del empleado en el sistema.
 *
 * Vive junto al recuadro de estado porque es justo ahí donde se produce el
 * cambio. Es solo lectura: la tabla no admite update ni delete.
 */
export function HistorialEstadoDialog({ empleadoId, onCargado, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoEstado[]>([]);

  // Se carga siempre (no solo al abrir) para poder pintar el contador del icono.
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    getHistorialEstadoEmpleado(empleadoId)
      .then((res) => {
        if (!vigente) return;
        setMovimientos(res);
        onCargado?.(res.length);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
    // onCargado se omite a propósito: es una función del padre que cambia en
    // cada render y volvería a disparar la carga en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoId, refreshKey]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Ver historial de altas y bajas"
            >
              <History className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Historial de altas y bajas</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial de altas y bajas</DialogTitle>
          <DialogDescription>
            Cada vez que este empleado entra o sale del sistema queda registrado aquí, con
            la fecha efectiva y quién lo hizo. No se puede editar ni borrar.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : movimientos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin cambios registrados todavía.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {movimientos.map((m) => {
              const esAlta = m.accion === "Alta";
              return (
                <div
                  key={m.id}
                  className={`rounded-lg p-3 text-xs ${esAlta ? "bg-emerald-50" : "bg-muted/40"}`}
                >
                  <div className="flex items-start gap-3">
                    {esAlta ? (
                      <UserRoundCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <UserRoundX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">
                        {esAlta ? "Alta en el sistema" : "Baja del sistema"}
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="tabular-nums">{m.fechaEfectivaTexto}</span>
                      </div>
                      {m.motivo ? (
                        <div className="mt-0.5 text-muted-foreground">{m.motivo}</div>
                      ) : null}
                      <div className="mt-0.5 text-muted-foreground">
                        {m.usuarioNombre} · {m.creadoTexto}
                      </div>

                      {m.avisosOmitidos.length > 0 ? (
                        <div className="mt-2 rounded-md bg-amber-100/70 p-2">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Pasos que este alta manual no hizo
                          </div>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-800">
                            {m.avisosOmitidos.map((clave) => (
                              <li key={clave}>{TEXTO_PASO_OMITIDO.get(clave) ?? clave}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
