"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Palmtree,
  CalendarOff,
  Users,
  Pencil,
  Trash2,
  Loader2,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listCalendariosVacaciones,
  deleteCalendarioVacaciones,
  asignarCalendarioADesasignados,
} from "@/features/rrhh/actions/calendarios-vacaciones-actions";
import type { CalendarioVacaciones } from "@/features/rrhh/data/calendarios-vacaciones";
import { CalendarioVacacionesDialog } from "@/features/rrhh/components/calendarios/CalendarioVacacionesDialog";

function formatFechaEs(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function CalendariosVacacionesPanel({ empresaId }: { empresaId: string }) {
  const [calendarios, setCalendarios] = useState<CalendarioVacaciones[]>([]);
  const [cargando, setCargando] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<CalendarioVacaciones | null>(null);
  const [aBorrar, setABorrar] = useState<CalendarioVacaciones | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [asignandoId, setAsignandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await listCalendariosVacaciones(empresaId);
    setCalendarios(res.ok ? res.data : []);
    setCargando(false);
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrirNuevo() {
    setEditando(null);
    setDialogOpen(true);
  }
  function abrirEditar(cal: CalendarioVacaciones) {
    setEditando(cal);
    setDialogOpen(true);
  }

  async function confirmarBorrado() {
    if (!aBorrar) return;
    setBorrando(true);
    const res = await deleteCalendarioVacaciones(aBorrar.id);
    setBorrando(false);
    setABorrar(null);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar el calendario");
      return;
    }
    toast.success("Calendario eliminado");
    void cargar();
  }

  async function asignarATodos(cal: CalendarioVacaciones) {
    setAsignandoId(cal.id);
    const res = await asignarCalendarioADesasignados(empresaId, cal.id);
    setAsignandoId(null);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo asignar el calendario");
      return;
    }
    toast.success(
      res.count > 0
        ? `Asignado a ${res.count} empleado${res.count === 1 ? "" : "s"} sin calendario`
        : "Todos los empleados ya tenían un calendario asignado",
    );
    void cargar();
  }

  return (
    <div className="space-y-4">
      {/* BARRA HORIZONTAL 1: + Nuevo a la izquierda. */}
      <div className="flex items-center justify-between gap-2">
        <Button onClick={abrirNuevo} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo calendario
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Crea uno o varios calendarios de vacaciones. Cada calendario fija el total
        de días del año y los periodos en los que no se pueden pedir vacaciones.
        Después asigna a cada empleado su calendario (en la ficha del empleado →
        Solicitudes).
      </p>

      {cargando ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : calendarios.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Palmtree className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Todavía no hay calendarios de vacaciones</p>
          <p className="text-sm text-muted-foreground">
            Crea el primero para empezar a controlar los días de tus empleados.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {calendarios.map((cal) => (
            <div key={cal.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{cal.nombre}</h3>
                    <Badge variant="secondary">
                      {cal.anio ?? "Todos los años"}
                    </Badge>
                  </div>
                  {cal.descripcion && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {cal.descripcion}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => abrirEditar(cal)}
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-rose-600 hover:text-rose-700"
                    onClick={() => setABorrar(cal)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                  <Palmtree className="h-3.5 w-3.5" />
                  {cal.diasTotales} días totales
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {cal.empleadosCount} empleado{cal.empleadosCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-foreground">
                  <CalendarOff className="h-3.5 w-3.5" />
                  {cal.bloqueos.length} bloqueo{cal.bloqueos.length === 1 ? "" : "s"}
                </span>
              </div>

              {cal.bloqueos.length > 0 && (
                <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
                  {cal.bloqueos.slice(0, 4).map((b) => (
                    <li key={b.id} className="flex items-center gap-1.5">
                      <CalendarOff className="h-3 w-3 shrink-0 text-rose-400" />
                      <span>
                        {formatFechaEs(b.fechaInicio)}
                        {b.fechaFin !== b.fechaInicio && ` – ${formatFechaEs(b.fechaFin)}`}
                        {b.motivo && <span className="text-foreground"> · {b.motivo}</span>}
                      </span>
                    </li>
                  ))}
                  {cal.bloqueos.length > 4 && (
                    <li className="pl-4.5">y {cal.bloqueos.length - 4} más…</li>
                  )}
                </ul>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => asignarATodos(cal)}
                disabled={asignandoId === cal.id}
              >
                {asignandoId === cal.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UsersRound className="h-4 w-4" />
                )}
                Asignar a empleados sin calendario
              </Button>
            </div>
          ))}
        </div>
      )}

      <CalendarioVacacionesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        empresaId={empresaId}
        calendario={editando}
        onSaved={() => {
          setDialogOpen(false);
          void cargar();
        }}
      />

      <AlertDialog open={!!aBorrar} onOpenChange={(v) => !v && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar calendario</AlertDialogTitle>
            <AlertDialogDescription>
              {aBorrar && aBorrar.empleadosCount > 0 ? (
                <>
                  «{aBorrar?.nombre}» está asignado a {aBorrar.empleadosCount} empleado
                  {aBorrar.empleadosCount === 1 ? "" : "s"}. Si lo eliminas, esos
                  empleados se quedarán sin calendario y no podrán solicitar vacaciones
                  hasta que les asignes otro. ¿Seguro que quieres continuar?
                </>
              ) : (
                <>¿Seguro que quieres eliminar «{aBorrar?.nombre}»? Esta acción no se puede deshacer.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarBorrado();
              }}
              disabled={borrando}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {borrando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
