"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TURNO_TONOS,
  formatTurnoHorario,
  type Cuadrante,
  type Descanso,
  type Turno,
  type TurnoTono,
  type TurnoTramo,
} from "@/features/rrhh/data/horarios";
import {
  listTurnos,
  listCuadrantes,
  createTurno,
  updateTurno,
  deleteTurno,
} from "@/features/rrhh/actions/turnos-actions";
import { listDescansos } from "@/features/rrhh/actions/descansos-actions";
import {
  getEmpleadosPorTurno,
  type EmpleadoBasico,
} from "@/features/rrhh/actions/patrones-actions";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
  Activity,
  X,
  MoreVertical,
  Archive,
  AlertTriangle,
  Loader2,
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
  esGuardia: boolean;
  cuadranteId?: string;
}

function turnoToDraft(t: Turno | null): TurnoDraft {
  if (!t) {
    return {
      nombre: "",
      codigo: "",
      tramos: [{ inicio: "09:00", fin: "17:00" }],
      color: "emerald",
      esGuardia: false,
      cuadranteId: undefined,
    };
  }
  return {
    nombre: t.nombre,
    codigo: t.codigo,
    tramos: t.tramos.map((tr) => ({ ...tr })),
    color: t.color,
    esGuardia: t.esGuardia,
    cuadranteId: t.cuadranteId,
  };
}

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
  const [cuadrantes, setCuadrantes] = useState<Cuadrante[]>([]);
  const [descansos, setDescansos] = useState<Descanso[]>([]);
  const [empleadosPorTurno, setEmpleadosPorTurno] = useState<
    Record<string, EmpleadoBasico[]>
  >({});
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
    const [tr, cr, dr, ep] = await Promise.all([
      listTurnos(empresaId),
      listCuadrantes(empresaId),
      listDescansos(empresaId),
      getEmpleadosPorTurno(empresaId),
    ]);
    if (tr.ok) setTurnos(tr.data);
    if (cr.ok) setCuadrantes(cr.data);
    if (dr.ok) setDescansos(dr.data);
    if (ep.ok) setEmpleadosPorTurno(ep.data);
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

  const filtrados = turnos.filter(
    (t) =>
      !busqueda ||
      t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.codigo.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const abrirNuevo = () => {
    setEditandoId(null);
    setDraft(turnoToDraft(null));
    setShowModal(true);
  };

  const abrirEditar = (t: Turno) => {
    setEditandoId(t.id);
    setDraft(turnoToDraft(t));
    setShowModal(true);
  };

  const duplicar = async (t: Turno) => {
    setGuardando(true);
    await createTurno(empresaId, {
      nombre: `${t.nombre} (copia)`,
      codigo: t.codigo,
      tramos: t.tramos.map((tr) => ({ ...tr })),
      color: t.color,
      esGuardia: t.esGuardia,
      cuadranteId: t.cuadranteId,
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
    if (!nombre || !codigo) return;
    const tramos = draft.tramos.filter((tr) => tr.inicio && tr.fin);
    if (tramos.length === 0) return;

    setGuardando(true);
    if (editandoId) {
      await updateTurno(editandoId, {
        nombre,
        codigo,
        tramos,
        color: draft.color,
        esGuardia: draft.esGuardia,
        cuadranteId: draft.cuadranteId,
      });
    } else {
      await createTurno(empresaId, {
        nombre,
        codigo,
        tramos,
        color: draft.color,
        esGuardia: draft.esGuardia,
        cuadranteId: draft.cuadranteId,
      });
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
          Añadir turno
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_140px_140px_56px] items-center px-4 py-2.5 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Nombre</div>
          <div>Horario</div>
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
              const empleadosDelTurno = empleadosPorTurno[t.id] ?? [];
              return (
                <div
                  key={t.id}
                  className="group grid grid-cols-[1fr_1fr_140px_140px_56px] items-center px-4 py-3 hover:bg-muted/40 transition-colors"
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

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={draft.esGuardia}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, esGuardia: v === true }))
                }
              />
              <span>Establecer turno como guardia</span>
            </label>

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

            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Actividades</span>
              <button
                type="button"
                className="ml-auto text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cuadrante al que pertenece</label>
              <select
                value={draft.cuadranteId ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    cuadranteId: e.target.value || undefined,
                  }))
                }
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sin cuadrante asignado</option>
                {cuadrantes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmpleadosTurnoDialog
        turno={verEmpleadosTurno}
        empleados={
          verEmpleadosTurno ? empleadosPorTurno[verEmpleadosTurno.id] ?? [] : []
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
  empleados: EmpleadoBasico[];
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
            Ningún empleado tiene este turno asignado vía patrón.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {empleados.map((e) => (
              <li key={e.id} className="py-2 text-sm">
                {e.nombre}
                {e.apellidos ? ` ${e.apellidos}` : ""}
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
