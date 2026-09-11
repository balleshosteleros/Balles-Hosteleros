"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserRoundX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { SelectorFecha } from "@/shared/components/ui/selector-fecha";
import { formatearFechaEs } from "@/shared/lib/fecha";
import { setEmpleadoEstado, type EstadoEmpleado } from "@/features/rrhh/actions/empleados-actions";
import { HistorialEstadoDialog } from "@/features/rrhh/components/empleados/HistorialEstadoDialog";
import { PASOS_OMITIDOS_ALTA } from "@/features/rrhh/data/empleado-estado-pasos";

type Props = {
  empleadoId: string;
  estadoActual: EstadoEmpleado;
  /** Fecha de alta grabada en la ficha, "AAAA-MM-DD". */
  fechaAlta: string | null;
  /** Fecha de baja grabada en la ficha, "AAAA-MM-DD". */
  fechaBaja: string | null;
  onUpdated: () => Promise<void> | void;
};

/**
 * Estado y acceso al sistema — el recuadro rojo de la ficha del empleado.
 *
 * Va APARTE del resto de la ficha (y el último del todo) porque no se guarda
 * con el "Guardar" general: tiene su propio botón y su propia confirmación.
 *
 * La fecha es la del MOVIMIENTO, no un dato suelto de la ficha: solo se pide
 * cuando de verdad se está cambiando el estado (Activo→Inactivo es una baja,
 * Inactivo→Activo un alta). Mientras no se cambia nada, la fecha que hay
 * grabada se enseña en modo lectura. Antes salía siempre un "Fecha de alta"
 * vacío y obligatorio aunque el empleado ya estuviera activo, que es lo que
 * hacía pensar que faltaba un dato o que la fecha estaba equivocada.
 */
export function EstadoAccesoCard({
  empleadoId,
  estadoActual,
  fechaAlta,
  fechaBaja,
  onUpdated,
}: Props) {
  const [estado, setEstado] = useState<EstadoEmpleado>(estadoActual);
  const [fechaMovimiento, setFechaMovimiento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Fuerzan la recarga del historial tras guardar, y alimentan el contador.
  const [historialKey, setHistorialKey] = useState(0);
  const [totalMovimientos, setTotalMovimientos] = useState(0);

  // Al cambiar de empleado, o cuando el movimiento ya está grabado, se parte de
  // cero. No hace falta protegerlo de las recargas de la ficha: mientras el
  // estado guardado no cambie, esta dependencia no cambia y no se pisa nada.
  useEffect(() => {
    setEstado(estadoActual);
    setFechaMovimiento("");
    setMotivo("");
  }, [empleadoId, estadoActual]);

  const darDeAlta = estado === "Activo";
  const hayCambio = estado !== estadoActual;
  const fechaGrabada = estadoActual === "Activo" ? fechaAlta : fechaBaja;

  function onGuardarClick() {
    if (!fechaMovimiento) {
      toast.error(
        darDeAlta
          ? "La fecha de alta es obligatoria al activar a un empleado"
          : "La fecha de baja es obligatoria al desactivar a un empleado",
      );
      return;
    }
    setConfirmOpen(true);
  }

  async function guardarEstado() {
    setSaving(true);
    const res = await setEmpleadoEstado({
      id: empleadoId,
      estado,
      fechaAlta: darDeAlta ? fechaMovimiento : null,
      fechaBaja: darDeAlta ? null : fechaMovimiento,
      motivo: motivo || null,
    });
    setSaving(false);
    setConfirmOpen(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo actualizar el estado");
      return;
    }

    setMotivo("");
    setFechaMovimiento("");
    setHistorialKey((k) => k + 1);

    toast.success(
      darDeAlta
        ? "Empleado activado: acceso al sistema restablecido"
        : "Empleado desactivado: acceso al sistema bloqueado",
    );
    await onUpdated();
  }

  return (
    <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 rounded-md bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">Estado y acceso al sistema</h4>
            <HistorialEstadoDialog
              empleadoId={empleadoId}
              refreshKey={historialKey}
              onCargado={setTotalMovimientos}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Inactivo</strong> le retira el acceso al sistema
            (Mi Panel y Mis Departamentos); <strong className="text-foreground">Activo</strong> se
            lo devuelve al instante. Al cambiarlo se pide la fecha del movimiento, y cada uno queda
            en el historial{totalMovimientos > 0 ? ` (${totalMovimientos})` : ""}.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={estado} onValueChange={(value) => setEstado(value as EstadoEmpleado)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Activo">Activo</SelectItem>
              <SelectItem value="Inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hayCambio ? (
          <>
            {/* La fecha que se pide es la del movimiento: al activar es la de
                incorporación, al desactivar la de baja. */}
            <div className="space-y-1.5">
              <Label>
                {darDeAlta ? "Fecha de alta" : "Fecha de baja"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <SelectorFecha value={fechaMovimiento} onChange={setFechaMovimiento} required />
            </div>

            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={darDeAlta ? "Reincorporación…" : "Fin de contrato, baja voluntaria…"}
              />
            </div>
          </>
        ) : (
          // Sin cambio no hay movimiento que fechar: se enseña la que hay
          // grabada, en lectura, para que se vea de dónde viene el estado.
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">
              {estadoActual === "Activo" ? "Fecha de alta" : "Fecha de baja"}
            </Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-background/60 px-3 text-sm text-muted-foreground">
              {fechaGrabada ? formatearFechaEs(fechaGrabada) : "Sin registrar"}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        {!hayCambio && (
          <p className="text-xs text-muted-foreground">
            Cambia el estado para darle de {estadoActual === "Activo" ? "baja" : "alta"}.
          </p>
        )}
        <Button
          variant="destructive"
          disabled={saving || !hayCambio}
          className="gap-2"
          onClick={onGuardarClick}
        >
          {/* "Guardar estado", no "Guardar" a secas: en esta misma pestaña
              está el Guardar general, y con el mismo texto se confundían. */}
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin" />Actualizando…</>
            : <><UserRoundX className="h-4 w-4" />Guardar estado</>}
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {darDeAlta
                  ? "¿Reactivar el acceso de este empleado?"
                  : "¿Desactivar el acceso de este empleado?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción es importante y afecta de inmediato al empleado.{" "}
                {darDeAlta ? (
                  <>
                    Al guardar, <strong className="text-foreground">se le reactivará el acceso</strong> al
                    sistema con sus credenciales actuales y podrá volver a iniciar sesión y{" "}
                    <strong className="text-foreground">visualizar todo aquello que su rol le permita</strong>{" "}
                    (Mi Panel, Mis Departamentos y los módulos de su rol). Revisa después sus{" "}
                    <strong className="text-foreground">locales de fichaje</strong>: si se le había
                    quitado de esta empresa, hay que volver a marcarlos.
                  </>
                ) : (
                  <>
                    Al guardar, <strong className="text-foreground">se le retirará el acceso</strong> al
                    sistema y se registrará su fecha de baja. Dejará de poder iniciar sesión y de{" "}
                    visualizar cualquier módulo hasta que se le reactive.
                  </>
                )}{" "}
                ¿Seguro que quieres continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Un alta a mano no es una contratación: solo abre el acceso. Todo
                lo que sí hace contratar desde Reclutamiento se queda sin hacer,
                y hay que decirlo aquí, antes de guardar, no después. */}
            {darDeAlta ? (
              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  Esto no sustituye a una contratación
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                  {PASOS_OMITIDOS_ALTA.map((p) => (
                    <li key={p.clave}>{p.texto}</li>
                  ))}
                </ul>
                <p className="mt-1.5">
                  Si es una contratación de verdad, hazla desde Reclutamiento. Si aun así
                  continúas, tendrás que completar estos pasos a mano.
                </p>
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={guardarEstado}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sí, guardar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
