"use client";

/**
 * Ficha de turno (crear / editar).
 *
 * Vive aparte porque se abre desde dos sitios: el listado de Turnos y el panel
 * de turnos del editor de Patrones ("Nuevo" sin salir del patrón). Es la MISMA
 * ficha en los dos: si se duplicara, el día que cambie un campo se cambiaría
 * solo en uno de los dos sitios.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  TipoJornada,
  Turno,
  TurnoTramo,
} from "@/features/rrhh/data/horarios";
import {
  createTurno,
  updateTurno,
  setEmpleadosDirectosTurno,
} from "@/features/rrhh/actions/turnos-actions";
import {
  getEmpleadosActivos,
  listDepartamentos,
  type EmpleadoActivo,
} from "@/features/rrhh/actions/empleados-actions";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  Plus,
  Search,
  Type,
  Quote,
  Clock,
  X,
  Loader2,
  Users,
  Check,
  Building2,
  History,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  Timer,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { Desplegable } from "@/components/ui/desplegable";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { SelectorHora } from "@/components/ui/selector-hora";

interface TurnoDraft {
  nombre: string;
  codigo: string;
  tramos: TurnoTramo[];
  departamento: string;
  empleadoIds: string[];
  tipoJornada: TipoJornada;
  /** Horas/día del flexible (sin días). 0 = sin definir. */
  flexHorasDia: number;
  vigenteDesde: string;          // YYYY-MM-DD (fecha de inicio, por defecto hoy)
  vigenteHasta: string;          // YYYY-MM-DD o "" = sin fecha de fin
}

function hoyISOTurno(): string {
  return new Date().toISOString().slice(0, 10);
}

// Para flexibles legacy (sin flex_horas_dia) deriva el valor del mapa por día.
export function flexHorasDiaDeTurno(t: Turno): number {
  if (t.flexHorasDia != null) return t.flexHorasDia;
  const valores = Object.values(t.flexHoras).filter((h): h is number => !!h);
  return valores.length ? Math.max(...valores) : 0;
}

function turnoToDraft(
  t: Turno | null,
  empleadoIds: string[] = [],
  jornadaInicial: TipoJornada = "fijo",
): TurnoDraft {
  if (!t) {
    return {
      nombre: "",
      codigo: "",
      tramos: [{ inicio: "09:00", fin: "17:00" }],
      departamento: "",
      empleadoIds,
      tipoJornada: jornadaInicial,
      flexHorasDia: 0,
      vigenteDesde: hoyISOTurno(),
      vigenteHasta: "",
    };
  }
  return {
    nombre: t.nombre,
    codigo: t.codigo,
    tramos: t.tramos.length ? t.tramos.map((tr) => ({ ...tr })) : [{ inicio: "09:00", fin: "17:00" }],
    departamento: t.departamento ?? "",
    empleadoIds,
    tipoJornada: t.tipoJornada,
    flexHorasDia: flexHorasDiaDeTurno(t),
    vigenteDesde: t.vigenteDesde ?? hoyISOTurno(),
    vigenteHasta: t.vigenteHasta ?? "",
  };
}

export function pluralEmpleados(n: number) {
  if (n === 0) return "0 empleados";
  if (n === 1) return "1 empleado";
  return `${n} empleados`;
}

// Minutos de un tramo (admite tramos que cruzan medianoche).
function minutosDeTramo(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fin.split(":").map(Number);
  let min = hf * 60 + mf - (hi * 60 + mi);
  if (min < 0) min += 24 * 60;
  return min;
}

// Horas calculadas en vivo desde el draft del modal. El flexible (sin días) es
// un valor por día; el fijo es la duración del turno en un día.
function horasSemanaDraft(draft: TurnoDraft): number {
  if (draft.tipoJornada === "flexible") {
    return Math.round((draft.flexHorasDia || 0) * 100) / 100;
  }
  const minDia = draft.tramos.reduce(
    (acc, t) => acc + minutosDeTramo(t.inicio, t.fin),
    0,
  );
  return Math.round((minDia / 60) * 100) / 100;
}

// "8" → "8h"; "8.5" → "8h 30min"; "0" → "0h".
function fmtHoras(horas: number): string {
  if (horas <= 0) return "0h";
  const totalMin = Math.round(horas * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

export interface TurnoFormDialogProps {
  empresaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Turno a editar. null/undefined = crear uno nuevo. */
  turno?: Turno | null;
  /** Empleados ya asignados directamente al turno que se edita. */
  empleadoIdsDirectos?: string[];
  /**
   * Fija el tipo de jornada y se salta el paso de elegir Fijo/Flexible. Lo usa
   * el editor de patrones: un patrón fijo solo puede usar turnos fijos, así que
   * dejar elegir el otro tipo crearía un turno que no aparece en su lista.
   */
  jornadaFija?: TipoJornada;
  /** Tras guardar. `turnoId` es el turno creado o editado. */
  onGuardado: (turnoId: string | null) => void | Promise<void>;
  /** Solo en edición: crear una versión nueva del turno. */
  onCrearVersion?: (turno: Turno) => void;
  /** Solo en edición: ver el histórico de versiones. */
  onVerVersiones?: (turno: Turno) => void;
}

export function TurnoFormDialog({
  empresaId,
  open,
  onOpenChange,
  turno,
  empleadoIdsDirectos,
  jornadaFija,
  onGuardado,
  onCrearVersion,
  onVerVersiones,
}: TurnoFormDialogProps) {
  const editandoId = turno?.id ?? null;

  const [draft, setDraft] = useState<TurnoDraft>(() =>
    turnoToDraft(null, [], jornadaFija ?? "fijo"),
  );
  // En creación: true mientras se elige Fijo/Flexible (paso 1). En edición —y
  // cuando el tipo viene impuesto— siempre false: se va directo a la ficha.
  const [eligiendoTipo, setEligiendoTipo] = useState(false);
  const [empBusqueda, setEmpBusqueda] = useState("");
  const [empPanelOpen, setEmpPanelOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [empleadosActivos, setEmpleadosActivos] = useState<EmpleadoActivo[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  useGlobalLoadingSync(guardando || cargandoCatalogos);

  const idsDirectosKey = (empleadoIdsDirectos ?? []).join(",");

  // Al abrirse, la ficha parte siempre del turno que toca (o en blanco).
  useEffect(() => {
    if (!open) return;
    setDraft(
      turnoToDraft(
        turno ?? null,
        empleadoIdsDirectos ?? [],
        jornadaFija ?? "fijo",
      ),
    );
    setEligiendoTipo(!editandoId && !jornadaFija);
    setEmpBusqueda("");
    setEmpPanelOpen(false);
    // Se reinicia al abrir y al cambiar de turno, no con cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editandoId, jornadaFija, idsDirectosKey]);

  // Departamentos y empleados se leen al abrir: así la ficha ve lo que hay
  // ahora mismo, aunque el listado de detrás se cargara hace rato.
  const cargarCatalogos = useCallback(async () => {
    setCargandoCatalogos(true);
    const [ea, dp] = await Promise.all([
      getEmpleadosActivos(empresaId),
      listDepartamentos(),
    ]);
    if (ea.ok) setEmpleadosActivos(ea.data);
    if (dp.ok) {
      const nombres = Array.from(
        new Set((dp.data ?? []).map((d) => d.nombre).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "es"));
      setDepartamentos(nombres);
    }
    setCargandoCatalogos(false);
  }, [empresaId]);

  useEffect(() => {
    if (open) cargarCatalogos();
  }, [open, cargarCatalogos]);

  // Empleados seleccionables: solo los del departamento vinculado al turno.
  // Se recalcula en vivo, de modo que si un empleado cambia de departamento
  // deja de estar disponible aquí en cuanto se recargan los datos.
  const empleadosDelDepto = useMemo(
    () =>
      draft.departamento
        ? empleadosActivos.filter((e) => e.departamento === draft.departamento)
        : [],
    [empleadosActivos, draft.departamento],
  );

  const esFlexible = draft.tipoJornada === "flexible";
  const totalSemana = horasSemanaDraft(draft);
  // Duración diaria del turno fijo (suma de tramos): el fijo no tiene días, así
  // que su métrica es las horas que dura el turno en un día (partido incluido).
  const duracionDia =
    draft.tramos.reduce((acc, t) => acc + minutosDeTramo(t.inicio, t.fin), 0) /
    60;

  const guardar = async () => {
    const nombre = draft.nombre.trim();
    const codigo = draft.codigo.trim().toUpperCase();
    const departamento = draft.departamento.trim();
    if (!nombre || !codigo || !departamento) return;

    // Ni fijo ni flexible llevan días: el día lo pone el patrón o la asignación
    // directa. El flexible solo indica las horas/día; el fijo, sus tramos.
    const flexHorasDia = esFlexible ? draft.flexHorasDia || 0 : null;
    if (esFlexible && flexHorasDia! <= 0) return;
    const tramos = esFlexible
      ? []
      : draft.tramos.filter((tr) => tr.inicio && tr.fin);
    if (!esFlexible && tramos.length === 0) return;

    // Solo se persisten empleados que sigan perteneciendo al departamento del
    // turno (el vínculo manda; si alguien cambió de departamento, se descarta).
    const idsDelDepto = new Set(
      empleadosActivos
        .filter((e) => e.departamento === departamento)
        .map((e) => e.empleadoId),
    );
    const empleadoIds = draft.empleadoIds.filter((id) => idsDelDepto.has(id));

    const vigenteDesde = draft.vigenteDesde || hoyISOTurno();
    const vigenteHasta = draft.vigenteHasta ? draft.vigenteHasta : null;
    if (vigenteHasta && vigenteHasta < vigenteDesde) {
      toast.error("La fecha de fin del turno no puede ser anterior a la de inicio.");
      return;
    }

    setGuardando(true);
    let turnoId = editandoId;
    if (editandoId) {
      // Solo metadatos: la jornada (tramos, días, horas flexibles, vigencia) no
      // se edita en sitio, se cambia creando una versión nueva del turno.
      const res = await updateTurno(editandoId, { nombre, codigo, departamento });
      if (!res.ok) {
        // P. ej. turno en uso por un patrón: hay que cambiar antes el patrón.
        toast.error(res.error || "No se pudo guardar el turno");
        setGuardando(false);
        return;
      }
    } else {
      const res = await createTurno(empresaId, {
        nombre,
        codigo,
        tramos,
        departamento,
        tipoJornada: draft.tipoJornada,
        dias: [],
        flexHorasDia,
        vigenteDesde,
        vigenteHasta,
      });
      if (!res.ok) {
        toast.error(res.error || "No se pudo crear el turno");
        setGuardando(false);
        return;
      }
      turnoId = res.id ?? null;
    }
    if (turnoId) {
      const resAsig = await setEmpleadosDirectosTurno(empresaId, turnoId, empleadoIds);
      if (!resAsig.ok) {
        // P. ej. turno fuera de su vigencia: no se puede asignar hoy.
        toast.error(resAsig.error || "No se pudieron asignar los empleados");
        await onGuardado(turnoId);
        setGuardando(false);
        return;
      }
    }
    await onGuardado(turnoId);
    setGuardando(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setEligiendoTipo(false);
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editandoId ? "Editar turno" : "Crear turno"}</DialogTitle>
        </DialogHeader>

        {eligiendoTipo && !editandoId ? (
          <TipoJornadaChooser
            onElegir={(tipo) => {
              setDraft((d) => ({ ...d, tipoJornada: tipo }));
              setEligiendoTipo(false);
            }}
          />
        ) : (
        <>
        {/* Cabecera de tipo de jornada con opción de volver al paso 1. */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          {esFlexible ? (
            <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium">
            {esFlexible ? "Horario flexible" : "Horario fijo"}
          </span>
          {!editandoId && !jornadaFija && (
            <button
              type="button"
              onClick={() => setEligiendoTipo(true)}
              className="ml-auto text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Cambiar tipo
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="relative flex-1">
              <Input
                value={draft.nombre}
                onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                placeholder="Nombre del turno"
                className="pr-9"
              />
              {draft.nombre && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, nombre: "" }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="relative flex-1">
              <Input
                value={draft.codigo}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, codigo: e.target.value.toUpperCase() }))
                }
                placeholder="Código (ej. COC)"
                maxLength={4}
                className="pr-9 uppercase"
              />
              {draft.codigo && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, codigo: "" }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <Desplegable
              value={draft.departamento}
              onChange={(e) => {
                const departamento = e.target.value;
                setDraft((d) => {
                  // Al cambiar de departamento se descartan los empleados que ya
                  // no pertenecen a él; el vínculo turno↔departamento manda.
                  const idsDelDepto = new Set(
                    empleadosActivos
                      .filter((emp) => emp.departamento === departamento)
                      .map((emp) => emp.empleadoId),
                  );
                  return {
                    ...d,
                    departamento,
                    empleadoIds: d.empleadoIds.filter((id) => idsDelDepto.has(id)),
                  };
                });
              }}
              className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecciona un departamento…</option>
              {departamentos.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </Desplegable>
          </div>
          <p className="pl-6 text-xs text-muted-foreground">
            El color del turno lo define su departamento (se edita en
            Configuración → Colores de departamento).
          </p>

          {/* Vigencia del turno: manda el turno (ningún patrón puede usarlo
              fuera de estas fechas). Inicio por defecto hoy; fin opcional.
              Solo aplica al horario fijo; el flexible no fija vigencia. */}
          {!esFlexible && (
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex flex-1 flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Fecha de inicio</label>
                <SelectorFecha
                  value={draft.vigenteDesde}
                  disabled={!!editandoId}
                  onChange={(valor) => setDraft((d) => ({ ...d, vigenteDesde: valor }))}
                  className="w-40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Fecha de fin</label>
                <SelectorFecha
                  value={draft.vigenteHasta}
                  min={draft.vigenteDesde || undefined}
                  disabled={!!editandoId}
                  onChange={(valor) => setDraft((d) => ({ ...d, vigenteHasta: valor }))}
                  className="w-40"
                />
              </div>
              {!editandoId && (
                <span className="pb-2 text-[11px] text-muted-foreground">Vacío = sin fecha de fin.</span>
              )}
            </div>
          </div>
          )}

          {/* El día NO vive en el turno: lo pone el patrón o la asignación
              directa a días/empleados (igual en fijo y flexible). */}
          <p className="flex items-start gap-1.5 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {esFlexible
              ? "Este turno solo indica las horas. El día y la repetición se deciden en el patrón o asignándolo directo a días y empleados."
              : "Este turno no tiene día propio: el día se decide en el patrón (colocas el turno en cada día de la semana) y el patrón marca desde qué día empieza."}
          </p>

          {esFlexible ? (
            /* Jornada flexible (sin días): solo las horas por día. */
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Horas por día</span>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={draft.flexHorasDia || ""}
                  disabled={!!editandoId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      flexHorasDia:
                        v === "" ? 0 : Math.max(0, Math.min(24, Number(v))),
                    }));
                  }}
                  placeholder="0"
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">
                  horas al día
                </span>
              </div>
            </div>
          ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Rangos horarios</span>
              {!editandoId && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      tramos: [...d.tramos, { inicio: "12:00", fin: "16:00" }],
                    }))
                  }
                  className="ml-auto text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir rango
                </button>
              )}
            </div>
            <div className="space-y-2 pl-6">
              {draft.tramos.map((tramo, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <SelectorHora value={tramo.inicio}
                    disabled={!!editandoId}
                    onChange={(valor) =>
                      setDraft((d) => ({
                        ...d,
                        tramos: d.tramos.map((tr, i) =>
                          i === idx ? { ...tr, inicio: valor } : tr,
                        ),
                      }))
                    }
                    className="w-28"
                  />
                  <span className="text-muted-foreground">-</span>
                  <SelectorHora value={tramo.fin}
                    disabled={!!editandoId}
                    onChange={(valor) =>
                      setDraft((d) => ({
                        ...d,
                        tramos: d.tramos.map((tr, i) =>
                          i === idx ? { ...tr, fin: valor } : tr,
                        ),
                      }))
                    }
                    className="w-28"
                  />
                  {!editandoId && draft.tramos.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          tramos: d.tramos.filter((_, i) => i !== idx),
                        }))
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
          )}

          {/* La jornada entera (horario, horas del flexible y vigencia) está
              bloqueada al editar: es el molde del que cuelgan las horas
              teóricas ya calculadas. Se cambia creando una versión nueva. */}
          {editandoId && turno && (onCrearVersion || onVerVersiones) && (
            <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                La jornada está bloqueada: cambiarla alteraría las horas
                previstas de los meses ya cerrados. Para cambiarla se crea una
                versión nueva, conservando el histórico y aplicándola a los
                empleados que elijas desde una fecha. Aquí solo se editan el
                nombre, el código y el departamento.
              </p>
              <div className="flex flex-wrap gap-2">
                {onCrearVersion && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      onOpenChange(false);
                      onCrearVersion(turno);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Crear nueva versión de turno
                  </Button>
                )}
                {onVerVersiones && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => onVerVersiones(turno)}
                  >
                    <History className="h-3.5 w-3.5" />
                    Ver versiones
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Total en vivo: ambos sin días. El flexible muestra sus horas/día;
              el fijo, la duración del turno en un día. */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {esFlexible ? "Horas por día" : "Duración del turno"}
            </span>
            <span className="font-semibold tabular-nums">
              {fmtHoras(esFlexible ? totalSemana : duracionDia)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Empleados asignados</span>
              {draft.empleadoIds.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {pluralEmpleados(draft.empleadoIds.length)}
                </span>
              )}
            </div>
            <p className="pl-6 text-xs text-muted-foreground">
              Solo aparecen los empleados del departamento del turno. Asigna a
              quien solo trabaja ese horario; para quien rota entre varios
              turnos, usa un patrón.
            </p>
            {!draft.departamento ? (
              <p className="pl-6 text-xs text-amber-600 dark:text-amber-500">
                Selecciona primero un departamento para ver sus empleados.
              </p>
            ) : (
            <div className="pl-6 space-y-2">
              <button
                type="button"
                onClick={() => setEmpPanelOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 h-9 text-sm hover:bg-muted/60 transition-colors"
              >
                <span className="truncate text-left">
                  {draft.empleadoIds.length === 0
                    ? "Seleccionar empleados…"
                    : pluralEmpleados(draft.empleadoIds.length)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    empPanelOpen && "rotate-180",
                  )}
                />
              </button>
              {empPanelOpen && (
                <div className="space-y-2 rounded-md border p-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empleado..."
                      value={empBusqueda}
                      onChange={(e) => setEmpBusqueda(e.target.value)}
                      className="pl-9 h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
                    {empleadosDelDepto.length === 0 && (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No hay empleados en este departamento.
                      </p>
                    )}
                    {empleadosDelDepto
                      .filter((e) =>
                        !empBusqueda
                          ? true
                          : e.nombreCompleto
                              .toLowerCase()
                              .includes(empBusqueda.toLowerCase()),
                      )
                      .map((e) => {
                        const checked = draft.empleadoIds.includes(e.empleadoId);
                        return (
                          <button
                            key={e.empleadoId}
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                empleadoIds: checked
                                  ? d.empleadoIds.filter((id) => id !== e.empleadoId)
                                  : [...d.empleadoIds, e.empleadoId],
                              }))
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
                            <span className="truncate">
                              {e.nombreCompleto}
                              {e.puesto && (
                                <span className="text-muted-foreground">
                                  {" — "}{e.puesto}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={
              guardando ||
              !draft.nombre.trim() ||
              !draft.codigo.trim() ||
              !draft.departamento.trim() ||
              (esFlexible
                ? !draft.flexHorasDia || draft.flexHorasDia <= 0
                : draft.tramos.filter((tr) => tr.inicio && tr.fin).length === 0)
            }
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TipoJornadaChooser({
  onElegir,
}: {
  onElegir: (tipo: TipoJornada) => void;
}) {
  const opciones: {
    tipo: TipoJornada;
    icono: typeof CalendarClock;
    titulo: string;
    descripcion: string;
    ejemplo: string;
  }[] = [
    {
      tipo: "fijo",
      icono: CalendarClock,
      titulo: "Horario fijo",
      descripcion:
        "La hora de entrada y salida es fija y común para todos los empleados que tengan este horario.",
      ejemplo: "Ejemplo: de 09:00 a 17:00",
    },
    {
      tipo: "flexible",
      icono: Timer,
      titulo: "Horario flexible",
      descripcion:
        "Se establece una cantidad de horas a realizar en un periodo de tiempo concreto.",
      ejemplo: "Ejemplo: 40:00 horas semanales",
    },
  ];
  return (
    <div className="space-y-3">
      {opciones.map((o) => (
        <button
          key={o.tipo}
          type="button"
          onClick={() => onElegir(o.tipo)}
          className="group flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
            <o.icono className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{o.titulo}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{o.descripcion}</p>
            <p className="mt-1 text-xs text-muted-foreground">{o.ejemplo}</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </button>
      ))}
    </div>
  );
}
