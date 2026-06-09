"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  addMonths,
  format,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  getPlanificacionHorarios,
  type Planificacion,
  type PlanEmpleado,
} from "@/features/rrhh/actions/planificacion-actions";
import {
  asignarTurnoDia,
  asignarPatronDia,
  quitarAsignacionDia,
} from "@/features/rrhh/actions/planificacion-asignar-actions";
import {
  listCuadrantes,
  ensureCuadrantesPorLocal,
} from "@/features/rrhh/actions/cuadrantes-actions";
import {
  HorariosToolbar,
  type Periodo,
} from "@/features/rrhh/components/horarios/HorariosToolbar";
import {
  CuadranteGrid,
  type Agrupacion,
  type AreaValor,
  type DropData,
} from "@/features/rrhh/components/horarios/CuadranteGrid";
import {
  PanelAsignacion,
  type DragData,
} from "@/features/rrhh/components/horarios/PanelAsignacion";
import { ConfiguracionHorariosSheet } from "@/features/rrhh/components/horarios/ConfiguracionHorariosSheet";
import { exportarCuadrantePDF } from "@/features/rrhh/utils/export-horarios";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

const PLAN_VACIO: Planificacion = {
  empleados: [],
  turnos: [],
  patrones: [],
  celdas: {},
  coloresDepartamento: {},
};

function rangoDe(periodo: Periodo, refDate: Date) {
  if (periodo === "mes") {
    return { desde: startOfMonth(refDate), hasta: endOfMonth(refDate) };
  }
  return {
    desde: startOfWeek(refDate, { weekStartsOn: 1 }),
    hasta: endOfWeek(refDate, { weekStartsOn: 1 }),
  };
}

function etiquetaRango(periodo: Periodo, desde: Date, hasta: Date): string {
  if (periodo === "mes") {
    return format(desde, "MMMM yyyy", { locale: es });
  }
  if (isSameMonth(desde, hasta)) {
    return `${format(desde, "d")} – ${format(hasta, "d 'de' MMM yyyy", { locale: es })}`;
  }
  return `${format(desde, "d MMM", { locale: es })} – ${format(hasta, "d MMM yyyy", { locale: es })}`;
}

export function HorariosView() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual.id;

  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [agrupacion, setAgrupacion] = useState<Agrupacion>("departamentos");
  // Por defecto: todo seleccionado. Área arranca con las dos. Departamento se
  // resuelve a "todos" mientras el usuario no toque el filtro (deptModificado).
  const [areas, setAreas] = useState<AreaValor[]>(["operativa", "administrativa"]);
  const [departamentosSel, setDepartamentosSel] = useState<string[]>([]);
  const [deptModificado, setDeptModificado] = useState(false);
  // Por defecto se ocultan los empleados sin ningún turno en el rango visible.
  const [ocultarSinTurno, setOcultarSinTurno] = useState(true);
  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const [cuadranteId, setCuadranteId] = useState<string | null>(null);
  const [cuadrantes, setCuadrantes] = useState<{ id: string; nombre: string }[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  const [plan, setPlan] = useState<Planificacion>(PLAN_VACIO);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  const turnoById = useMemo(
    () => new Map(plan.turnos.map((t) => [t.id, t])),
    [plan.turnos],
  );

  const empleadoById = useMemo(
    () => new Map(plan.empleados.map((e) => [e.empleadoId, e])),
    [plan.empleados],
  );

  // Asignación a la espera de confirmación cuando el turno/patrón se suelta
  // sobre empleados de otro departamento (aviso, no bloqueo).
  const [pendingAsignacion, setPendingAsignacion] = useState<{
    drag: DragData;
    drop: DropData;
    fuera: PlanEmpleado[];
    deptos: string[];
  } | null>(null);

  // Lista de departamentos disponibles (sobre el plan sin filtrar) para el menú.
  const departamentos = useMemo(
    () =>
      Array.from(
        new Set(plan.empleados.map((e) => e.departamento).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [plan.empleados],
  );

  // Selección efectiva de departamentos: mientras el usuario no toque el filtro,
  // equivale a "todos" (evita parpadeo y mantiene el default de todo marcado).
  const departamentosSelEfectivo = deptModificado ? departamentosSel : departamentos;
  const handleDepartamentosSelChange = useCallback((d: string[]) => {
    setDeptModificado(true);
    setDepartamentosSel(d);
  }, []);

  // Filtros de ámbito (área + departamento) con selección literal: el empleado
  // se muestra solo si su área y su departamento están marcados. Por defecto
  // está todo marcado, así que no filtra nada. "Ocultar sin turno" descarta a
  // quien no tenga ningún turno en el rango visible.
  const planFiltrado = useMemo<Planificacion>(() => {
    return {
      ...plan,
      empleados: plan.empleados.filter((e) => {
        if (!areas.includes(e.area)) return false;
        if (!(e.departamento != null && departamentosSelEfectivo.includes(e.departamento))) {
          return false;
        }
        if (ocultarSinTurno) {
          const tieneTurno = Object.values(plan.celdas[e.empleadoId] ?? {}).some(
            (arr) => arr.length > 0,
          );
          if (!tieneTurno) return false;
        }
        return true;
      }),
    };
  }, [plan, areas, departamentosSelEfectivo, ocultarSinTurno]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const { desde, hasta } = useMemo(
    () => rangoDe(periodo, refDate),
    [periodo, refDate],
  );
  const desdeISO = format(desde, "yyyy-MM-dd");
  const hastaISO = format(hasta, "yyyy-MM-dd");
  const hoyISO = format(new Date(), "yyyy-MM-dd");

  const dias = useMemo(
    () =>
      eachDayOfInterval({ start: desde, end: hasta }).map((date) => ({
        iso: format(date, "yyyy-MM-dd"),
        date,
      })),
    [desde, hasta],
  );

  // Cuadrantes para el selector de ámbito. Auto-crea uno por local (con el
  // nombre del local y todos los departamentos) si aún no existe y, por defecto,
  // selecciona el cuadrante del local (el primero con local asignado).
  useEffect(() => {
    let vivo = true;
    ensureCuadrantesPorLocal(empresaId).then((r) => {
      if (!vivo || !r.ok) return;
      setCuadrantes(r.data.map((c) => ({ id: c.id, nombre: c.nombre })));
      const localCuadrante = r.data.find((c) => c.localId) ?? r.data[0];
      setCuadranteId(localCuadrante?.id ?? null);
    });
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  // `silencioso`: recarga sin vaciar la rejilla (tras asignar/quitar).
  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      const r = await getPlanificacionHorarios(empresaId, {
        desdeISO,
        hastaISO,
        cuadranteId,
      });
      setPlan(r.data);
      if (!silencioso) setCargando(false);
    },
    [empresaId, desdeISO, hastaISO, cuadranteId],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al volver de la configuración, recargamos por si cambiaron turnos/patrones.
  const handleVolverDeConfig = () => {
    setConfigOpen(false);
    cargar();
    listCuadrantes(empresaId).then((r) => {
      if (r.ok) setCuadrantes(r.data.map((c) => ({ id: c.id, nombre: c.nombre })));
    });
  };

  // "+ Nuevo": abre el panel de asignación. En la vista Turnos no hay destinos
  // de drop, así que pasa a la vista Empleados para que sea operativo.
  const handleNuevo = () => {
    if (agrupacion === "turnos") setAgrupacion("empleados");
    setPanelOpen(true);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDrag((e.active.data.current as DragData) ?? null);
  };

  // Departamentos a los que pertenece lo que se arrastra: el del turno, o el
  // conjunto de departamentos de los turnos que componen el patrón.
  const deptosDelDrag = (drag: DragData): string[] => {
    if (drag.kind === "turno") {
      const dep = turnoById.get(drag.id)?.departamento;
      return dep ? [dep] : [];
    }
    const patron = plan.patrones.find((p) => p.id === drag.id);
    if (!patron) return [];
    const set = new Set<string>();
    for (const turnoId of patron.diasSemana1) {
      if (!turnoId) continue;
      const dep = turnoById.get(turnoId)?.departamento;
      if (dep) set.add(dep);
    }
    return Array.from(set);
  };

  const ejecutarAsignacion = async (drag: DragData, drop: DropData) => {
    const res =
      drag.kind === "turno"
        ? await asignarTurnoDia(empresaId, drop.empleadoIds, drop.fecha, drag.id)
        : await asignarPatronDia(empresaId, drop.empleadoIds, drop.fecha, drag.id);

    if (res.ok) {
      const fechaTxt = format(new Date(`${drop.fecha}T12:00:00`), "d 'de' MMM", {
        locale: es,
      });
      const n = drop.empleadoIds.length;
      toast.success(
        `${drag.kind === "turno" ? "Turno" : "Patrón"} ${drag.etiqueta} → ${drop.etiqueta}` +
          (n > 1 ? ` (${n} empleados)` : "") +
          ` · ${fechaTxt}`,
      );
      cargar(true);
    } else {
      toast.error(res.error ?? "No se pudo asignar");
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const drag = e.active.data.current as DragData | undefined;
    const drop = e.over?.data.current as DropData | undefined;
    if (!drag || !drop) return;

    // Empleados del destino cuyo departamento no coincide con el del
    // turno/patrón. Si lo arrastrado no tiene departamento, no se avisa.
    const deptos = deptosDelDrag(drag);
    const fuera =
      deptos.length === 0
        ? []
        : drop.empleadoIds
            .map((id) => empleadoById.get(id))
            .filter(
              (emp): emp is PlanEmpleado =>
                !!emp &&
                !(emp.departamento && deptos.includes(emp.departamento)),
            );

    if (fuera.length > 0) {
      setPendingAsignacion({ drag, drop, fuera, deptos });
      return;
    }
    void ejecutarAsignacion(drag, drop);
  };

  const handleDescargarPDF = () => {
    if (cargando) return;
    const AREA_LABEL = { operativa: "Operativa", administrativa: "Administrativa" };
    exportarCuadrantePDF({
      planificacion: planFiltrado,
      dias,
      agrupacion,
      hoyISO,
      compacto: periodo === "mes",
      empresaNombre: empresaActual.nombre,
      rangoLabel: etiquetaRango(periodo, desde, hasta),
      // Solo se etiqueta cuando es una selección parcial (no "todos").
      areaLabel:
        areas.length > 0 && areas.length < 2
          ? areas.map((a) => AREA_LABEL[a]).join(", ")
          : undefined,
      departamentoNombre:
        deptModificado &&
        departamentosSel.length > 0 &&
        departamentosSel.length < departamentos.length
          ? departamentosSel.join(", ")
          : undefined,
      cuadranteNombre: cuadrantes.find((c) => c.id === cuadranteId)?.nombre,
    });
  };

  const handleQuitar = async (asignacionId: string) => {
    const res = await quitarAsignacionDia(asignacionId);
    if (res.ok) cargar(true);
    else toast.error(res.error ?? "No se pudo quitar");
  };

  const paso = periodo === "mes" ? addMonths : addWeeks;

  // La configuración es una vista a pantalla completa dentro del software, no un
  // panel flotante: ocupa todo el espacio del contenido como cualquier otra vista.
  if (configOpen) {
    return (
      <ConfiguracionHorariosSheet
        empresaId={empresaId}
        onVolver={handleVolverDeConfig}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b px-5 py-3">
        <HorariosToolbar
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          label={etiquetaRango(periodo, desde, hasta)}
          onPrev={() => setRefDate((d) => paso(d, -1))}
          onNext={() => setRefDate((d) => paso(d, 1))}
          onHoy={() => setRefDate(new Date())}
          refDate={refDate}
          onSaltarA={(d) => setRefDate(d)}
          onNuevo={handleNuevo}
          onAbrirConfig={() => setConfigOpen(true)}
          onDescargarPDF={handleDescargarPDF}
        />
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-hidden p-5">
          <div className="min-w-0 flex-1 overflow-auto">
            <CuadranteGrid
              planificacion={planFiltrado}
              dias={dias}
              agrupacion={agrupacion}
              onAgrupacionChange={setAgrupacion}
              areas={areas}
              onAreasChange={setAreas}
              departamentosSel={departamentosSelEfectivo}
              onDepartamentosSelChange={handleDepartamentosSelChange}
              departamentos={departamentos}
              ocultarSinTurno={ocultarSinTurno}
              onOcultarSinTurnoChange={setOcultarSinTurno}
              cuadrantes={cuadrantes}
              cuadranteId={cuadranteId}
              onCuadranteChange={setCuadranteId}
              hoyISO={hoyISO}
              cargando={cargando}
              compacto={periodo === "mes"}
              interactivo={panelOpen}
              onQuitar={handleQuitar}
            />
          </div>
          {panelOpen && (
            <PanelAsignacion
              turnos={plan.turnos}
              patrones={plan.patrones}
              turnoById={turnoById}
              onClose={() => setPanelOpen(false)}
            />
          )}
        </div>

        <DragOverlay>
          {activeDrag && (
            <div className="rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-lg">
              {activeDrag.kind === "turno" ? "Turno" : "Patrón"} ·{" "}
              {activeDrag.etiqueta}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <AlertDialog
        open={!!pendingAsignacion}
        onOpenChange={(o) => {
          if (!o) setPendingAsignacion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empleado de otro departamento</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAsignacion &&
                (() => {
                  const { drag, fuera, deptos } = pendingAsignacion;
                  const tipo = drag.kind === "turno" ? "El turno" : "El patrón";
                  const deptoTxt = deptos.join(", ");
                  if (fuera.length === 1) {
                    const emp = fuera[0];
                    return `${tipo} «${drag.etiqueta}» es del departamento ${deptoTxt}, pero ${emp.nombreCompleto} ${
                      emp.departamento
                        ? `pertenece a ${emp.departamento}`
                        : "no tiene departamento asignado"
                    }. ¿Quieres asignárselo de todas formas?`;
                  }
                  return `${tipo} «${drag.etiqueta}» es del departamento ${deptoTxt}, pero ${fuera.length} empleados pertenecen a otro departamento (${fuera
                    .map((e) => e.nombreCompleto)
                    .join(", ")}). ¿Quieres asignárselo de todas formas?`;
                })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingAsignacion) {
                  void ejecutarAsignacion(
                    pendingAsignacion.drag,
                    pendingAsignacion.drop,
                  );
                }
                setPendingAsignacion(null);
              }}
            >
              Asignar de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
