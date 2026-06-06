"use client";

import { ReactNode, useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  CheckSquare2, Square, Plus, Trash2, ChevronLeft, ChevronRight, Link2, Sparkles,
  CalendarClock, Info, AlertTriangle, Users, RefreshCw, Clock, Lock,
  ClipboardCheck, CalendarX, Briefcase,
} from "lucide-react";
import { PosponerTareaDialog } from "./PosponerTareaDialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  format, isToday, isSameDay, parseISO, addDays, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  listTareasMias, crearTareaManual,
  toggleTareaHecha as toggleTareaHechaAction,
  deleteTarea as deleteTareaAction,
  syncTareasCronograma,
  syncTareasCronogramaRange,
  getRolesCronograma,
  getDepartamentosVisibles,
  listCronogramasPorRol,
  type TareaRow,
} from "@/features/tareas/actions/tareas-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getModuloForCronograma } from "@/features/direccion/data/cronogramaAreas";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  getTareasValidacionPendientes,
  type TareasValidacion,
} from "@/features/mi-panel/actions/mi-panel-actions";

type InfoTarea = { id: string; tarea?: string; resumen?: string };

// Tipo legacy mantenido por compatibilidad con otras importaciones.
export interface Tarea {
  id: string;
  titulo: string;
  fecha: string;
  hecha: boolean;
  prioridad: "alta" | "media" | "baja";
}

const PRIO_COLORS: Record<Tarea["prioridad"], string> = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-amber-100 text-amber-700 border-amber-200",
  baja: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const PRIO_LABEL: Record<Tarea["prioridad"], string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

function TareaItem({
  t,
  compact = false,
  toggleHecha,
  deleteTarea,
  posponerTarea,
  setOpen,
}: {
  t: TareaRow;
  compact?: boolean;
  toggleHecha: (id: string) => void;
  deleteTarea: (id: string) => void;
  posponerTarea: (t: TareaRow) => void;
  setOpen: (open: boolean) => void;
}) {
  const esReceta = t.tipo === "nueva_receta_fase";
  const esCronograma = t.tipo === "sistema";
  const esEncargo =
    !esCronograma && t.created_by != null && t.user_id != null && t.created_by !== t.user_id;
  const icon = esReceta ? <Sparkles className="h-3 w-3 text-violet-600" /> : null;
  const horaCorta = t.hora_inicio ? t.hora_inicio.slice(0, 5) : null;
  const pospuestaCount = t.pospuesta_count ?? 0;

  const contenido = (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleHecha(t.id);
        }}
        className="shrink-0"
      >
        {t.hecha ? (
          <CheckSquare2 className={compact ? "h-4 w-4 text-violet-600" : "h-5 w-5 text-violet-600"} />
        ) : (
          <Square className={compact ? "h-4 w-4 text-muted-foreground" : "h-5 w-5 text-muted-foreground"} />
        )}
      </button>
      <span
        className={`flex-1 ${compact ? "text-xs" : "text-sm"} ${
          t.hecha ? "line-through opacity-50" : ""
        }`}
      >
        {icon && <span className="inline-flex items-center mr-1">{icon}</span>}
        {horaCorta && (
          <span className="inline-flex items-center gap-0.5 mr-1.5 text-[10px] font-bold text-violet-700">
            <Clock className="h-2.5 w-2.5" />
            {horaCorta}
          </span>
        )}
        {t.titulo}
        {t.link_url && <Link2 className="h-3 w-3 inline ml-1 text-muted-foreground" />}
        {pospuestaCount > 0 && (
          <span
            className={`ml-1.5 text-[9px] font-bold px-1 py-px rounded ${
              pospuestaCount >= 3
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}
            title={`Pospuesta ${pospuestaCount}× — última: ${t.pospuesta_ultima ?? ""}`}
          >
            {pospuestaCount}×
          </span>
        )}
      </span>
      <span
        className={`${
          compact ? "text-[9px]" : "text-[10px]"
        } border rounded px-1.5 py-0.5 font-semibold shrink-0 ${PRIO_COLORS[t.prioridad]}`}
      >
        {compact ? t.prioridad.charAt(0).toUpperCase() : PRIO_LABEL[t.prioridad]}
      </span>
      {esCronograma ? (
        <Button
          variant="ghost"
          size="icon"
          className={`${compact ? "h-5 w-5" : "h-6 w-6"} shrink-0 hover:text-violet-600`}
          onClick={(e) => {
            e.stopPropagation();
            posponerTarea(t);
          }}
          title="Posponer"
        >
          <CalendarClock className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </Button>
      ) : esEncargo ? (
        <span
          className={`${compact ? "h-5 w-5" : "h-6 w-6"} shrink-0 inline-flex items-center justify-center text-muted-foreground/70`}
          title="Asignada por otro usuario · no se puede eliminar"
        >
          <Lock className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className={`${compact ? "h-5 w-5" : "h-6 w-6"} shrink-0 hover:text-red-500`}
          onClick={(e) => {
            e.stopPropagation();
            deleteTarea(t.id);
          }}
          title="Eliminar"
        >
          <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </Button>
      )}
    </>
  );

  if (t.link_url) {
    return (
      <Link
        href={t.link_url}
        onClick={() => setOpen(false)}
        className={`${compact ? "py-2" : "py-3"} px-5 flex items-center gap-3 hover:bg-muted/30 transition-colors ${
          t.hecha ? "opacity-50" : ""
        }`}
      >
        {contenido}
      </Link>
    );
  }
  return (
    <div
      className={`${
        compact ? "py-2" : "py-3"
      } px-5 flex items-center gap-3 hover:bg-muted/20 transition-colors ${
        t.hecha ? "opacity-50" : ""
      }`}
    >
      {contenido}
    </div>
  );
}

export function TareasDrawer({ children }: { children: ReactNode }) {
  const [tareas, setTareas] = useState<TareaRow[]>([]);
  const [tab, setTab] = useState<"hoy" | "semana" | "mes">("hoy");
  const [newTitulo, setNewTitulo] = useState("");
  const [newPrio, setNewPrio] = useState<Tarea["prioridad"]>("media");
  const [refDate, setRefDate] = useState(new Date());
  
  // Memorizar inicios y fines para evitar errores de referencia y optimizar
  const { weekStart, weekEnd, monthStart, monthEnd } = useMemo(() => {
    const ws = startOfWeek(refDate, { weekStartsOn: 1 });
    const we = endOfWeek(refDate, { weekStartsOn: 1 });
    const ms = startOfMonth(refDate);
    const me = endOfMonth(refDate);
    return { weekStart: ws, weekEnd: we, monthStart: ms, monthEnd: me };
  }, [refDate]);

  const weekDays = useMemo(() => {
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [weekStart, weekEnd]);

  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [monthStart, monthEnd]);

  const [isSyncing, setIsSyncing] = useState(false);
  useGlobalLoadingSync(isSyncing);
  const [open, setOpen] = useState(false);
  const [tareaPosponer, setTareaPosponer] = useState<TareaRow | null>(null);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [moduloPropio, setModuloPropio] = useState<string | null>(null);
  const [modulosVisibles, setModulosVisibles] = useState<string[] | null>(null);
  const [selectedRol, setSelectedRol] = useState<string>("default");
  const [infoTareas, setInfoTareas] = useState<InfoTarea[]>([]);
  const [validacion, setValidacion] = useState<TareasValidacion>({ activo: false, ausencia: 0, trabajo: 0 });

  const cargar = useCallback(async () => {
    const res = await listTareasMias();
    if (res.ok) setTareas(res.data);
  }, []);

  // 1. Efecto para Cargar Roles + permisos del usuario (al abrir)
  useEffect(() => {
    if (!open) return;
    Promise.all([getRolesCronograma(), getDepartamentosVisibles()]).then(
      ([resRoles, resDept]) => {
        if (resRoles.ok) setAvailableRoles(resRoles.data);
        else toast.error("Error al cargar roles: " + resRoles.error);
        if (resDept.ok) {
          setModuloPropio(resDept.data.moduloPropio);
          setModulosVisibles(resDept.data.modulosVisibles);
        }
      },
    );
  }, [open]);

  // 2. Escuchar evento para abrir desde fuera
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ rol?: string; tab?: "hoy" | "semana" | "mes" }>).detail;
      const { rol, tab: targetTab } = detail || {};
      if (rol) setSelectedRol(rol);
      if (targetTab) setTab(targetTab);
      setOpen(true);
    };
    window.addEventListener("open-tasks-drawer", handleOpen);
    return () => window.removeEventListener("open-tasks-drawer", handleOpen);
  }, []);

  // 2. Efecto para Sincronizar Cronograma
  const lastSyncedKey = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    
    const rangeKey = tab === "hoy" 
      ? `hoy-${format(refDate, "yyyy-MM-dd")}-${selectedRol}`
      : tab === "semana"
        ? `semana-${format(weekStart, "yyyy-MM-dd")}-${selectedRol}`
        : `mes-${format(monthStart, "yyyy-MM-dd")}-${selectedRol}`;

    if (lastSyncedKey.current === rangeKey) {
      cargar();
      return;
    }

    const sync = async () => {
      setIsSyncing(true);
      try {
        const forced = selectedRol === "default" ? undefined : selectedRol;
        if (tab === "hoy") {
          const res = await syncTareasCronograma(undefined, forced);
          if (res.ok) {
            if (!forced && res.data.rol) setRolUsuario(res.data.rol);
            if (res.data.insertadas > 0 && res.data.rol) {
              toast.success(`Sincronizadas ${res.data.insertadas} tareas para ${getModuloForCronograma(res.data.rol)}`);
            }
          } else {
            toast.error("Error de sincronización: " + res.error);
          }
        } else if (tab === "semana" || tab === "mes") {
          const dates = (tab === "semana" ? weekDays : monthDays).map((d) => format(d, "yyyy-MM-dd"));
          const res = await syncTareasCronogramaRange(dates, forced);
          if (!res.ok) {
            toast.error("Error de sincronización: " + res.error);
          }
        }

        lastSyncedKey.current = rangeKey;
        await cargar();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error("Error inesperado: " + message);
      } finally {
        setIsSyncing(false);
      }
    };
    sync().catch(e => {
      console.error(e);
      setIsSyncing(false);
    });
  }, [open, tab, refDate, selectedRol, cargar, weekStart, monthStart, weekDays, monthDays]);

  // 3. Efecto para Cargar Datos de la UI
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadData = async () => {
      const forced = selectedRol === "default" ? undefined : selectedRol;
      const rolParaInfo = forced || rolUsuario;

      if (rolParaInfo) {
        const resInfo = await listCronogramasPorRol(rolParaInfo);
        if (!cancelled && resInfo.ok) setInfoTareas(resInfo.data as unknown as InfoTarea[]);
      } else {
        if (!cancelled) setInfoTareas([]);
      }

      // Validaciones pendientes (si soy validador de alguien y hay pendientes).
      const resVal = await getTareasValidacionPendientes();
      if (!cancelled && resVal.ok) setValidacion(resVal.data);

      if (!cancelled) await cargar();
    };

    loadData();
    return () => { cancelled = true; };
  }, [open, cargar, selectedRol, rolUsuario, tab, refDate]);

  const addTarea = async () => {
    const titulo = newTitulo.trim();
    if (!titulo) return;
    const fecha = format(tab === "hoy" ? new Date() : refDate, "yyyy-MM-dd");
    const res = await crearTareaManual({ titulo, fecha, prioridad: newPrio });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNewTitulo("");
    await cargar();
  };

  const toggleHecha = async (id: string) => {
    const res = await toggleTareaHechaAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await cargar();
  };

  const deleteTarea = async (id: string) => {
    const res = await deleteTareaAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await cargar();
  };

  const filterBySelectedRol = (list: TareaRow[]) => {
    if (selectedRol === "default") return list;
    const target = selectedRol.toUpperCase();
    return list.filter(t => 
      t.tipo === "sistema" && 
      t.ref_tabla?.toUpperCase() === `CRONOGRAMAS_OPERATIVOS:${target}`
    );
  };

  const tareasForDay = (day: Date) => filterBySelectedRol(tareas.filter((t) => isSameDay(parseISO(t.fecha), day)));

  const tareasHoy = filterBySelectedRol(tareas.filter((t) => isToday(parseISO(t.fecha))));
  const pendientesHoy = tareasHoy.filter((t) => !t.hecha).length;

  const handlePosponer = (t: TareaRow) => setTareaPosponer(t);

  const itemProps = { toggleHecha, deleteTarea, posponerTarea: handlePosponer, setOpen };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="p-0 flex flex-col gap-0 border-l-violet-100 shadow-2xl">
        <SheetHeader className="border-b px-5 py-3 shrink-0 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="flex items-center gap-2 text-base font-black tracking-tight text-violet-950">
                <CheckSquare2 className="h-4 w-4 text-violet-600" />
                MIS TAREAS
              </SheetTitle>
            </div>
            {pendientesHoy > 0 && (
              <Badge className="bg-violet-600 text-white text-[10px] font-bold h-5 px-2 rounded-full mr-10">
                {pendientesHoy} HOY
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Filtro de Rol / Supervisor */}
        <div className="px-5 py-3 bg-violet-50/50 border-b flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-violet-400 tracking-wider uppercase">
              Filtrar por puesto
            </span>
          </div>
          <Select value={selectedRol} onValueChange={setSelectedRol}>
            <SelectTrigger className={`h-9 text-xs font-bold uppercase border-violet-200 bg-white shadow-sm transition-all ${selectedRol !== "default" ? "ring-2 ring-violet-500/20 border-violet-500" : ""}`}>
              <SelectValue placeholder="Elije un puesto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default" className="text-xs font-bold uppercase text-violet-700">
                {rolUsuario ?? "Cargando…"}
              </SelectItem>
              {(() => {
                const visibles = modulosVisibles ?? [];
                const items = availableRoles.filter((r) =>
                  visibles.length === 0 ? true : visibles.includes(getModuloForCronograma(r)),
                );
                if (availableRoles.length === 0) {
                  return (
                    <SelectItem value="_loading" disabled className="text-xs italic text-muted-foreground">
                      Cargando puestos...
                    </SelectItem>
                  );
                }
                if (items.length === 0) {
                  return (
                    <SelectItem value="_empty" disabled className="text-xs italic text-muted-foreground">
                      Sin puestos accesibles
                    </SelectItem>
                  );
                }
                return items.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs font-medium uppercase">
                    {r}
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-muted/20 shrink-0">
          {(["hoy", "semana", "mes"] as const).map((t) => {
            const count =
              t === "hoy"
                ? pendientesHoy
                : t === "semana"
                  ? weekDays.reduce((s, d) => s + tareasForDay(d).filter((x) => !x.hecha).length, 0)
                  : monthDays.reduce((s, d) => s + tareasForDay(d).filter((x) => !x.hecha).length, 0);
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? "border-b-2 border-violet-600 text-violet-700 bg-violet-50/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "hoy" ? "Hoy" : t === "semana" ? "Semana" : "Mes"}
                {count > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-violet-600 text-white text-[9px] font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        

        <div className="flex-1 overflow-y-auto flex flex-col">
          {tab === "hoy" && (
            <>
              <div className="px-5 py-3 border-b bg-muted/10 flex gap-2 shrink-0">
                <Input
                  value={newTitulo}
                  onChange={(e) => setNewTitulo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && addTarea()}
                  placeholder="Añadir tarea de hoy…"
                  className="h-8 text-sm flex-1"
                />
                <select
                  value={newPrio}
                  onChange={(e) => setNewPrio(e.target.value as Tarea["prioridad"])}
                  className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 bg-violet-600 hover:bg-violet-700"
                  onClick={addTarea}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {validacion.activo && (validacion.ausencia > 0 || validacion.trabajo > 0) && (
                <div className="shrink-0">
                  <div className="px-5 py-2 bg-amber-100/70 border-b border-amber-200 flex items-center gap-2">
                    <ClipboardCheck className="h-3.5 w-3.5 text-amber-700" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                      Validaciones pendientes
                    </span>
                  </div>
                  <div className="divide-y divide-amber-100 bg-amber-50/40">
                    {validacion.ausencia > 0 && (
                      <Link
                        href="/rrhh/solicitudes"
                        onClick={() => setOpen(false)}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-amber-100/50 transition-colors"
                      >
                        <span className="h-7 w-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <CalendarX className="h-4 w-4" />
                        </span>
                        <p className="flex-1 text-sm font-medium text-amber-900">
                          Tienes solicitudes de ausencia pendientes
                        </p>
                        <ChevronRight className="h-4 w-4 text-amber-600 shrink-0" />
                      </Link>
                    )}
                    {validacion.trabajo > 0 && (
                      <Link
                        href="/rrhh/solicitudes"
                        onClick={() => setOpen(false)}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-amber-100/50 transition-colors"
                      >
                        <span className="h-7 w-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <p className="flex-1 text-sm font-medium text-amber-900">
                          Tienes solicitudes de trabajo pendientes
                        </p>
                        <ChevronRight className="h-4 w-4 text-amber-600 shrink-0" />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {isSyncing ? (
                <div className="flex flex-col items-center justify-center flex-1 py-10 gap-2 text-violet-600">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-tight">Sincronizando tareas...</span>
                </div>
              ) : tareasHoy.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
                  <CheckSquare2 className="h-10 w-10 opacity-20 mb-3" />
                  <p className="text-sm">Sin tareas para hoy</p>
                  <p className="text-xs mt-1 opacity-70">Añade una tarea o espera asignaciones de otros</p>
                </div>
              ) : (
                (() => {
                  const rutinarias = tareasHoy.filter((t) => t.tipo === "sistema");
                  const encargos = tareasHoy.filter(
                    (t) =>
                      t.tipo !== "sistema" &&
                      t.created_by != null &&
                      t.user_id != null &&
                      t.created_by !== t.user_id,
                  );
                  const personales = tareasHoy.filter(
                    (t) =>
                      t.tipo !== "sistema" &&
                      (t.created_by == null || t.user_id == null || t.created_by === t.user_id),
                  );
                  return (
                    <div className="flex-1">
                      {rutinarias.length > 0 && (
                        <>
                          <div className="px-5 py-2 bg-violet-50/70 border-b border-violet-100 flex items-center gap-2">
                            <CalendarClock className="h-3.5 w-3.5 text-violet-700" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-800">
                              Rutinarias · del cronograma
                            </span>
                            <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                              {rutinarias.filter((t) => !t.hecha).length} pendientes
                            </Badge>
                          </div>
                          <div className="divide-y bg-violet-50/20">
                            {rutinarias.map((t) => <TareaItem key={t.id} t={t} {...itemProps} />)}
                          </div>
                        </>
                      )}

                      <SeccionInformativa infoTareas={infoTareas} selectedRol={selectedRol} />

                      {encargos.length > 0 && (
                        <>
                          <div className="px-5 py-2 bg-sky-50/70 border-b border-sky-100 flex items-center gap-2 mt-4">
                            <Lock className="h-3.5 w-3.5 text-sky-700" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
                              Encargos · pedidos por otros
                            </span>
                            <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                              {encargos.filter((t) => !t.hecha).length} pendientes
                            </Badge>
                          </div>
                          <div className="divide-y bg-sky-50/20">
                            {encargos.map((t) => <TareaItem key={t.id} t={t} {...itemProps} />)}
                          </div>
                        </>
                      )}

                      {personales.length > 0 && (
                        <>
                          <div className="px-5 py-2 bg-muted/30 border-b mt-4 flex items-center gap-2">
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Personales · añadidas por ti
                            </span>
                            <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                              {personales.filter((t) => !t.hecha).length} pendientes
                            </Badge>
                          </div>
                          <div className="divide-y">
                            {personales.map((t) => <TareaItem key={t.id} t={t} {...itemProps} />)}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()
              )}
            </>
          )}

          {tab === "semana" && (
            <>
              <div className="flex items-center justify-between px-5 py-2.5 border-b bg-muted/10 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefDate((d) => addDays(d, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-semibold text-muted-foreground">
                  {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefDate((d) => addDays(d, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-5 py-3 border-b bg-muted/10 flex gap-2 shrink-0">
                <Input
                  value={newTitulo}
                  onChange={(e) => setNewTitulo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && addTarea()}
                  placeholder={`Tarea para ${format(refDate, "EEEE d", { locale: es })}…`}
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" className="h-8 w-8 p-0 bg-violet-600 hover:bg-violet-700" onClick={addTarea}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="divide-y flex-1 overflow-y-auto">
                {isSyncing ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-violet-600">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-tight">Sincronizando tareas...</span>
                  </div>
                ) : (
                  <>
                    {weekDays.map((day) => {
                      const dayTareas = tareasForDay(day);
                      const pendientes = dayTareas.filter((t) => !t.hecha).length;
                      const isSelected = isSameDay(day, refDate);
                      return (
                        <div
                          key={day.toISOString()}
                          className={`px-5 py-3 cursor-pointer transition-colors ${
                            isToday(day) ? "bg-violet-50/60" : isSelected ? "bg-muted/30" : "hover:bg-muted/20"
                          }`}
                          onClick={() => setRefDate(day)}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-semibold capitalize ${isToday(day) ? "text-violet-700" : "text-muted-foreground"}`}>
                              {format(day, "EEEE d", { locale: es })}
                              {isToday(day) && (
                                <span className="ml-1.5 text-[9px] bg-violet-600 text-white px-1 rounded-full">HOY</span>
                              )}
                            </span>
                            {pendientes > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pendientes} pendientes</Badge>
                            )}
                          </div>
                          {dayTareas.length === 0 ? (
                            <p className="text-xs text-muted-foreground/40 italic">Sin tareas</p>
                          ) : (
                            <div className="space-y-0.5 -mx-5">
                              {dayTareas.map((t) => <TareaItem key={t.id} t={t} compact {...itemProps} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <SeccionInformativa infoTareas={infoTareas} selectedRol={selectedRol} />
                  </>
                )}
              </div>
            </>
          )}

          {tab === "mes" && (
            <>
              <div className="flex items-center justify-between px-5 py-2.5 border-b bg-muted/10 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefDate((d) => addMonths(d, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-semibold text-muted-foreground capitalize">
                  {format(refDate, "MMMM yyyy", { locale: es })}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefDate((d) => addMonths(d, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="grid grid-cols-7 mb-1">
                  {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {(() => {
                  const firstDow = (monthStart.getDay() + 6) % 7;
                  const cells: (Date | null)[] = [
                    ...Array<null>(firstDow).fill(null),
                    ...monthDays,
                  ];
                  return (
                    <div className="grid grid-cols-7 gap-0.5">
                      {cells.map((day, i) => {
                        if (!day) return <div key={`blank-${i}`} />;
                        const dayTareas = tareasForDay(day);
                        const done = dayTareas.filter((t) => t.hecha).length;
                        const total = dayTareas.length;
                        const isSelected = isSameDay(day, refDate);
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => { setRefDate(day); }}
                            className={`rounded-lg p-1 text-center transition-colors hover:bg-muted/40 ${
                              isToday(day) ? "bg-violet-100 ring-1 ring-violet-400" : isSelected ? "bg-muted/40" : ""
                            }`}
                          >
                            <span className={`text-xs font-medium block ${isToday(day) ? "text-violet-700" : ""}`}>
                              {format(day, "d")}
                            </span>
                            {total > 0 && (
                              <span className={`mt-0.5 inline-block text-[9px] font-bold px-1 rounded-full ${
                                done === total ? "bg-emerald-200 text-emerald-800" : "bg-violet-200 text-violet-800"
                              }`}>
                                {done}/{total}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="border-t flex-1 overflow-y-auto">
                <div className="px-5 py-2 bg-muted/10 border-b">
                  <p className="text-xs font-semibold text-muted-foreground capitalize">
                    {format(refDate, "EEEE d MMMM", { locale: es })}
                  </p>
                </div>
                <div className="px-5 py-3 border-b flex gap-2">
                  <Input
                    value={newTitulo}
                    onChange={(e) => setNewTitulo(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && addTarea()}
                    placeholder="Añadir tarea…"
                    className="h-8 text-sm flex-1"
                  />
                  <Button size="sm" className="h-8 w-8 p-0 bg-violet-600 hover:bg-violet-700" onClick={addTarea}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="divide-y">
                  {isSyncing ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-violet-600">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-tight">Sincronizando tareas...</span>
                    </div>
                  ) : tareasForDay(refDate).length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-muted-foreground/40 italic">
                      Sin tareas para este día
                    </p>
                  ) : (
                    tareasForDay(refDate).map((t) => <TareaItem key={t.id} t={t} {...itemProps} />)
                  )}
                </div>
                <SeccionInformativa infoTareas={infoTareas} selectedRol={selectedRol} />
              </div>
            </>
          )}
        </div>
      </SheetContent>
      <PosponerTareaDialog
        tarea={tareaPosponer}
        onClose={() => setTareaPosponer(null)}
        onDone={() => {
          lastSyncedKey.current = "";
          cargar();
        }}
      />
    </Sheet>
  );
}

function SeccionInformativa({ infoTareas, selectedRol }: { infoTareas: InfoTarea[], selectedRol: string }) {
  if (!infoTareas || infoTareas.length === 0) return null;
  return (
    <>
      <div className="px-5 py-2 bg-amber-50/70 border-b border-amber-100 flex items-center gap-2 mt-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
          Información de Apoyo / Otros
        </span>
      </div>
      <div className="bg-amber-50/20 divide-y divide-amber-100/50 pb-10">
        {infoTareas.map((it) => (
          <div key={it.id} className="px-5 py-2.5 flex items-start gap-3 group">
            <div className="mt-1">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-900 leading-snug">
                {it.tarea}
              </p>
              {it.resumen && (
                <p className="text-[10px] text-amber-700/70 mt-0.5 line-clamp-2">
                  {it.resumen}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
