"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TURNO_TONOS,
  formatTurnoHorario,
  type Turno,
  type TurnoTramo,
} from "@/features/rrhh/data/horarios";
import {
  crearVersionTurno,
  getVersionesTurno,
} from "@/features/rrhh/actions/turnos-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Clock,
  Plus,
  X,
  Users,
  Check,
  CalendarDays,
  Loader2,
  AlertTriangle,
  History,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type EmpleadoMin = { id: string; nombre: string };

// ─── Asistente: crear nueva versión de turno ─────────────────────────────
export function AsistenteVersionTurno({
  empresaId,
  turno,
  empleados,
  onClose,
  onDone,
}: {
  empresaId: string;
  turno: Turno | null;
  empleados: EmpleadoMin[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [tramos, setTramos] = useState<TurnoTramo[]>([]);
  const [empleadoIds, setEmpleadoIds] = useState<string[]>([]);
  const [vigenteDesde, setVigenteDesde] = useState<string>(hoyISO());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, parte del horario de la versión oficial y selecciona a todos.
  useEffect(() => {
    if (turno) {
      setTramos(turno.tramos.map((tr) => ({ ...tr })));
      setEmpleadoIds(empleados.map((e) => e.id));
      setVigenteDesde(hoyISO());
      setError(null);
    }
  }, [turno, empleados]);

  const todosSeleccionados =
    empleados.length > 0 && empleadoIds.length === empleados.length;

  const toggleTodos = () =>
    setEmpleadoIds(todosSeleccionados ? [] : empleados.map((e) => e.id));

  const confirmar = async () => {
    if (!turno) return;
    const limpios = tramos.filter((t) => t.inicio && t.fin);
    if (limpios.length === 0) {
      setError("Añade al menos un tramo horario.");
      return;
    }
    setGuardando(true);
    setError(null);
    const res = await crearVersionTurno(empresaId, {
      turnoId: turno.id,
      tramos: limpios,
      empleadoIds,
      vigenteDesde,
    });
    setGuardando(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo crear la versión.");
      return;
    }
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!turno} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva versión de horario</DialogTitle>
        </DialogHeader>

        {turno && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vas a crear una versión nueva de{" "}
              <span className="font-medium text-foreground">{turno.nombre}</span>.
              El horario actual se conserva como histórico; el nuevo se aplicará a
              los empleados elegidos desde la fecha que indiques.
            </p>

            {/* Nuevo horario */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Nuevo horario</span>
                <button
                  type="button"
                  onClick={() =>
                    setTramos((t) => [...t, { inicio: "12:00", fin: "16:00" }])
                  }
                  className="ml-auto text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir tramo
                </button>
              </div>
              <div className="space-y-2 pl-6">
                {tramos.map((tramo, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={tramo.inicio}
                      onChange={(e) =>
                        setTramos((t) =>
                          t.map((tr, i) =>
                            i === idx ? { ...tr, inicio: e.target.value } : tr,
                          ),
                        )
                      }
                      className="w-28"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="time"
                      value={tramo.fin}
                      onChange={(e) =>
                        setTramos((t) =>
                          t.map((tr, i) =>
                            i === idx ? { ...tr, fin: e.target.value } : tr,
                          ),
                        )
                      }
                      className="w-28"
                    />
                    {tramos.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTramos((t) => t.filter((_, i) => i !== idx))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Fecha de vigencia */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Desde qué fecha</span>
              </div>
              <div className="pl-6">
                <Input
                  type="date"
                  value={vigenteDesde}
                  onChange={(e) => setVigenteDesde(e.target.value)}
                  className="w-44"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  El nuevo horario se aplicará a los empleados elegidos a partir de
                  esta fecha. Puede ser pasada o futura.
                </p>
              </div>
            </div>

            {/* Empleados */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Aplicar a</span>
                {empleados.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleTodos}
                    className="ml-auto text-sm text-primary hover:underline"
                  >
                    {todosSeleccionados ? "Quitar todos" : "Aplicar a todos"}
                  </button>
                )}
              </div>
              <div className="pl-6">
                {empleados.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Este turno no tiene empleados asignados todavía. La versión se
                    creará igualmente como oficial; podrás asignar empleados luego.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
                    {empleados.map((e) => {
                      const checked = empleadoIds.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() =>
                            setEmpleadoIds((ids) =>
                              checked
                                ? ids.filter((id) => id !== e.id)
                                : [...ids, e.id],
                            )
                          }
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              checked
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-input",
                            )}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate">{e.nombre}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando}>
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Crear versión"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Histórico de versiones de un turno ──────────────────────────────────
export function HistorialVersionesTurno({
  empresaId,
  turno,
  onClose,
}: {
  empresaId: string;
  turno: Turno | null;
  onClose: () => void;
}) {
  const [versiones, setVersiones] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let activo = true;
    if (turno) {
      setCargando(true);
      getVersionesTurno(empresaId, turno.id).then((res) => {
        if (!activo) return;
        if (res.ok) setVersiones(res.data);
        setCargando(false);
      });
    }
    return () => {
      activo = false;
    };
  }, [empresaId, turno]);

  const tono = useMemo(() => (turno ? TURNO_TONOS[turno.color] : null), [turno]);

  return (
    <Dialog open={!!turno} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Histórico de versiones
          </DialogTitle>
        </DialogHeader>

        {turno && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Versiones del horario de{" "}
              <span className="font-medium text-foreground">{turno.nombre}</span>,
              de la más reciente a la más antigua.
            </p>
            {cargando ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
              </div>
            ) : (
              <div className="rounded-md border divide-y">
                {versiones.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[11px] font-semibold",
                        tono?.pill,
                      )}
                    >
                      v{v.version}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="tabular-nums">{formatTurnoHorario(v)}</div>
                      {v.vigenteDesde && (
                        <div className="text-xs text-muted-foreground">
                          Desde {v.vigenteDesde}
                        </div>
                      )}
                    </div>
                    {v.esOficial && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Check className="h-3 w-3" />
                        Vigente
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
