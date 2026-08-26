"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/shared/components/NumberInput";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPuesto, updatePuesto, deletePuesto, listDepartamentosCatalogo,
  listCronogramasElegibles, getCronogramaDePuesto, vincularCronogramaAPuesto,
  type CronogramaElegible,
} from "@/features/rrhh/actions/vacantes-actions";
import { upsertPuestoSalario, listNivelesDePuesto } from "@/features/rrhh/actions/puestos-actions";
import { setValidadorDepartamentoPuesto } from "@/features/rrhh/actions/validadores-actions";
import {
  getHorarioPuesto, setHorarioPuesto, type PatronElegible,
} from "@/features/rrhh/actions/puesto-horario-actions";
import type { Turno } from "@/features/rrhh/data/horarios";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  validarPuestoCompleto,
  type CampoPuesto,
} from "@/features/rrhh/services/validar-puesto";
import type { PuestoSalarial, NivelSalarial } from "@/features/rrhh/data/puestos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = crear puesto nuevo; si viene, se edita el puesto y sus niveles. */
  editing: PuestoSalarial | null;
  onSaved: () => void;
}

type Depto = { id: string; nombre: string };

/** Jornadas de contrato disponibles. Un puesto es completa o partida. */
const JORNADAS = ["Completa", "Partida"];

/** Vacaciones por defecto de cualquier puesto nuevo (convenio de hostelería). */
const VACACIONES_DEFECTO = "30 días";

/** Cabeceras de la vista previa del horario. */
const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

function nivelVacio(nivel: number): NivelSalarial {
  return {
    nivel,
    vacaciones: VACACIONES_DEFECTO,
    salarioBruto: 0,
    nominaNeta: 0,
    efectivoExtra: 0,
    salarioNeto: 0,
    jornadaContrato: "Completa",
    horasSemanales: 0,
    diasLibres: 0,
    horarioSemanal: [],
    observaciones: "",
    estado: "activo",
  };
}

export function PuestoSalarioDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const esNuevo = editing === null;

  const [departamentos, setDepartamentos] = useState<Depto[]>([]);
  // Datos compartidos del puesto
  const [nombre, setNombre] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  // Datos de gestoría (compartidos por el puesto)
  const [convenio, setConvenio] = useState("");
  // Departamento que valida las solicitudes de quien ocupe este puesto.
  const [validadorDepartamentoId, setValidadorDepartamentoId] = useState<string>("");
  // Niveles (condiciones por nivel)
  const [niveles, setNiveles] = useState<NivelSalarial[]>([nivelVacio(1)]);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Carga de las condiciones al editar. Sin esto el formulario se pintaba con
  // el nivel vacío mientras llegaba la BD: se veía todo a cero/en blanco y
  // parecía que no se había guardado nada.
  const [cargando, setCargando] = useState(false);
  // Cronograma vinculado al puesto (se elige entre los ya creados).
  const [cronogramas, setCronogramas] = useState<CronogramaElegible[]>([]);
  const [cronogramaRol, setCronogramaRol] = useState("");
  const [cronogramaInicial, setCronogramaInicial] = useState("");
  // Horario del puesto: se elige aquí dentro (antes vivía en un diálogo aparte).
  const [patrones, setPatrones] = useState<PatronElegible[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [horarioFamiliaId, setHorarioFamiliaId] = useState("");
  const [horarioInicial, setHorarioInicial] = useState("");
  // Campos vacíos marcados tras intentar guardar. Un puesto no puede quedar
  // incompleto: al contratar, sus datos se copian al empleado.
  const [faltan, setFaltan] = useState<CampoPuesto[]>([]);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const falta = (campo: CampoPuesto) => faltan.includes(campo);
  // Marco rojo en el campo vacío, para que se vea cuál falta sin leer el aviso.
  const claseFalta = (campo: CampoPuesto) =>
    falta(campo) ? "border-destructive focus-visible:ring-destructive" : "";

  const cur = niveles[idx] ?? niveles[0];

  // Vista previa de la semana del horario elegido.
  const turnoById = useMemo(() => {
    const m = new Map<string, Turno>();
    turnos.forEach((t) => m.set(t.id, t));
    return m;
  }, [turnos]);
  const patronElegido = patrones.find((p) => p.familiaId === horarioFamiliaId) ?? null;

  const setCur = (patch: Partial<NivelSalarial>) => {
    setNiveles((prev) => prev.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  };

  useEffect(() => {
    if (!open) return;
    let activo = true;
    void listDepartamentosCatalogo().then((r) => {
      if (activo && r.ok) setDepartamentos(r.data as Depto[]);
    });
    void listCronogramasElegibles().then((r) => {
      if (activo && r.ok) setCronogramas(r.data);
    });
    // Datos compartidos
    setNombre(editing?.puesto ?? "");
    setDepartamentoId(editing?.departamentoId ?? "");
    setDescripcion(editing?.descripcion ?? "");
    setConvenio(editing?.convenioColectivo ?? "");
    setValidadorDepartamentoId(editing?.validadorDepartamentoId ?? "");
    setIdx(0);
    setFaltan([]);
    // Niveles: si edita, cargar de BD; si nuevo, un Nivel 1 vacío.
    // Al editar se parte de la cabecera que ya trae la lista (datos ciertos,
    // pintados al instante) y se refina con los niveles completos de BD.
    if (editing) {
      setCargando(true);
      setNiveles([{
        ...nivelVacio(editing.nivel || 1),
        vacaciones: editing.vacaciones,
        salarioBruto: editing.salarioBruto,
        jornadaContrato: editing.jornadaContrato,
        horasSemanales: editing.horasSemanales,
        diasLibres: editing.diasLibres,
        horarioSemanal: editing.horarioSemanal,
        observaciones: editing.observaciones,
        estado: editing.estado,
      }]);
      setCronogramaRol("");
      setCronogramaInicial("");
      setHorarioFamiliaId("");
      setHorarioInicial("");
      void Promise.all([
        listNivelesDePuesto(editing.id),
        getCronogramaDePuesto(editing.id),
        getHorarioPuesto(editing.id),
      ]).then(([rNiveles, rCrono, rHorario]) => {
        if (!activo) return;
        if (rNiveles.ok && rNiveles.data.length > 0) setNiveles(rNiveles.data);
        if (rCrono.ok) {
          setCronogramaRol(rCrono.rol ?? "");
          setCronogramaInicial(rCrono.rol ?? "");
        }
        setPatrones(rHorario.patrones);
        setTurnos(rHorario.turnos);
        setHorarioFamiliaId(rHorario.familiaSeleccionada ?? "");
        setHorarioInicial(rHorario.familiaSeleccionada ?? "");
        setCargando(false);
      });
    } else {
      setCargando(false);
      setNiveles([nivelVacio(1)]);
      setCronogramaRol("");
      setCronogramaInicial("");
      setHorarioFamiliaId("");
      setHorarioInicial("");
      // Al crear no hay puesto todavía, pero los horarios son de la empresa:
      // se piden sin puesto solo para poblar la lista de patrones.
      void getHorarioPuesto(null).then((r) => {
        if (!activo) return;
        setPatrones(r.patrones);
        setTurnos(r.turnos);
      });
    }
    return () => { activo = false; };
  }, [open, editing]);

  const handleDelete = async () => {
    if (!editing) return;
    const ok = await confirmDelete({
      title: "¿Eliminar puesto?",
      description: `Se eliminará el puesto "${editing.puesto}" y su vacante. No se podrá si tiene empleados o candidatos asociados.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await deletePuesto(editing.id);
      if (!res.ok) { toast.error(res.error ?? "No se pudo eliminar el puesto"); return; }
      toast.success("Puesto eliminado");
      onSaved();
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    // NORMA: el puesto se guarda con TODOS sus datos o no se guarda. Si falta
    // algo, se crearía un puesto que luego da de alta empleados incompletos.
    // Se valida antes de tocar la BD para no dejar el puesto creado a medias.
    const validacion = validarPuestoCompleto({
      nombre,
      departamentoId,
      descripcion,
      convenioColectivo: convenio,
      validadorDepartamentoId: validadorDepartamentoId || null,
      cronogramaRol: cronogramaRol || null,
      horarioFamiliaId: horarioFamiliaId || null,
      salarioBruto: cur?.salarioBruto ?? 0,
      jornadaContrato: cur?.jornadaContrato ?? "",
      horasSemanales: cur?.horasSemanales ?? 0,
      diasLibres: cur?.diasLibres ?? 0,
      vacaciones: cur?.vacaciones ?? "",
    });
    if (!validacion.ok) {
      setFaltan(validacion.faltan);
      toast.error(validacion.mensaje);
      return;
    }
    setFaltan([]);
    setSaving(true);
    try {
      let puestoId = editing?.id ?? "";
      if (esNuevo) {
        const res = await createPuesto({ nombre: nombre.trim(), departamento_id: departamentoId, descripcion: descripcion.trim() || null });
        if (!res.ok || !res.data) { toast.error(res.error ?? "No se pudo crear el puesto"); return; }
        puestoId = (res.data as { id: string }).id;
      } else {
        const upd = await updatePuesto({
          id: puestoId,
          nombre: nombre.trim(),
          departamento_id: departamentoId,
          descripcion: descripcion.trim() || null,
          convenio_colectivo: convenio,
        });
        if (!upd.ok) { toast.error(upd.error ?? "No se pudo actualizar el puesto"); return; }
      }
      // Guardar cada nivel (snapshot por puesto_id + nivel)
      for (const n of niveles) {
        const sal = await upsertPuestoSalario({
          puestoId,
          nivel: n.nivel,
          salarioBruto: n.salarioBruto,
          jornadaContrato: n.jornadaContrato,
          horasSemanales: n.horasSemanales,
          diasLibres: n.diasLibres,
          vacaciones: n.vacaciones,
          observaciones: n.observaciones,
          estado: n.estado,
          horarioSemanal: n.horarioSemanal,
        });
        if (!sal.ok) { toast.error(sal.error ?? "No se pudo guardar el nivel"); return; }
      }
      // Guardar datos de gestoría también al crear (createPuesto no los acepta;
      // se aplican con un updatePuesto inmediato tras crear). El convenio es
      // obligatorio, así que si esto falla el puesto quedaría incompleto: se
      // avisa en vez de darlo por guardado.
      if (esNuevo) {
        const updConv = await updatePuesto({ id: puestoId, convenio_colectivo: convenio });
        if (!updConv.ok) {
          toast.error(updConv.error ?? "No se pudo guardar el convenio colectivo");
          return;
        }
      }

      // El departamento validador se guarda aparte porque además propaga el
      // cambio a los empleados que ya ocupan el puesto.
      const valActual = editing?.validadorDepartamentoId ?? "";
      if ((validadorDepartamentoId || "") !== valActual || esNuevo) {
        const resVal = await setValidadorDepartamentoPuesto({
          puestoId,
          departamentoId: validadorDepartamentoId || null,
        });
        if (!resVal.ok) {
          toast.error(resVal.error ?? "No se pudo guardar el departamento validador");
          return;
        }
        if (resVal.empleadosActualizados) {
          toast.success(
            `Departamento validador actualizado en ${resVal.empleadosActualizados} empleado(s) de este puesto.`,
          );
        }
      }

      // Cronograma vinculado (solo si cambió, para no reescribir sin motivo).
      if (cronogramaRol !== cronogramaInicial) {
        const resCrono = await vincularCronogramaAPuesto(puestoId, cronogramaRol || null);
        if (!resCrono.ok) {
          toast.error(resCrono.error ?? "No se pudo vincular el cronograma");
          return;
        }
      }

      // Horario del puesto. Va después de las condiciones a propósito: se guarda
      // en `puesto_salarios`, así que esa fila debe existir ya.
      if (horarioFamiliaId !== horarioInicial) {
        const resHor = await setHorarioPuesto(puestoId, horarioFamiliaId || null);
        if (!resHor.ok) {
          toast.error(resHor.error ?? "No se pudo guardar el horario");
          return;
        }
      }

      toast.success(esNuevo ? "Puesto creado" : "Puesto actualizado");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{esNuevo ? "Nuevo puesto" : `Puesto · ${editing?.puesto}`}</DialogTitle>
          <DialogDescription>
            Define el puesto y sus condiciones. Al contratar se copian al empleado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Todos los datos son obligatorios: el puesto es la plantilla que se
              copia al empleado al contratar. */}
          {faltan.length > 0 && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Faltan datos por rellenar. Un puesto incompleto da de alta empleados con datos incompletos.
            </p>
          )}

          {/* Datos compartidos del puesto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-nombre">Puesto</Label>
              <Input id="ps-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Jefe de cocina" className={claseFalta("nombre")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-depto">Departamento</Label>
              <select
                id="ps-depto"
                value={departamentoId}
                onChange={(e) => setDepartamentoId(e.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${claseFalta("departamentoId")}`}
              >
                <option value="">Selecciona…</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-desc">Descripción</Label>
            <Textarea id="ps-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Funciones y responsabilidades del puesto" className={claseFalta("descripcion")} />
          </div>

          {/* Condiciones del puesto (niveles ocultos de momento: se edita uno solo) */}
          <div className="rounded-md border border-border/60 p-3 space-y-4">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              Condiciones del puesto
              {cargando && <Loader2 className="h-3 w-3 animate-spin" />}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="ps-bruto">Salario bruto mensual (€)</Label>
              <NumberInput id="ps-bruto" value={cur?.salarioBruto ?? 0} onValueChange={(v) => setCur({ salarioBruto: v })} min={0} className={claseFalta("salarioBruto")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ps-jornada">Jornada</Label>
                <select
                  id="ps-jornada"
                  value={cur?.jornadaContrato || "Completa"}
                  onChange={(e) => setCur({ jornadaContrato: e.target.value })}
                  className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${claseFalta("jornadaContrato")}`}
                >
                  {JORNADAS.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-horas">Horas/semana</Label>
                <NumberInput id="ps-horas" value={cur?.horasSemanales ?? 0} onValueChange={(v) => setCur({ horasSemanales: v })} min={0} max={60} className={claseFalta("horasSemanales")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-dias">Días libres</Label>
                <NumberInput id="ps-dias" value={cur?.diasLibres ?? 0} onValueChange={(v) => setCur({ diasLibres: v })} min={0} max={7} decimales={false} className={claseFalta("diasLibres")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-vac">Vacaciones</Label>
                <Input id="ps-vac" value={cur?.vacaciones ?? ""} onChange={(e) => setCur({ vacaciones: e.target.value })} placeholder="Ej. 30 días" className={claseFalta("vacaciones")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ps-crono">Cronograma</Label>
              <select
                id="ps-crono"
                value={cronogramaRol}
                onChange={(e) => setCronogramaRol(e.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${claseFalta("cronogramaRol")}`}
              >
                <option value="">
                  {esNuevo ? "Se crea con el puesto" : "Selecciona…"}
                </option>
                {cronogramas.map((c) => (
                  <option key={c.rol} value={c.rol}>
                    {c.rol}{c.departamento ? ` · ${c.departamento}` : ""} ({c.tareas})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Cronograma de tareas que sigue quien ocupe este puesto. Se elige entre los ya creados en Dirección.
              </p>
            </div>

            {/* Horario del puesto: se hereda al empleado que se contrate. */}
            <div className="space-y-1.5">
              <Label htmlFor="ps-horario">Horario</Label>
              <select
                id="ps-horario"
                value={horarioFamiliaId}
                onChange={(e) => setHorarioFamiliaId(e.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${claseFalta("horarioFamiliaId")}`}
              >
                <option value="">Selecciona…</option>
                {patrones.map((p) => (
                  <option key={p.familiaId} value={p.familiaId}>{p.nombre}</option>
                ))}
              </select>
              {patronElegido && (
                <div className="grid grid-cols-7 gap-0.5 pt-1">
                  {DIAS_SEMANA.map((d, i) => {
                    const t = patronElegido.dias[i] ? turnoById.get(patronElegido.dias[i]!) : null;
                    return (
                      <div key={d} className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground">{d}</span>
                        <span
                          className={`h-5 w-full rounded-sm flex items-center justify-center text-[9px] font-semibold ${t ? "text-white" : "bg-muted text-muted-foreground/60"}`}
                          style={t ? { backgroundColor: t.colorHex } : undefined}
                          title={t ? `${t.codigo} · ${t.nombre}` : "Libre"}
                        >
                          {t ? t.codigo : "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {patrones.length === 0
                  ? "No hay horarios creados todavía. Créalos en Horarios → Patrones."
                  : "Horario que sigue quien ocupe este puesto. Se elige entre los creados en Horarios."}
              </p>
            </div>

            {/* Observaciones: único campo que puede quedarse en blanco. */}
            <div className="space-y-1.5">
              <Label htmlFor="ps-obs">Observaciones (opcional)</Label>
              <Textarea id="ps-obs" value={cur?.observaciones ?? ""} onChange={(e) => setCur({ observaciones: e.target.value })} rows={2} placeholder="Condiciones particulares del puesto" />
            </div>
          </div>

          {/* Datos de gestoría (compartidos por el puesto) */}
          <div className="rounded-md border border-border/60 p-3 space-y-4">
            <p className="text-xs font-medium text-muted-foreground">Datos de gestoría</p>
            <div className="space-y-1.5">
              <Label htmlFor="ps-convenio">Convenio colectivo</Label>
              <Input id="ps-convenio" value={convenio} onChange={(e) => setConvenio(e.target.value)} placeholder="Ej. Hostelería de Madrid" className={claseFalta("convenioColectivo")} />
            </div>
          </div>

          {/* Validadores por defecto: se heredan al empleado al contratar. */}
          <div className="rounded-md border border-border/60 p-3 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Validador de solicitudes</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Departamento que aprueba o deniega las solicitudes de quien ocupe este puesto.
                Puede resolverlas cualquiera con acceso a ese departamento en su rol.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-val-depto">Valida este departamento</Label>
              <select
                id="ps-val-depto"
                value={validadorDepartamentoId}
                onChange={(e) => setValidadorDepartamentoId(e.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${claseFalta("validadorDepartamentoId")}`}
              >
                <option value="">Selecciona…</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        <DialogFooter className="sm:justify-between">
          {!esNuevo ? (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> {deleting ? "Eliminando…" : "Eliminar puesto"}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || deleting}>{saving ? "Guardando…" : esNuevo ? "Crear puesto" : "Guardar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {confirmDeleteDialog}
    </Dialog>
  );
}
