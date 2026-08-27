"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserRoundX, ShieldAlert, Briefcase, Building2, Star } from "lucide-react";
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
  listDepartamentos,
  updateEmpleadoEmpresasAcceso,
  setEmpleadoEstado,
  quitarEmpleadoDeEmpresa,
  type EstadoEmpleado,
} from "@/features/rrhh/actions/empleados-actions";
import { listPuestosCatalogo } from "@/features/rrhh/actions/vacantes-actions";
import { getPuestosDeEmpleado, setPuestosDeEmpleado } from "@/features/rrhh/actions/empleado-puestos-actions";
import {
  getLocalesEmpleado,
  setLocalesEmpleado,
  listLocales,
  setEmpleadoTeletrabajo,
} from "@/features/ajustes/actions/locales-actions";
import { getEmpresasAccesibles, type EmpresaAccesible } from "@/features/empresa/actions/empresas-accesibles-actions";
import { CopiarEmpleadoDialog } from "@/features/rrhh/components/empleados/CopiarEmpleadoDialog";
import { HistorialEstadoDialog } from "@/features/rrhh/components/empleados/HistorialEstadoDialog";
import { getNombreValidadorEmpleado } from "@/features/rrhh/actions/validadores-actions";
import { PASOS_OMITIDOS_ALTA } from "@/features/rrhh/data/empleado-estado-pasos";

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
  // Referencia de lo que había al cargar. Guardar solo escribe lo que cambió
  // respecto a esto: tocar un email no puede reescribir puestos ni accesos.
  const baseline = useRef({
    empresas: [...initial.empresasAcceso].sort().join(","),
    locales: "",
    puestos: "",
    principal: "",
    teletrabajo: Boolean(initial.permiteTeletrabajo),
  });
  // Los accesos y locales llegan por fetch. Hasta que no están, la tarjeta no
  // puede guardarlos: un array vacío "en tránsito" borraría las empresas.
  const [accesosCargados, setAccesosCargados] = useState(false);
  const [localesCargados, setLocalesCargados] = useState(false);
  const [puestosCargados, setPuestosCargados] = useState(false);
  // Un empleado puede ocupar VARIOS puestos del catálogo; uno es el principal
  // (de él cuelga el departamento + puesto-texto legacy). El departamento ya no
  // se edita a mano: se hereda de los puestos.
  const [puestosCatalogo, setPuestosCatalogo] = useState<Array<{ id: string; nombre: string; departamento_id: string | null }>>([]);
  const [puestosSel, setPuestosSel] = useState<string[]>([]);
  const [principalPuestoId, setPrincipalPuestoId] = useState<string>("");
  const [fechaInicioHorario, setFechaInicioHorario] = useState<string>(() => new Date().toISOString().slice(0, 10));
  // Fin del horario. "" = sin fecha de fin (ilimitado, se repite hasta la baja).
  const [fechaFinHorario, setFechaFinHorario] = useState<string>("");
  const [permiteTeletrabajo, setPermiteTeletrabajo] = useState(Boolean(initial.permiteTeletrabajo));
  const [estado, setEstado] = useState<EstadoEmpleado>(initial.estado);
  const [fechaBaja, setFechaBaja] = useState(initial.fechaBaja ?? "");
  // Fecha efectiva del alta al reactivar. Arranca vacía a propósito (no con la
  // fecha de alta original): es una incorporación nueva y hay que teclearla.
  const [fechaAlta, setFechaAlta] = useState("");
  const [motivoEstado, setMotivoEstado] = useState("");
  const [savingEstado, setSavingEstado] = useState(false);
  // Fuerzan la recarga del historial tras guardar, y alimentan el contador.
  const [historialKey, setHistorialKey] = useState(0);
  const [totalMovimientos, setTotalMovimientos] = useState(0);
  // Confirmación de activar / desactivar. Ya no hay que buscar sustituto: quien
  // valida las solicitudes es un departamento, no esta persona, así que darle de
  // baja no deja ninguna solicitud sin nadie que la resuelva.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Quitar (desvincular) de una empresa: confirma, pasa su ficha a Inactivo y le
  // retira el acceso a esa empresa. Mínimo 1 empresa (el server lo garantiza).
  const router = useRouter();
  const [quitarEmpresa, setQuitarEmpresa] = useState<{ id: string; nombre: string } | null>(null);
  const [quitando, setQuitando] = useState(false);
  // Departamento que valida sus solicitudes. Solo lectura: se hereda del puesto.
  const [validador, setValidador] = useState<string | null>(null);

  useEffect(() => {
    listDepartamentos().then((res) => {
      setDepartamentos((res.data ?? []) as DepartamentoOpt[]);
    });
    listPuestosCatalogo().then((res) => {
      setPuestosCatalogo((res.data ?? []) as Array<{ id: string; nombre: string; departamento_id: string | null }>);
    });
    getPuestosDeEmpleado(empleadoId).then((rows) => {
      const ids = rows.map((r) => r.puestoId);
      const pr = rows.find((r) => r.esPrincipal);
      const principal = pr?.puestoId ?? rows[0]?.puestoId ?? "";
      setPuestosSel(ids);
      setPrincipalPuestoId(principal);
      baseline.current.puestos = [...ids].sort().join(",");
      baseline.current.principal = principal;
      setPuestosCargados(true);
    });
    getEmpresasAccesibles().then((res) => {
      setEmpresasDisponibles(res.ok ? res.data : []);
    });
    getLocalesEmpleado(empleadoId).then((res) => {
      const ids = res.ok ? res.data : [];
      setLocalesSeleccionados(ids);
      baseline.current.locales = [...ids].sort().join(",");
      setLocalesCargados(res.ok);
    });
    getNombreValidadorEmpleado(empleadoId).then((res) => {
      setValidador(res.nombre);
    });
  }, [empleadoId]);

  // `initial` es un objeto literal que la página recrea en CADA render, así que
  // no sirve como dependencia: reescribiría el estado continuamente y podría
  // dejar las empresas vacías mientras la carga aún está en vuelo. Se compara
  // por valor. La empresa de alta se fuerza siempre: por regla de negocio no
  // puede faltar, y sin ella "Guardar" creía que se la estaban quitando.
  const empresasAccesoKey = [...initial.empresasAcceso].sort().join(",");
  useEffect(() => {
    const ids = empresasAccesoKey ? empresasAccesoKey.split(",") : [];
    const conPrincipal = ids.includes(initial.empresaId) ? ids : [...ids, initial.empresaId];
    setEmpresasMarcadas(conPrincipal);
    baseline.current.empresas = [...conPrincipal].sort().join(",");
    setAccesosCargados(ids.length > 0);
  }, [empresasAccesoKey, initial.empresaId]);

  useEffect(() => {
    setPermiteTeletrabajo(Boolean(initial.permiteTeletrabajo));
    baseline.current.teletrabajo = Boolean(initial.permiteTeletrabajo);
    setEstado(initial.estado);
    setFechaBaja(initial.fechaBaja ?? "");
  }, [initial.permiteTeletrabajo, initial.estado, initial.fechaBaja]);

  function togglePuesto(id: string, checked: boolean) {
    setPuestosSel((prev) => {
      // No se puede quedar sin puestos: de ellos cuelgan horario, tareas y departamento.
      if (!checked && prev.length === 1 && prev.includes(id)) {
        toast.error("El empleado debe tener al menos un puesto");
        return prev;
      }
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
    // Añadir una empresa se hace con "Copiar empleado" (crea su ficha allí); el
    // checkbox no añade. Y la empresa principal no se quita desde aquí.
    if (checked || empresaId === initial.empresaId) return;
    // Quitar = desvincular: pasa su ficha a Inactivo y le retira el acceso a esa
    // empresa. Pide confirmación antes de nada.
    const emp = empresasDisponibles.find((e) => e.id === empresaId);
    setQuitarEmpresa({ id: empresaId, nombre: emp?.nombre ?? "esta empresa" });
  }

  async function ejecutarQuitar() {
    if (!quitarEmpresa) return;
    setQuitando(true);
    const res = await quitarEmpleadoDeEmpresa({
      empleadoId,
      empresaId: quitarEmpresa.id,
    });
    setQuitando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo quitar de la empresa");
      return;
    }
    toast.success(
      `Empleado desvinculado de ${quitarEmpresa.nombre}: queda inactivo allí (histórico conservado).`,
    );
    setQuitarEmpresa(null);
    router.push("/rrhh/empleados");
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
    // Solo se escribe lo que el usuario tocó de verdad. Cambiar un email no
    // debe arrastrar puestos, locales ni accesos multiempresa: además de ser
    // innecesario, si un fetch aún no había llegado se guardaría un valor vacío.
    const empresasKey = [...empresasMarcadas].sort().join(",");
    const localesKey = [...localesSeleccionados].sort().join(",");
    const puestosKey = [...puestosSel].sort().join(",");
    const principalActual = principalPuestoId || puestosSel[0] || "";

    const cambioEmpresas = accesosCargados && empresasKey !== baseline.current.empresas;
    const cambioLocales = localesCargados && localesKey !== baseline.current.locales;
    const cambioPuestos =
      puestosCargados &&
      (puestosKey !== baseline.current.puestos || principalActual !== baseline.current.principal);
    const cambioTeletrabajo = permiteTeletrabajo !== baseline.current.teletrabajo;

    if (!cambioEmpresas && !cambioLocales && !cambioPuestos && !cambioTeletrabajo) {
      return { ok: true };
    }

    if (cambioEmpresas && !empresasMarcadas.includes(initial.empresaId)) {
      return { ok: false, error: "No se puede quitar la empresa donde el empleado está dado de alta." };
    }
    // Cada empresa marcada necesita ≥1 local: sin local no puede fichar ahí.
    // Solo se valida si se están tocando empresas o locales.
    if (cambioEmpresas || cambioLocales) {
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
    }

    const [resEmpleado, resLocal, resTeletrabajo, resEmpresas] = await Promise.all([
      // Reconcilia los puestos (M:N): asigna la plantilla de horario de cada uno,
      // marca el principal y propaga su departamento + puesto-texto a `empleados`.
      cambioPuestos
        ? setPuestosDeEmpleado(
            empleadoId, puestosSel, principalActual || null,
            fechaInicioHorario, fechaFinHorario || null,
          )
        : Promise.resolve({ ok: true as const }),
      cambioLocales
        ? setLocalesEmpleado(empleadoId, localesSeleccionados)
        : Promise.resolve({ ok: true as const }),
      cambioTeletrabajo
        ? setEmpleadoTeletrabajo(empleadoId, permiteTeletrabajo)
        : Promise.resolve({ ok: true as const }),
      cambioEmpresas
        ? updateEmpleadoEmpresasAcceso({ empleadoId, empresaIds: empresasMarcadas })
        : Promise.resolve({ ok: true as const }),
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

  // Clic en "Guardar" del recuadro de estado: pide confirmación. Ya no hay que
  // buscar sustituto al desactivar, porque quien valida las solicitudes es un
  // departamento y no esta persona.
  function onGuardarClick() {
    if (estado !== "Activo" && !fechaBaja) {
      toast.error("La fecha de baja es obligatoria al desactivar a un empleado");
      return;
    }
    if (estado === "Activo" && !fechaAlta) {
      toast.error("La fecha de alta es obligatoria al activar a un empleado");
      return;
    }
    setConfirmOpen(true);
  }

  async function guardarEstado() {
    setSavingEstado(true);
    const res = await setEmpleadoEstado({
      id: empleadoId,
      estado,
      fechaBaja: fechaBaja || null,
      fechaAlta: fechaAlta || null,
      motivo: motivoEstado || null,
    });
    setSavingEstado(false);
    setConfirmOpen(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo actualizar el estado");
      return;
    }

    // Al reactivar, la fecha de baja anterior se limpia en servidor: el
    // formulario tiene que reflejarlo para no seguir enseñando una baja vieja.
    if (estado === "Activo") setFechaBaja("");
    setMotivoEstado("");
    setHistorialKey((k) => k + 1);

    toast.success(
      estado === "Activo"
        ? "Empleado activado: acceso al sistema restablecido"
        : "Empleado desactivado: acceso al sistema bloqueado",
    );
    await onUpdated();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Briefcase className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Gestión laboral</h3>
        </div>

        <div className="space-y-1.5">
          <Label>
            Puestos
            <span className="text-muted-foreground/70 font-normal"> (uno o varios; marca el principal)</span>
          </Label>
          {puestosCatalogo.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay puestos — créalos en RRHH → Puestos.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {puestosCatalogo.map((p) => {
                const marcado = puestosSel.includes(p.id);
                const esPrincipal = principalPuestoId === p.id;
                // El último puesto marcado no se puede desmarcar.
                const esUltimo = marcado && puestosSel.length === 1;
                const dep = departamentos.find((d) => d.id === p.departamento_id)?.nombre;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                    <label
                      className="flex items-center gap-2 text-sm cursor-pointer min-w-0"
                      title={esUltimo ? "El empleado debe tener al menos un puesto" : undefined}
                    >
                      <Checkbox
                        checked={marcado}
                        disabled={esUltimo}
                        onCheckedChange={(v) => togglePuesto(p.id, v === true)}
                      />
                      <span className="truncate">{p.nombre}</span>
                      {dep && <span className="text-[11px] text-muted-foreground truncate">· {dep}</span>}
                    </label>
                    {marcado && (
                      esPrincipal ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                          <Star className="h-3 w-3 fill-current" />
                          Principal
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrincipalPuestoId(p.id)}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline shrink-0"
                        >
                          Hacer principal
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Cada puesto aporta su horario y sus tareas. El principal fija el departamento y el
            puesto que aparece en la ficha.
          </p>
          {puestosSel.length > 0 && (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pt-1">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Inicio del horario</Label>
                <Input
                  type="date"
                  value={fechaInicioHorario}
                  onChange={(e) => setFechaInicioHorario(e.target.value)}
                  className="w-44 h-9"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Fin del horario (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={fechaFinHorario}
                    min={fechaInicioHorario || undefined}
                    onChange={(e) => setFechaFinHorario(e.target.value)}
                    className="w-44 h-9"
                  />
                  {fechaFinHorario && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-xs text-muted-foreground"
                      onClick={() => setFechaFinHorario("")}
                    >
                      Sin fecha de fin
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          {puestosSel.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Sin fecha de fin, el horario se repite indefinidamente. Al causar baja el empleado, se recorta automáticamente a su último día.
            </p>
          )}
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

        <div className="space-y-2">
          <Label>Validador de solicitudes</Label>
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {validador ?? <span className="text-muted-foreground">Sin definir</span>}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Departamento que aprueba sus solicitudes. Se define en el puesto y el empleado lo hereda.
          </p>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-foreground">Acceso multiempresa</h4>
              <p className="text-[11px] text-muted-foreground">
                Empresas donde trabaja y, en cada una, sus locales de fichaje.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {empresasDisponibles.map((empresa) => {
              const marcada = empresasMarcadas.includes(empresa.id);
              const esPrincipal = empresa.id === initial.empresaId;
              const locales = localesPorEmpresa[empresa.id];
              return (
                <div
                  key={empresa.id}
                  className={`rounded-lg border p-3 space-y-2 ${marcada ? "bg-muted/20" : ""}`}
                >
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={(checked) => toggleEmpresa(empresa.id, checked === true)}
                      disabled={esPrincipal || !marcada}
                    />
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{empresa.nombre}</span>
                    {esPrincipal && (
                      <span className="text-[11px] font-normal text-muted-foreground">(principal)</span>
                    )}
                    {!marcada && (
                      <span className="text-[11px] font-normal text-muted-foreground">
                        — añádelo con «Copiar empleado»
                      </span>
                    )}
                  </label>

                  {marcada && (
                    <div className="pl-6 space-y-2">
                      {locales === undefined ? (
                        <p className="text-xs text-muted-foreground">Cargando locales…</p>
                      ) : locales.length === 0 ? (
                        <p className="text-xs text-rose-600">
                          Esta empresa aún no tiene locales: el empleado no podría fichar
                          aquí. Crea un local o desmarca la empresa.
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">Locales donde puede fichar:</p>
                          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
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
                            <p className="text-xs text-rose-600">
                              Marca al menos un local de fichaje en esta empresa.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <CopiarEmpleadoDialog
              empleadoId={empleadoId}
              empleadoNombre={initial.nombre}
              empresasDisponibles={empresasDisponibles}
              empresasActuales={empresasMarcadas}
            />
            <p className="text-[11px] text-muted-foreground">
              Crea su ficha en otra empresa reutilizando sus datos personales.
            </p>
          </div>
        </div>
      </div>

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
              lo devuelve al instante. La fecha es obligatoria y cada movimiento queda en el historial
              {totalMovimientos > 0 ? ` (${totalMovimientos})` : ""}.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          {/* La fecha que se pide depende del movimiento: al activar es la de
              incorporación, al desactivar la de baja. Ambas obligatorias. */}
          {estado === "Activo" ? (
            <div className="space-y-1.5">
              <Label>
                Fecha de alta <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={fechaAlta}
                onChange={(e) => setFechaAlta(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>
                Fecha de baja <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={fechaBaja}
                onChange={(e) => setFechaBaja(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Input
              value={motivoEstado}
              onChange={(e) => setMotivoEstado(e.target.value)}
              placeholder={
                estado === "Activo" ? "Reincorporación…" : "Fin de contrato, baja voluntaria…"
              }
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="destructive"
            disabled={savingEstado}
            className="gap-2"
            onClick={onGuardarClick}
          >
            {savingEstado
              ? <><Loader2 className="h-4 w-4 animate-spin" />Actualizando…</>
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
              {estado === "Activo" ? (
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

      {/* Confirmar "Quitar de esta empresa" (desvincular). */}
      <AlertDialog
        open={!!quitarEmpresa}
        onOpenChange={(o) => { if (!o && !quitando) setQuitarEmpresa(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar de {quitarEmpresa?.nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              Se desvinculará a <strong className="text-foreground">{initial.nombre}</strong> de{" "}
              <strong className="text-foreground">{quitarEmpresa?.nombre}</strong>: su ficha allí
              pasa a <strong className="text-foreground">Inactiva</strong> (se conserva todo el
              histórico) y pierde el acceso a esa empresa, así que dejará de verla en su software.
              Seguirá en sus demás empresas. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={quitando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); ejecutarQuitar(); }}
              disabled={quitando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {quitando ? "Quitando…" : "Sí, quitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
});
