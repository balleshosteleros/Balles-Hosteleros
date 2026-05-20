"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Trash2, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  updateEmpleadoEmpresasAcceso,
  setEmpleadoEstado,
  deleteEmpleado,
  type EstadoEmpleado,
} from "@/features/rrhh/actions/empleados-actions";
import {
  asignarLocalEmpleado,
  listLocales,
  setEmpleadoTeletrabajo,
} from "@/features/ajustes/actions/locales-actions";
import { getEmpresasAccesibles, type EmpresaAccesible } from "@/features/empresa/actions/empresas-accesibles-actions";

type DepartamentoOpt = { id: string; nombre: string };
type LocalOpt = { id: string; nombre: string };

type Props = {
  empleadoId: string;
  initial: {
    empresaId: string;
    empresasAcceso: string[];
    nombre: string;
    apellidos: string | null;
    departamentoId: string | null;
    puesto: string | null;
    localId: string | null;
    permiteTeletrabajo: boolean | null;
    estado: EstadoEmpleado;
    fechaBaja: string | null;
    notas: string | null;
  };
  onUpdated: () => Promise<void> | void;
  onDeleted: () => void;
};

export function GestionEmpleadoCard({ empleadoId, initial, onUpdated, onDeleted }: Props) {
  const [departamentos, setDepartamentos] = useState<DepartamentoOpt[]>([]);
  const [locales, setLocales] = useState<LocalOpt[]>([]);
  const [empresasDisponibles, setEmpresasDisponibles] = useState<EmpresaAccesible[]>([]);
  const [empresasMarcadas, setEmpresasMarcadas] = useState<string[]>(initial.empresasAcceso);
  const [departamentoId, setDepartamentoId] = useState(initial.departamentoId ?? "__none__");
  const [puesto, setPuesto] = useState(initial.puesto ?? "");
  const [localId, setLocalId] = useState(initial.localId ?? "__none__");
  const [permiteTeletrabajo, setPermiteTeletrabajo] = useState(Boolean(initial.permiteTeletrabajo));
  const [notas, setNotas] = useState(initial.notas ?? "");
  const [estado, setEstado] = useState<EstadoEmpleado>(initial.estado);
  const [fechaBaja, setFechaBaja] = useState(initial.fechaBaja ?? "");
  const [savingLaboral, setSavingLaboral] = useState(false);
  const [savingEmpresas, setSavingEmpresas] = useState(false);
  const [savingEstado, setSavingEstado] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    listDepartamentos().then((res) => {
      setDepartamentos((res.data ?? []) as DepartamentoOpt[]);
    });
    listLocales(initial.empresaId).then((res) => {
      setLocales((res.ok ? res.data : []) as LocalOpt[]);
    });
    getEmpresasAccesibles().then((res) => {
      setEmpresasDisponibles(res.ok ? res.data : []);
    });
  }, []);

  useEffect(() => {
    setEmpresasMarcadas(initial.empresasAcceso);
    setDepartamentoId(initial.departamentoId ?? "__none__");
    setPuesto(initial.puesto ?? "");
    setLocalId(initial.localId ?? "__none__");
    setPermiteTeletrabajo(Boolean(initial.permiteTeletrabajo));
    setNotas(initial.notas ?? "");
    setEstado(initial.estado);
    setFechaBaja(initial.fechaBaja ?? "");
  }, [initial]);

  function toggleEmpresa(empresaId: string, checked: boolean) {
    if (empresaId === initial.empresaId && !checked) return;
    setEmpresasMarcadas((prev) => {
      if (checked) return prev.includes(empresaId) ? prev : [...prev, empresaId];
      return prev.filter((id) => id !== empresaId);
    });
  }

  async function guardarDatosLaborales() {
    setSavingLaboral(true);
    const [resEmpleado, resLocal, resTeletrabajo] = await Promise.all([
      updateEmpleado(empleadoId, {
        departamentoId: departamentoId === "__none__" ? null : departamentoId,
        puesto: puesto.trim() || null,
        notas: notas.trim() || null,
      }),
      asignarLocalEmpleado(empleadoId, localId === "__none__" ? null : localId),
      setEmpleadoTeletrabajo(empleadoId, permiteTeletrabajo),
    ]);
    setSavingLaboral(false);

    const error =
      resEmpleado.ok
        ? resLocal.ok
          ? resTeletrabajo.ok
            ? null
            : resTeletrabajo.error
          : resLocal.error
        : resEmpleado.error;

    if (error) {
      toast.error(error ?? "No se pudieron guardar los datos laborales");
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

  async function guardarEmpresasAcceso() {
    if (!empresasMarcadas.includes(initial.empresaId)) {
      toast.error("La empresa principal del empleado no se puede quitar.");
      return;
    }

    setSavingEmpresas(true);
    const res = await updateEmpleadoEmpresasAcceso({
      empleadoId,
      empresaIds: empresasMarcadas,
    });
    setSavingEmpresas(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron actualizar los accesos a empresas");
      return;
    }

    toast.success("Accesos a empresas actualizados");
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Local principal</Label>
            <Select value={localId} onValueChange={setLocalId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {locales.map((local) => (
                  <SelectItem key={local.id} value={local.id}>{local.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Teletrabajo</Label>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={permiteTeletrabajo}
                onCheckedChange={(checked) => setPermiteTeletrabajo(checked === true)}
              />
              <span>Permitir fichaje fuera del local asignado</span>
            </label>
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
            <h4 className="text-sm font-semibold text-foreground">Acceso multiempresa</h4>
            <p className="text-sm text-muted-foreground">
              La empresa principal queda fijada aquí. Puedes ampliar o reducir accesos secundarios.
            </p>
          </div>

          <div className="space-y-2">
            {empresasDisponibles.map((empresa) => {
              const marcada = empresasMarcadas.includes(empresa.id);
              const esPrincipal = empresa.id === initial.empresaId;
              return (
                <label
                  key={empresa.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={(checked) => toggleEmpresa(empresa.id, checked === true)}
                      disabled={esPrincipal}
                    />
                    <span>{empresa.nombre}</span>
                  </div>
                  {esPrincipal && (
                    <span className="text-[10px] uppercase font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Principal
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={guardarEmpresasAcceso} disabled={savingEmpresas} className="gap-2">
              {savingEmpresas
                ? <><Loader2 className="h-4 w-4 animate-spin" />Actualizando…</>
                : <><Save className="h-4 w-4" />Guardar accesos</>}
            </Button>
          </div>
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
