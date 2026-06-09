"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  pillStyleDepartamento,
  formatTurnoHorario,
  DIAS_SEMANA,
  DIA_SEMANA_LABEL,
  type Descanso,
  type DiaSemana,
  type TipoJornada,
  type Turno,
  type TurnoTono,
  type TurnoTramo,
} from "@/features/rrhh/data/horarios";
import {
  listTurnos,
  createTurno,
  updateTurno,
  deleteTurno,
  getEmpleadosDirectosPorTurno,
  setEmpleadosDirectosTurno,
} from "@/features/rrhh/actions/turnos-actions";
import {
  AsistenteVersionTurno,
  HistorialVersionesTurno,
} from "@/features/rrhh/components/horarios/AsistenteVersionTurno";
import { listDescansos } from "@/features/rrhh/actions/descansos-actions";
import {
  getEmpleadosPorTurno,
  type EmpleadoBasico,
} from "@/features/rrhh/actions/patrones-actions";
import {
  getEmpleadosActivos,
  listDepartamentos,
  type EmpleadoActivo,
} from "@/features/rrhh/actions/empleados-actions";
import { Card } from "@/shared/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  Search,
  Type,
  Quote,
  Clock,
  X,
  MoreVertical,
  Archive,
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

interface TurnoDraft {
  nombre: string;
  codigo: string;
  tramos: TurnoTramo[];
  color: TurnoTono;
  departamento: string;
  empleadoIds: string[];
  tipoJornada: TipoJornada;
  dias: DiaSemana[];
  flexHoras: Partial<Record<DiaSemana, number>>;
  vigenteDesde: string;          // YYYY-MM-DD (fecha de inicio, por defecto hoy)
  vigenteHasta: string;          // YYYY-MM-DD o "" = sin fecha de fin
}

const DIAS_LABORABLES_DEFECTO: DiaSemana[] = ["L", "M", "X", "J", "V"];

function hoyISOTurno(): string {
  return new Date().toISOString().slice(0, 10);
}

function turnoToDraft(t: Turno | null, empleadoIds: string[] = []): TurnoDraft {
  if (!t) {
    return {
      nombre: "",
      codigo: "",
      tramos: [{ inicio: "09:00", fin: "17:00" }],
      color: "emerald",
      departamento: "",
      empleadoIds,
      tipoJornada: "fijo",
      dias: [...DIAS_LABORABLES_DEFECTO],
      flexHoras: {},
      vigenteDesde: hoyISOTurno(),
      vigenteHasta: "",
    };
  }
  return {
    nombre: t.nombre,
    codigo: t.codigo,
    tramos: t.tramos.length ? t.tramos.map((tr) => ({ ...tr })) : [{ inicio: "09:00", fin: "17:00" }],
    color: t.color,
    departamento: t.departamento ?? "",
    empleadoIds,
    tipoJornada: t.tipoJornada,
    dias: t.dias.length ? [...t.dias] : [...DIAS_LABORABLES_DEFECTO],
    flexHoras: { ...t.flexHoras },
    vigenteDesde: t.vigenteDesde ?? hoyISOTurno(),
    vigenteHasta: t.vigenteHasta ?? "",
  };
}

type EmpleadoConOrigen = EmpleadoBasico & {
  directo: boolean;
  patron: boolean;
};

function pluralEmpleados(n: number) {
  if (n === 0) return "0 empleados";
  if (n === 1) return "1 empleado";
  return `${n} empleados`;
}

function pluralDescansos(n: number) {
  if (n === 0) return "0 descansos";
  if (n === 1) return "1 descanso";
  return `${n} descansos`;
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

// Horas a la semana calculadas en vivo desde el draft del modal.
function horasSemanaDraft(draft: TurnoDraft): number {
  if (draft.tipoJornada === "flexible") {
    const total = draft.dias.reduce(
      (acc, d) => acc + (draft.flexHoras[d] ?? 0),
      0,
    );
    return Math.round(total * 100) / 100;
  }
  const minDia = draft.tramos.reduce(
    (acc, t) => acc + minutosDeTramo(t.inicio, t.fin),
    0,
  );
  const horasDia = minDia / 60;
  return Math.round(horasDia * draft.dias.length * 100) / 100;
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

export function TurnosSection({ empresaId }: { empresaId: string }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [descansos, setDescansos] = useState<Descanso[]>([]);
  const [empleadosPorTurno, setEmpleadosPorTurno] = useState<
    Record<string, EmpleadoBasico[]>
  >({});
  const [empleadosDirectosPorTurno, setEmpleadosDirectosPorTurno] = useState<
    Record<string, EmpleadoBasico[]>
  >({});
  const [empleadosActivos, setEmpleadosActivos] = useState<EmpleadoActivo[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [empBusqueda, setEmpBusqueda] = useState("");
  const [empPanelOpen, setEmpPanelOpen] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(cargando || guardando);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  // En creación: true mientras se elige Fijo/Flexible (paso 1). En edición
  // siempre false (se va directo a la configuración).
  const [eligiendoTipo, setEligiendoTipo] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TurnoDraft>(() => turnoToDraft(null));
  const [verEmpleadosTurno, setVerEmpleadosTurno] = useState<Turno | null>(null);
  const [verDescansosTurno, setVerDescansosTurno] = useState<Turno | null>(null);
  const [versionandoTurno, setVersionandoTurno] = useState<Turno | null>(null);
  const [historialTurno, setHistorialTurno] = useState<Turno | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    const [tr, dr, ep, ed, ea, dp] = await Promise.all([
      listTurnos(empresaId),
      listDescansos(empresaId),
      getEmpleadosPorTurno(empresaId),
      getEmpleadosDirectosPorTurno(empresaId),
      getEmpleadosActivos(empresaId),
      listDepartamentos(),
    ]);
    if (tr.ok) setTurnos(tr.data);
    if (dr.ok) setDescansos(dr.data);
    if (ep.ok) setEmpleadosPorTurno(ep.data);
    if (ed.ok) setEmpleadosDirectosPorTurno(ed.data);
    if (ea.ok) setEmpleadosActivos(ea.data);
    if (dp.ok) {
      const nombres = Array.from(
        new Set((dp.data ?? []).map((d) => d.nombre).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "es"));
      setDepartamentos(nombres);
    }
    setCargando(false);
  }, [empresaId]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const descansosPorTurno = useMemo(() => {
    const map = new Map<string, Descanso[]>();
    for (const d of descansos) {
      for (const tId of d.turnos) {
        const arr = map.get(tId) ?? [];
        arr.push(d);
        map.set(tId, arr);
      }
    }
    return map;
  }, [descansos]);

  // Empleados por turno combinando asignación directa + patrón, sin duplicar.
  const empleadosCombinadosPorTurno = useMemo(() => {
    const map = new Map<string, EmpleadoConOrigen[]>();
    const turnoIds = new Set<string>([
      ...Object.keys(empleadosDirectosPorTurno),
      ...Object.keys(empleadosPorTurno),
    ]);
    for (const turnoId of turnoIds) {
      const porId = new Map<string, EmpleadoConOrigen>();
      for (const e of empleadosDirectosPorTurno[turnoId] ?? []) {
        porId.set(e.id, { ...e, directo: true, patron: false });
      }
      for (const e of empleadosPorTurno[turnoId] ?? []) {
        const prev = porId.get(e.id);
        if (prev) prev.patron = true;
        else porId.set(e.id, { ...e, directo: false, patron: true });
      }
      map.set(
        turnoId,
        Array.from(porId.values()).sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es"),
        ),
      );
    }
    return map;
  }, [empleadosDirectosPorTurno, empleadosPorTurno]);

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

  const filtrados = turnos.filter(
    (t) =>
      !busqueda ||
      t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.codigo.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const abrirNuevo = () => {
    setEditandoId(null);
    setEmpBusqueda("");
    setEmpPanelOpen(false);
    setDraft(turnoToDraft(null));
    setEligiendoTipo(true);
    setShowModal(true);
  };

  // Elegir tipo en el paso 1 fija el tipo de jornada y pasa a la configuración.
  const elegirTipo = (tipo: TipoJornada) => {
    setDraft((d) => ({ ...d, tipoJornada: tipo }));
    setEligiendoTipo(false);
  };

  const abrirEditar = (t: Turno) => {
    setEditandoId(t.id);
    setEmpBusqueda("");
    setEmpPanelOpen(false);
    setEligiendoTipo(false);
    const idsDirectos = (empleadosDirectosPorTurno[t.id] ?? []).map((e) => e.id);
    setDraft(turnoToDraft(t, idsDirectos));
    setShowModal(true);
  };

  const duplicar = async (t: Turno) => {
    setGuardando(true);
    await createTurno(empresaId, {
      nombre: `${t.nombre} (copia)`,
      codigo: t.codigo,
      tramos: t.tramos.map((tr) => ({ ...tr })),
      color: t.color,
      activo: true,
      tipoJornada: t.tipoJornada,
      dias: [...t.dias],
      flexHoras: { ...t.flexHoras },
    });
    await refrescar();
    setGuardando(false);
  };

  const eliminar = async (id: string) => {
    setGuardando(true);
    const res = await deleteTurno(id);
    if (!res.ok) {
      // P. ej. turno en uso por un patrón: cambiar antes el patrón.
      toast.error(res.error || "No se pudo eliminar el turno");
      setGuardando(false);
      return;
    }
    await refrescar();
    setGuardando(false);
  };

  const guardar = async () => {
    const nombre = draft.nombre.trim();
    const codigo = draft.codigo.trim().toUpperCase();
    const departamento = draft.departamento.trim();
    if (!nombre || !codigo || !departamento) return;

    const esFlexible = draft.tipoJornada === "flexible";
    // Los turnos FIJOS no llevan días: el día lo pone el patrón (cada turno en
    // su casilla del día). Solo el flexible necesita días para sus horas/día.
    if (esFlexible && draft.dias.length === 0) return;
    const tramos = esFlexible
      ? []
      : draft.tramos.filter((tr) => tr.inicio && tr.fin);
    if (!esFlexible && tramos.length === 0) return;

    // En flexible solo se guardan las horas de los días activos.
    const flexHoras: Partial<Record<DiaSemana, number>> = {};
    if (esFlexible) {
      let algunaHora = false;
      for (const dia of draft.dias) {
        const h = draft.flexHoras[dia] ?? 0;
        if (h > 0) {
          flexHoras[dia] = h;
          algunaHora = true;
        }
      }
      if (!algunaHora) return;
    }

    // Solo se persisten empleados que sigan perteneciendo al departamento del
    // turno (el vínculo manda; si alguien cambió de departamento, se descarta).
    const idsDelDepto = new Set(
      empleadosActivos
        .filter((e) => e.departamento === departamento)
        .map((e) => e.empleadoId),
    );
    const empleadoIds = draft.empleadoIds.filter((id) => idsDelDepto.has(id));

    // El día solo existe en el flexible; el fijo se guarda sin días.
    const diasGuardar = esFlexible ? draft.dias : [];

    const vigenteDesde = draft.vigenteDesde || hoyISOTurno();
    const vigenteHasta = draft.vigenteHasta ? draft.vigenteHasta : null;
    if (vigenteHasta && vigenteHasta < vigenteDesde) {
      toast.error("La fecha de fin del turno no puede ser anterior a la de inicio.");
      return;
    }

    setGuardando(true);
    let turnoId = editandoId;
    if (editandoId) {
      const res = await updateTurno(editandoId, {
        nombre,
        codigo,
        tramos,
        color: draft.color,
        departamento,
        dias: diasGuardar,
        flexHoras,
        vigenteDesde,
        vigenteHasta,
      });
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
        color: draft.color,
        departamento,
        tipoJornada: draft.tipoJornada,
        dias: diasGuardar,
        flexHoras,
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
        await refrescar();
        setGuardando(false);
        return;
      }
    }
    await refrescar();
    setGuardando(false);
    setShowModal(false);
    setEditandoId(null);
  };

  const turnoEditando = editandoId
    ? turnos.find((t) => t.id === editandoId) ?? null
    : null;

  const esFlexible = draft.tipoJornada === "flexible";
  const totalSemana = horasSemanaDraft(draft);
  // Duración diaria del turno fijo (suma de tramos): el fijo no tiene días, así
  // que su métrica es las horas que dura el turno en un día (partido incluido).
  const duracionDia =
    draft.tramos.reduce((acc, t) => acc + minutosDeTramo(t.inicio, t.fin), 0) /
    60;

  const toggleDia = (dia: DiaSemana) =>
    setDraft((d) => ({
      ...d,
      dias: d.dias.includes(dia)
        ? d.dias.filter((x) => x !== dia)
        : [...DIAS_SEMANA.filter((x) => d.dias.includes(x) || x === dia)],
    }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Turnos
        </h2>
        <p className="text-sm text-muted-foreground">
          Crea los turnos de trabajo con su horario y descansos para asignarlos
          a los empleados.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar turno..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="primary" size="sm" onClick={abrirNuevo} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_150px_120px_120px_56px] items-center px-4 py-2.5 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Nombre</div>
          <div>Horario</div>
          <div>Departamento</div>
          <div className="text-center">Descansos</div>
          <div className="text-center">Empleados</div>
          <div />
        </div>
        <div className="divide-y">
          {cargando && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
            </div>
          )}
          {!cargando &&
            filtrados.map((t) => {
              const descansosDelTurno = descansosPorTurno.get(t.id) ?? [];
              const empleadosDelTurno =
                empleadosCombinadosPorTurno.get(t.id) ?? [];
              return (
                <div
                  key={t.id}
                  className="group grid grid-cols-[1fr_1fr_150px_120px_120px_56px] items-center px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide"
                      style={pillStyleDepartamento(t.colorHex)}
                    >
                      {t.codigo}
                    </span>
                    <span className="text-sm font-medium truncate">{t.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                        t.tipoJornada === "flexible"
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                          : "bg-stone-100 text-stone-600 dark:bg-stone-800/60 dark:text-stone-300",
                      )}
                    >
                      {t.tipoJornada === "flexible" ? (
                        <Timer className="h-3 w-3" />
                      ) : (
                        <CalendarClock className="h-3 w-3" />
                      )}
                      {t.tipoJornada === "flexible" ? "Flexible" : "Fijo"}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums truncate">
                      {formatTurnoHorario(t)}
                    </span>
                  </div>
                  <div className="text-sm truncate pr-2">
                    {t.departamento ? (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{t.departamento}</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-500">
                        Sin asignar
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-center">
                    {descansosDelTurno.length === 0 ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVerDescansosTurno(t)}
                        className="text-primary hover:underline"
                      >
                        {pluralDescansos(descansosDelTurno.length)}
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-center">
                    {empleadosDelTurno.length === 0 ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVerEmpleadosTurno(t)}
                        className="text-primary hover:underline"
                      >
                        {pluralEmpleados(empleadosDelTurno.length)}
                      </button>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => abrirEditar(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicar(t)}>
                          <Copy className="h-3.5 w-3.5" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="h-3.5 w-3.5" />
                          Archivar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => eliminar(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          {!cargando && filtrados.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Sin turnos configurados
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end text-xs text-muted-foreground">
        {turnos.length} {turnos.length === 1 ? "turno" : "turnos"}
      </div>

      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) {
            setEditandoId(null);
            setEligiendoTipo(false);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar turno" : "Crear turno"}</DialogTitle>
          </DialogHeader>

          {eligiendoTipo && !editandoId ? (
            <TipoJornadaChooser onElegir={elegirTipo} />
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
            {!editandoId && (
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
              <select
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
              </select>
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
                  <Input
                    type="date"
                    value={draft.vigenteDesde}
                    onChange={(e) => setDraft((d) => ({ ...d, vigenteDesde: e.target.value }))}
                    className="w-40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">Fecha de fin</label>
                  <Input
                    type="date"
                    value={draft.vigenteHasta}
                    min={draft.vigenteDesde || undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, vigenteHasta: e.target.value }))}
                    className="w-40"
                  />
                </div>
                <span className="pb-2 text-[11px] text-muted-foreground">Vacío = sin fecha de fin.</span>
              </div>
            </div>
            )}

            {/* Días laborables: SOLO en flexible (define para qué días hay horas
                objetivo). En fijo no existe el día: lo pone el patrón. */}
            {esFlexible && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Días laborables</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-6">
                {DIAS_SEMANA.map((dia) => {
                  const activo = draft.dias.includes(dia);
                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => toggleDia(dia)}
                      title={DIA_SEMANA_LABEL[dia]}
                      className={cn(
                        "h-9 w-9 rounded-full text-sm font-medium transition-colors",
                        activo
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70",
                      )}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {!esFlexible && (
              <p className="flex items-start gap-1.5 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Este turno no tiene día propio: el día se decide en el patrón
                (colocas el turno en cada día de la semana) y el patrón marca
                desde qué día empieza.
              </p>
            )}

            {esFlexible ? (
              /* Jornada flexible: horas objetivo por cada día activo. */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Horas por día</span>
                </div>
                {draft.dias.length === 0 ? (
                  <p className="pl-6 text-xs text-amber-600 dark:text-amber-500">
                    Selecciona al menos un día laborable.
                  </p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {DIAS_SEMANA.filter((d) => draft.dias.includes(d)).map((dia) => (
                      <div key={dia} className="flex items-center gap-2">
                        <span className="w-24 text-sm text-muted-foreground">
                          {DIA_SEMANA_LABEL[dia]}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          value={draft.flexHoras[dia] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraft((d) => ({
                              ...d,
                              flexHoras: {
                                ...d.flexHoras,
                                [dia]:
                                  v === ""
                                    ? 0
                                    : Math.max(0, Math.min(24, Number(v))),
                              },
                            }));
                          }}
                          placeholder="0"
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">h</span>
                      </div>
                    ))}
                  </div>
                )}
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
                    <Input
                      type="time"
                      value={tramo.inicio}
                      disabled={!!editandoId}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          tramos: d.tramos.map((tr, i) =>
                            i === idx ? { ...tr, inicio: e.target.value } : tr,
                          ),
                        }))
                      }
                      className="w-28"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="time"
                      value={tramo.fin}
                      disabled={!!editandoId}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          tramos: d.tramos.map((tr, i) =>
                            i === idx ? { ...tr, fin: e.target.value } : tr,
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
              {editandoId && turnoEditando && (
                <div className="pl-6 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    El horario está bloqueado. Para cambiarlo se crea una versión
                    nueva, conservando el histórico y aplicándola a los empleados
                    que elijas desde una fecha.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setShowModal(false);
                        setVersionandoTurno(turnoEditando);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Crear nueva versión de turno
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => setHistorialTurno(turnoEditando)}
                    >
                      <History className="h-3.5 w-3.5" />
                      Ver versiones
                    </Button>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Total en vivo: el flexible suma horas a la semana; el fijo (sin
                días) muestra la duración del turno en un día. */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {esFlexible ? "Total de horas a la semana" : "Duración del turno"}
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
                              <span className="truncate">{e.nombreCompleto}</span>
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
            <Button variant="outline" onClick={() => setShowModal(false)}>
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
                  ? draft.dias.length === 0 ||
                    !draft.dias.some((d) => (draft.flexHoras[d] ?? 0) > 0)
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

      <EmpleadosTurnoDialog
        turno={verEmpleadosTurno}
        empleados={
          verEmpleadosTurno
            ? empleadosCombinadosPorTurno.get(verEmpleadosTurno.id) ?? []
            : []
        }
        onClose={() => setVerEmpleadosTurno(null)}
      />

      <DescansosTurnoDialog
        turno={verDescansosTurno}
        descansos={
          verDescansosTurno ? descansosPorTurno.get(verDescansosTurno.id) ?? [] : []
        }
        onClose={() => setVerDescansosTurno(null)}
      />

      <AsistenteVersionTurno
        empresaId={empresaId}
        turno={versionandoTurno}
        empleados={
          versionandoTurno
            ? (empleadosCombinadosPorTurno.get(versionandoTurno.id) ?? []).map(
                (e) => ({
                  id: e.id,
                  nombre: `${e.nombre}${e.apellidos ? " " + e.apellidos : ""}`.trim(),
                }),
              )
            : []
        }
        onClose={() => setVersionandoTurno(null)}
        onDone={refrescar}
      />

      <HistorialVersionesTurno
        empresaId={empresaId}
        turno={historialTurno}
        onClose={() => setHistorialTurno(null)}
      />
    </div>
  );
}

function EmpleadosTurnoDialog({
  turno,
  empleados,
  onClose,
}: {
  turno: Turno | null;
  empleados: EmpleadoConOrigen[];
  onClose: () => void;
}) {
  return (
    <Dialog open={!!turno} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {turno && (
              <span
                className="inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide"
                style={pillStyleDepartamento(turno.colorHex)}
              >
                {turno.codigo}
              </span>
            )}
            <span>{pluralEmpleados(empleados.length)}</span>
          </DialogTitle>
        </DialogHeader>
        {empleados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Ningún empleado tiene este turno asignado.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {empleados.map((e) => (
              <li
                key={e.id}
                className="py-2 text-sm flex items-center justify-between gap-2"
              >
                <span>
                  {e.nombre}
                  {e.apellidos ? ` ${e.apellidos}` : ""}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {e.directo && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Directo
                    </span>
                  )}
                  {e.patron && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                      Patrón
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
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

function DescansosTurnoDialog({
  turno,
  descansos,
  onClose,
}: {
  turno: Turno | null;
  descansos: Descanso[];
  onClose: () => void;
}) {
  return (
    <Dialog open={!!turno} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {turno && (
              <span
                className="inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide"
                style={pillStyleDepartamento(turno.colorHex)}
              >
                {turno.codigo}
              </span>
            )}
            <span>{pluralDescansos(descansos.length)}</span>
          </DialogTitle>
        </DialogHeader>
        {descansos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay descansos asociados a este turno.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {descansos.map((d) => (
              <li key={d.id} className="py-2 text-sm flex items-center gap-2">
                <span
                  className="h-6 w-6 rounded-md flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${d.color}33` }}
                >
                  {d.icono}
                </span>
                <span className="font-medium">{d.nombre}</span>
              </li>
            ))}
          </ul>
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

// Paso 1 de la creación: elegir entre jornada fija o flexible.
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

