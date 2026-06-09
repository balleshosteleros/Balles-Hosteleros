"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserRoundX, ShieldAlert, Briefcase, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listDepartamentos,
  updateEmpleadoEmpresasAcceso,
  setEmpleadoEstado,
  type EstadoEmpleado,
} from "@/features/rrhh/actions/empleados-actions";
import { listPuestosCatalogo } from "@/features/rrhh/actions/vacantes-actions";
import { getPuestosDeEmpleado, setPuestosDeEmpleado } from "@/features/rrhh/actions/empleado-puestos-actions";
import {
  getDependientesValidador,
  reasignarValidadorYDesactivar,
  type DependienteValidador,
  type ValidadorElegible,
} from "@/features/rrhh/actions/validadores-actions";
import {
  getLocalesEmpleado,
  setLocalesEmpleado,
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
  };
  onUpdated: () => Promise<void> | void;
  onDeleted?: () => void;
};

/** Handle imperativo: guarda la parte general (laboral + accesos) sin tocar el estado. */
export type GestionEmpleadoCardHandle = {
  saveGeneral: () => Promise<{ ok: boolean; error?: string }>;
};

export const GestionEmpleadoCard = forwardRef<GestionEmpleadoCardHandle, Props>(
  function GestionEmpleadoCard({ empleadoId, initial, onUpdated }, ref) {
  const [departamentos, setDepartamentos] = useState<DepartamentoOpt[]>([]);
  // Locales por empresa (solo de las empresas a las que el empleado pertenece).
  const [localesPorEmpresa, setLocalesPorEmpresa] = useState<Record<string, LocalOpt[]>>({});
  const [localesSeleccionados, setLocalesSeleccionados] = useState<string[]>([]);
  const [empresasDisponibles, setEmpresasDisponibles] = useState<EmpresaAccesible[]>([]);
  const [empresasMarcadas, setEmpresasMarcadas] = useState<string[]>(initial.empresasAcceso);
  // Un empleado puede ocupar VARIOS puestos del catálogo; uno es el principal
  // (de él cuelga el departamento + puesto-texto legacy). El departamento ya no
  // se edita a mano: se hereda de los puestos.
  const [puestosCatalogo, setPuestosCatalogo] = useState<Array<{ id: string; nombre: string; departamento_id: string | null }>>([]);
  const [puestosSel, setPuestosSel] = useState<string[]>([]);
  const [principalPuestoId, setPrincipalPuestoId] = useState<string>("");
  const [fechaInicioHorario, setFechaInicioHorario] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [permiteTeletrabajo, setPermiteTeletrabajo] = useState(Boolean(initial.permiteTeletrabajo));
  const [estado, setEstado] = useState<EstadoEmpleado>(initial.estado);
  const [fechaBaja, setFechaBaja] = useState(initial.fechaBaja ?? "");
  const [savingEstado, setSavingEstado] = useState(false);
  // Confirmación estándar (activar / desactivar sin dependientes).
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  // Sustitución obligatoria: al desactivar a alguien que valida a otros, hay que
  // reasignar a esos empleados a un sustituto para que ningún puesto quede huérfano.
  const [sustOpen, setSustOpen] = useState(false);
  const [dependientes, setDependientes] = useState<DependienteValidador[]>([]);
  const [reemplazos, setReemplazos] = useState<ValidadorElegible[]>([]);
  const [sustitutoId, setSustitutoId] = useState<string>("");

  useEffect(() => {
    listDepartamentos().then((res) => {
      setDepartamentos((res.data ?? []) as DepartamentoOpt[]);
    });
    listPuestosCatalogo().then((res) => {
      setPuestosCatalogo((res.data ?? []) as Array<{ id: string; nombre: string; departamento_id: string | null }>);
    });
    getPuestosDeEmpleado(empleadoId).then((rows) => {
      setPuestosSel(rows.map((r) => r.puestoId));
      const pr = rows.find((r) => r.esPrincipal);
      setPrincipalPuestoId(pr?.puestoId ?? rows[0]?.puestoId ?? "");
    });
    getEmpresasAccesibles().then((res) => {
      setEmpresasDisponibles(res.ok ? res.data : []);
    });
    getLocalesEmpleado(empleadoId).then((res) => {
      setLocalesSeleccionados(res.ok ? res.data : []);
    });
  }, [empleadoId]);

  useEffect(() => {
    setEmpresasMarcadas(initial.empresasAcceso);
    setPermiteTeletrabajo(Boolean(initial.permiteTeletrabajo));
    setEstado(initial.estado);
    setFechaBaja(initial.fechaBaja ?? "");
  }, [initial]);

  function togglePuesto(id: string, checked: boolean) {
    setPuestosSel((prev) => {
      const next = checked
        ? (prev.includes(id) ? prev : [...prev, id])
        : prev.filter((x) => x !== id);
      setPrincipalPuestoId((cur) => {
        if (checked) return cur || id;
        if (cur === id) return next[0] ?? "";
        return cur;
      });
      return next;
    });
  }

  // Carga (perezosa) de los locales de cada empresa marcada.
  useEffect(() => {
    for (const empId of empresasMarcadas) {
      if (localesPorEmpresa[empId]) continue;
      listLocales(empId).then((res) => {
        setLocalesPorEmpresa((prev) =>
          prev[empId] ? prev : { ...prev, [empId]: (res.ok ? res.data : []) as LocalOpt[] },
        );
      });
    }
  }, [empresasMarcadas, localesPorEmpresa]);

  function toggleEmpresa(empresaId: string, checked: boolean) {
    if (empresaId === initial.empresaId && !checked) return;
    setEmpresasMarcadas((prev) => {
      if (checked) return prev.includes(empresaId) ? prev : [...prev, empresaId];
      return prev.filter((id) => id !== empresaId);
    });
    // Al desmarcar una empresa, sus locales salen del conjunto seleccionado.
    if (!checked) {
      const idsEmpresa = new Set((localesPorEmpresa[empresaId] ?? []).map((l) => l.id));
      setLocalesSeleccionados((prev) => prev.filter((id) => !idsEmpresa.has(id)));
    }
  }

  function toggleLocal(localId: string, checked: boolean) {
    setLocalesSeleccionados((prev) => {
      if (checked) return prev.includes(localId) ? prev : [...prev, localId];
      return prev.filter((id) => id !== localId);
    });
  }

  // Guarda TODO lo general del perfil (datos laborales, locales, teletrabajo y
  // accesos multiempresa) en una sola operación, devolviendo el resultado sin
  // toast. El botón "Guardar" superior de la ficha orquesta esto + los datos
  // personales con un único aviso. El recuadro rojo (estado) va aparte.
  async function saveGeneral(): Promise<{ ok: boolean; error?: string }> {
    if (!empresasMarcadas.includes(initial.empresaId)) {
      return { ok: false, error: "No se puede quitar la empresa donde el empleado está dado de alta." };
    }
    // Cada empresa marcada necesita ≥1 local: sin local no puede fichar ahí.
    const sel = new Set(localesSeleccionados);
    const sinLocal = empresasMarcadas.filter((empId) => {
      const locales = localesPorEmpresa[empId] ?? [];
      return !locales.some((l) => sel.has(l.id));
    });
    if (sinLocal.length > 0) {
      const nombres = sinLocal.map(
        (id) => empresasDisponibles.find((e) => e.id === id)?.nombre ?? id,
      );
      return {
        ok: false,
        error: `Marca al menos un local de fichaje en cada empresa (falta en: ${nombres.join(", ")})`,
      };
    }

    const [resEmpleado, resLocal, resTeletrabajo, resEmpresas] = await Promise.all([
      // Reconcilia los puestos (M:N): asigna la plantilla de horario de cada uno,
      // marca el principal y propaga su departamento + puesto-texto a `empleados`.
      setPuestosDeEmpleado(
        empleadoId, puestosSel, principalPuestoId || puestosSel[0] || null, fechaInicioHorario,
      ),
      setLocalesEmpleado(empleadoId, localesSeleccionados),
      setEmpleadoTeletrabajo(empleadoId, permiteTeletrabajo),
      updateEmpleadoEmpresasAcceso({ empleadoId, empresaIds: empresasMarcadas }),
    ]);

    const error = !resEmpleado.ok
      ? resEmpleado.error
      : !resLocal.ok
        ? resLocal.error
        : !resTeletrabajo.ok
          ? resTeletrabajo.error
          : !resEmpresas.ok
            ? resEmpresas.error
            : null;

    if (error) return { ok: false, error: error ?? "No se pudieron guardar los cambios" };
    return { ok: true };
  }

  useImperativeHandle(ref, () => ({ saveGeneral }));

  // Clic en "Guardar" del recuadro de estado. Para desactivar, primero
  // comprobamos si este empleado es validador de otros: si lo es, exigimos
  // sustituto antes de continuar; si no, confirmación estándar.
  async function onGuardarClick() {
    if (estado !== "Activo" && !fechaBaja) {
      toast.error("La fecha de baja es obligatoria al desactivar a un empleado");
      return;
    }
    if (estado === "Activo") {
      setConfirmOpen(true);
      return;
    }
    setComprobando(true);
    const res = await getDependientesValidador(empleadoId);
    setComprobando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo comprobar si es validador de otros empleados");
      return;
    }
    if (res.dependientes.length === 0) {
      setConfirmOpen(true);
      return;
    }
    if (res.reemplazos.length === 0) {
      toast.error(
        "Este empleado valida a otros y no hay nadie más con acceso a RRHH para sustituirle. Da acceso a RRHH a otra persona antes de desactivarlo.",
      );
      return;
    }
    setDependientes(res.dependientes);
    setReemplazos(res.reemplazos);
    setSustitutoId("");
    setSustOpen(true);
  }

  async function guardarEstado() {
    setSavingEstado(true);
    const res = await setEmpleadoEstado({
      id: empleadoId,
      estado,
      fechaBaja: fechaBaja || null,
    });
    setSavingEstado(false);
    setConfirmOpen(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo actualizar el estado");
      return;
    }

    toast.success(
      estado === "Activo"
        ? "Empleado activado: acceso al sistema restablecido"
        : "Empleado desactivado: acceso al sistema bloqueado",
    );
    await onUpdated();
  }

  async function confirmarSustitucion() {
    if (!sustitutoId) {
      toast.error("Elige quién sustituye a este empleado como validador");
      return;
    }
    setSavingEstado(true);
    const res = await reasignarValidadorYDesactivar({
      empleadoId,
      sustitutoId,
      fechaBaja: fechaBaja || "",
    });
    setSavingEstado(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo desactivar al empleado");
      return;
    }
    setSustOpen(false);
    toast.success("Empleado desactivado: validaciones reasignadas al sustituto");
    await onUpdated();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 md:p-5 space-y-6">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Briefcase className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Gestión laboral</h3>
            <p className="text-sm text-muted-foreground">
              Cambios administrativos del empleado en esta empresa.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Puestos
            <span className="text-muted-foreground/70 font-normal"> (uno o varios; marca el principal)</span>
          </Label>
          {puestosCatalogo.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay puestos — créalos en RRHH → Salarios.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {puestosCatalogo.map((p) => {
                const marcado = puestosSel.includes(p.id);
                const esPrincipal = principalPuestoId === p.id;
                const dep = departamentos.find((d) => d.id === p.departamento_id)?.nombre;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer min-w-0">
                      <Checkbox checked={marcado} onCheckedChange={(v) => togglePuesto(p.id, v === true)} />
                      <span className="truncate">{p.nombre}</span>
                      {dep && <span className="text-[11px] text-muted-foreground truncate">· {dep}</span>}
                    </label>
                    {marcado && (
                      esPrincipal ? (
                        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                          Principal
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrincipalPuestoId(p.id)}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline shrink-0"
                        >
                          Principal
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            El departamento se hereda de cada puesto. Cada puesto aporta su propio horario y condiciones.
          </p>
          {puestosSel.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Label className="text-xs text-muted-foreground">Inicio del horario</Label>
              <Input
                type="date"
                value={fechaInicioHorario}
                onChange={(e) => setFechaInicioHorario(e.target.value)}
                className="w-44 h-9"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Locales donde puede fichar</Label>
          <p className="text-xs text-muted-foreground">
            Marca uno o varios locales. Solo aparecen los de las empresas a las que pertenece el empleado.
          </p>
          <div className="space-y-3">
            {empresasMarcadas.map((empId) => {
              const empresa = empresasDisponibles.find((e) => e.id === empId);
              const locales = localesPorEmpresa[empId];
              return (
                <div key={empId} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{empresa?.nombre ?? "Empresa"}</span>
                  </div>
                  {locales === undefined ? (
                    <p className="text-xs text-muted-foreground pl-6">Cargando locales…</p>
                  ) : locales.length === 0 ? (
                    <p className="text-xs text-rose-600 pl-6">
                      Esta empresa aún no tiene locales: el empleado no podría fichar
                      aquí. Crea un local o desmarca la empresa.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-1.5 sm:grid-cols-2 pl-1">
                        {locales.map((local) => (
                          <label
                            key={local.id}
                            className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={localesSeleccionados.includes(local.id)}
                              onCheckedChange={(c) => toggleLocal(local.id, c === true)}
                            />
                            <span>{local.nombre}</span>
                          </label>
                        ))}
                      </div>
                      {!locales.some((l) => localesSeleccionados.includes(l.id)) && (
                        <p className="text-xs text-rose-600 pl-1">
                          Marca al menos un local de fichaje en esta empresa.
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Teletrabajo</Label>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm w-fit">
            <Checkbox
              checked={permiteTeletrabajo}
              onCheckedChange={(checked) => setPermiteTeletrabajo(checked === true)}
            />
            <span>Permitir fichaje fuera de los locales asignados</span>
          </label>
        </div>

        <div className="border-t pt-6 space-y-4">
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Acceso multiempresa</h4>
              <p className="text-sm text-muted-foreground">
                Marca las empresas en las que trabaja este empleado. Tendrá el mismo acceso en todas según su departamento. La empresa donde está dado de alta queda siempre activa.
              </p>
            </div>
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
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4 md:p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-md bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Estado y acceso al sistema</h4>
            <p className="text-sm text-muted-foreground">
              Al marcar <strong className="text-foreground">Inactivo</strong> el empleado deja de poder
              entrar al sistema con sus credenciales: pierde el acceso a <strong className="text-foreground">Mi Panel</strong>{" "}
              y a <strong className="text-foreground">Mis Departamentos</strong>. La fecha de baja queda siempre
              reflejada. Para darle de alta de nuevo basta con cambiar el estado a{" "}
              <strong className="text-foreground">Activo</strong>: recupera el acceso al instante.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              value={estado}
              onValueChange={(value) => setEstado(value as EstadoEmpleado)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Activo">Activo</SelectItem>
                <SelectItem value="Inactivo">Inactivo</SelectItem>
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

        <div className="flex justify-end">
          <Button
            variant="destructive"
            disabled={savingEstado || comprobando}
            className="gap-2"
            onClick={onGuardarClick}
          >
            {savingEstado || comprobando
              ? <><Loader2 className="h-4 w-4 animate-spin" />{comprobando ? "Comprobando…" : "Actualizando…"}</>
              : <><UserRoundX className="h-4 w-4" />Guardar</>}
          </Button>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {estado === "Activo"
                    ? "¿Reactivar el acceso de este empleado?"
                    : "¿Desactivar el acceso de este empleado?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción es importante y afecta de inmediato al empleado.{" "}
                  {estado === "Activo" ? (
                    <>
                      Al guardar, <strong className="text-foreground">recuperará el acceso</strong> al
                      sistema (Mi Panel y Mis Departamentos) con sus credenciales actuales.
                    </>
                  ) : (
                    <>
                      Al guardar, <strong className="text-foreground">perderá el acceso</strong> al
                      sistema (Mi Panel y Mis Departamentos) y se registrará su fecha de baja. No podrá
                      iniciar sesión hasta que se le reactive.
                    </>
                  )}{" "}
                  ¿Seguro que quieres continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
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

      {/* Sustitución obligatoria al desactivar a un validador en activo. */}
      <Dialog open={sustOpen} onOpenChange={(o) => { if (!savingEstado) setSustOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reasignar validaciones antes de desactivar</DialogTitle>
            <DialogDescription>
              Este empleado es el validador de{" "}
              <strong className="text-foreground">{dependientes.length}</strong>{" "}
              {dependientes.length === 1 ? "empleado" : "empleados"}. Todo empleado debe
              tener siempre un validador al cargo, así que elige quién le sustituye. El
              sustituto asumirá las validaciones (de trabajo y de ausencias) que tuviera
              asignadas este empleado.
            </DialogDescription>
          </DialogHeader>

          {dependientes.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 max-h-40 overflow-auto space-y-1">
              {dependientes.map((d) => (
                <div key={d.empleadoId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{d.nombreCompleto}</span>
                  <span className="text-xs text-muted-foreground">
                    {[d.comoTrabajo ? "trabajo" : null, d.comoAusencias ? "ausencias" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Sustituto</Label>
            <Select value={sustitutoId} onValueChange={setSustitutoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un sustituto" />
              </SelectTrigger>
              <SelectContent>
                {reemplazos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nombreCompleto}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSustOpen(false)} disabled={savingEstado}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarSustitucion}
              disabled={savingEstado || !sustitutoId}
              className="gap-2"
            >
              {savingEstado
                ? <><Loader2 className="h-4 w-4 animate-spin" />Desactivando…</>
                : <>Reasignar y desactivar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
