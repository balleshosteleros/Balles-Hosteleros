"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Trash2, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  listDepartamentos,
  updateEmpleado,
  setEmpleadoEstado,
  deleteEmpleado,
  type EstadoEmpleado,
} from "@/features/rrhh/actions/empleados-actions";

type DepartamentoOpt = { id: string; nombre: string };

type Props = {
  empleadoId: string;
  initial: {
    nombre: string;
    apellidos: string | null;
    departamentoId: string | null;
    puesto: string | null;
    estado: EstadoEmpleado;
    fechaBaja: string | null;
    notas: string | null;
  };
  onUpdated: () => Promise<void> | void;
  onDeleted: () => void;
};

export function GestionEmpleadoCard({ empleadoId, initial, onUpdated, onDeleted }: Props) {
  const [departamentos, setDepartamentos] = useState<DepartamentoOpt[]>([]);
  const [departamentoId, setDepartamentoId] = useState(initial.departamentoId ?? "__none__");
  const [puesto, setPuesto] = useState(initial.puesto ?? "");
  const [notas, setNotas] = useState(initial.notas ?? "");
  const [estado, setEstado] = useState<EstadoEmpleado>(initial.estado);
  const [fechaBaja, setFechaBaja] = useState(initial.fechaBaja ?? "");
  const [savingLaboral, setSavingLaboral] = useState(false);
  const [savingEstado, setSavingEstado] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    listDepartamentos().then((res) => {
      setDepartamentos((res.data ?? []) as DepartamentoOpt[]);
    });
  }, []);

  useEffect(() => {
    setDepartamentoId(initial.departamentoId ?? "__none__");
    setPuesto(initial.puesto ?? "");
    setNotas(initial.notas ?? "");
    setEstado(initial.estado);
    setFechaBaja(initial.fechaBaja ?? "");
  }, [initial]);

  async function guardarDatosLaborales() {
    setSavingLaboral(true);
    const res = await updateEmpleado(empleadoId, {
      departamentoId: departamentoId === "__none__" ? null : departamentoId,
      puesto: puesto.trim() || null,
      notas: notas.trim() || null,
    });
    setSavingLaboral(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron guardar los datos laborales");
      return;
    }

    toast.success("Datos laborales guardados");
    await onUpdated();
  }

  async function guardarEstado() {
    if (estado !== "Activo" && !fechaBaja) {
      toast.error("La fecha de baja es obligatoria para una baja temporal o definitiva");
      return;
    }

    setSavingEstado(true);
    const res = await setEmpleadoEstado({
      id: empleadoId,
      estado,
      fechaBaja: estado === "Activo" ? null : fechaBaja,
    });
    setSavingEstado(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo actualizar el estado");
      return;
    }

    toast.success("Estado del empleado actualizado");
    await onUpdated();
  }

  async function confirmarBorrado() {
    setDeleting(true);
    const res = await deleteEmpleado(empleadoId);
    setDeleting(false);
    setConfirmDeleteOpen(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar el registro del empleado");
      return;
    }

    toast.success("Registro de empleado eliminado");
    onDeleted();
  }

  return (
    <>
      <div className="rounded-lg border bg-card p-4 md:p-5 space-y-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Gestión laboral</h3>
          <p className="text-sm text-muted-foreground">
            Cambios administrativos del empleado en esta empresa.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Departamento</Label>
            <Select value={departamentoId} onValueChange={setDepartamentoId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Puesto</Label>
            <Input value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="ej. Camarero/a" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notas internas</Label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones internas de RRHH para este empleado"
            rows={4}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={guardarDatosLaborales} disabled={savingLaboral} className="gap-2">
            {savingLaboral
              ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</>
              : <><Save className="h-4 w-4" />Guardar datos laborales</>}
          </Button>
        </div>

        <div className="border-t pt-6 space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Estado y baja</h4>
            <p className="text-sm text-muted-foreground">
              El estado del empleado controla su acceso operativo y requiere fecha cuando está de baja.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={estado}
                onValueChange={(value) => {
                  const next = value as EstadoEmpleado;
                  setEstado(next);
                  if (next === "Activo") setFechaBaja("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Baja temporal">Baja temporal</SelectItem>
                  <SelectItem value="Baja definitiva">Baja definitiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de baja</Label>
              <Input
                type="date"
                value={fechaBaja}
                onChange={(e) => setFechaBaja(e.target.value)}
                disabled={estado === "Activo"}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar registro
            </Button>
            <Button onClick={guardarEstado} disabled={savingEstado} className="gap-2">
              {savingEstado
                ? <><Loader2 className="h-4 w-4 animate-spin" />Actualizando…</>
                : <><UserRoundX className="h-4 w-4" />Guardar estado</>}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el registro del empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto elimina la fila de <code>empleados</code> en la empresa actual. No borra automáticamente el usuario de acceso ni su perfil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarBorrado();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando…" : "Eliminar registro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
