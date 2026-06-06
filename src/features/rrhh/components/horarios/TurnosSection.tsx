"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TURNO_TONOS,
  formatTurnoHorario,
  type Descanso,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
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
  AlertTriangle,
  Loader2,
  Users,
  Check,
  Building2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

const TONO_KEYS: TurnoTono[] = [
  "stone",
  "emerald",
  "violet",
  "rose",
  "teal",
  "sky",
  "amber",
];

interface TurnoDraft {
  nombre: string;
  codigo: string;
  tramos: TurnoTramo[];
  color: TurnoTono;
  departamento: string;
  empleadoIds: string[];
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
    };
  }
  return {
    nombre: t.nombre,
    codigo: t.codigo,
    tramos: t.tramos.map((tr) => ({ ...tr })),
    color: t.color,
    departamento: t.departamento ?? "",
    empleadoIds,
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
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(cargando || guardando);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TurnoDraft>(() => turnoToDraft(null));
  const [verEmpleadosTurno, setVerEmpleadosTurno] = useState<Turno | null>(null);
  const [verDescansosTurno, setVerDescansosTurno] = useState<Turno | null>(null);

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
    setDraft(turnoToDraft(null));
    setShowModal(true);
  };

  const abrirEditar = (t: Turno) => {
    setEditandoId(t.id);
    setEmpBusqueda("");
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
    });
    await refrescar();
    setGuardando(false);
  };

  const eliminar = async (id: string) => {
    setGuardando(true);
    await deleteTurno(id);
    await refrescar();
    setGuardando(false);
  };

  const guardar = async () => {
    const nombre = draft.nombre.trim();
    const codigo = draft.codigo.trim().toUpperCase();
    const departamento = draft.departamento.trim();
    if (!nombre || !codigo || !departamento) return;
    const tramos = draft.tramos.filter((tr) => tr.inicio && tr.fin);
    if (tramos.length === 0) return;

    // Solo se persisten empleados que sigan perteneciendo al departamento del
    // turno (el vínculo manda; si alguien cambió de departamento, se descarta).
    const idsDelDepto = new Set(
      empleadosActivos
        .filter((e) => e.departamento === departamento)
        .map((e) => e.empleadoId),
    );
    const empleadoIds = draft.empleadoIds.filter((id) => idsDelDepto.has(id));

    setGuardando(true);
    let turnoId = editandoId;
    if (editandoId) {
      await updateTurno(editandoId, {
        nombre,
        codigo,
        tramos,
        color: draft.color,
        departamento,
      });
    } else {
      const res = await createTurno(empresaId, {
        nombre,
        codigo,
        tramos,
        color: draft.color,
        departamento,
      });
      turnoId = res.ok ? res.id ?? null : null;
    }
    if (turnoId) {
      await setEmpleadosDirectosTurno(empresaId, turnoId, empleadoIds);
    }
    await refrescar();
    setGuardando(false);
    setShowModal(false);
    setEditandoId(null);
  };

  const turnoEditando = editandoId
    ? turnos.find((t) => t.id === editandoId) ?? null
    : null;

  return (
    <div className="space-y-4">
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
              const tono = TURNO_TONOS[t.color];
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
                      className={cn(
                        "inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide",
                        tono.pill,
                      )}
                    >
                      {t.codigo}
                    </span>
                    <span className="text-sm font-medium truncate">{t.nombre}</span>
                  </div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {formatTurnoHorario(t)}
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
          if (!open) setEditandoId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar turno" : "Crear turno"}</DialogTitle>
          </DialogHeader>

          {turnoEditando && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Modificar el horario generará solapamientos y afectará al tiempo
                teórico, las estadísticas y el saldo de los empleados.
              </p>
            </div>
          )}

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
              <ColorPicker
                value={draft.color}
                onChange={(c) => setDraft((d) => ({ ...d, color: c }))}
              />
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

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Tramos horarios</span>
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
                  Añadir
                </button>
              </div>
              <div className="space-y-2 pl-6">
                {draft.tramos.map((tramo, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={tramo.inicio}
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
                    {draft.tramos.length > 1 && (
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
                !draft.departamento.trim()
              }
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
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
  const tono = turno ? TURNO_TONOS[turno.color] : null;
  return (
    <Dialog open={!!turno} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {turno && tono && (
              <span
                className={cn(
                  "inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide",
                  tono.pill,
                )}
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
  const tono = turno ? TURNO_TONOS[turno.color] : null;
  return (
    <Dialog open={!!turno} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {turno && tono && (
              <span
                className={cn(
                  "inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide",
                  tono.pill,
                )}
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

function ColorPicker({
  value,
  onChange,
}: {
  value: TurnoTono;
  onChange: (c: TurnoTono) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-7 w-12 rounded-md border transition-shadow hover:shadow-sm",
            TURNO_TONOS[value].pill,
          )}
          aria-label="Seleccionar color"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2">
        <div className="flex gap-1.5">
          {TONO_KEYS.map((tono) => (
            <button
              key={tono}
              type="button"
              onClick={() => {
                onChange(tono);
                setOpen(false);
              }}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                TURNO_TONOS[tono].dot,
                value === tono ? "border-foreground" : "border-transparent",
              )}
              title={TURNO_TONOS[tono].label}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
