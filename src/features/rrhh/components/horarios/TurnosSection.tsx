"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  pillStyleDepartamento,
  formatTurnoHorario,
  type Descanso,
  type Turno,
} from "@/features/rrhh/data/horarios";
import {
  listTurnos,
  createTurno,
  deleteTurno,
  getEmpleadosDirectosPorTurno,
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
  type EmpleadoActivo,
} from "@/features/rrhh/actions/empleados-actions";
import {
  TurnoFormDialog,
  flexHorasDiaDeTurno,
  pluralEmpleados,
} from "@/features/rrhh/components/horarios/TurnoFormDialog";
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
  Clock,
  MoreVertical,
  Archive,
  Loader2,
  Building2,
  CalendarClock,
  Timer,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

type EmpleadoConOrigen = EmpleadoBasico & {
  directo: boolean;
  patron: boolean;
  puesto?: string | null;
};

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
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(cargando || guardando);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [verEmpleadosTurno, setVerEmpleadosTurno] = useState<Turno | null>(null);
  const [verDescansosTurno, setVerDescansosTurno] = useState<Turno | null>(null);
  const [versionandoTurno, setVersionandoTurno] = useState<Turno | null>(null);
  const [historialTurno, setHistorialTurno] = useState<Turno | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    const [tr, dr, ep, ed, ea] = await Promise.all([
      listTurnos(empresaId),
      listDescansos(empresaId),
      getEmpleadosPorTurno(empresaId),
      getEmpleadosDirectosPorTurno(empresaId),
      getEmpleadosActivos(empresaId),
    ]);
    if (tr.ok) setTurnos(tr.data);
    if (dr.ok) setDescansos(dr.data);
    if (ep.ok) setEmpleadosPorTurno(ep.data);
    if (ed.ok) setEmpleadosDirectosPorTurno(ed.data);
    if (ea.ok) setEmpleadosActivos(ea.data);
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
        Array.from(porId.values())
          // Puesto real desde la fuente única (cruzando por id de empleado).
          .map((e) => ({
            ...e,
            puesto: empleadosActivos.find((a) => a.empleadoId === e.id)?.puesto ?? null,
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      );
    }
    return map;
  }, [empleadosDirectosPorTurno, empleadosPorTurno, empleadosActivos]);

  const filtrados = turnos.filter(
    (t) =>
      !busqueda ||
      t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.codigo.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const abrirNuevo = () => {
    setEditandoId(null);
    setShowModal(true);
  };

  const abrirEditar = (t: Turno) => {
    setEditandoId(t.id);
    setShowModal(true);
  };

  const duplicar = async (t: Turno) => {
    setGuardando(true);
    await createTurno(empresaId, {
      nombre: `${t.nombre} (copia)`,
      codigo: t.codigo,
      tramos: t.tramos.map((tr) => ({ ...tr })),
      activo: true,
      tipoJornada: t.tipoJornada,
      dias: [],
      flexHorasDia: t.tipoJornada === "flexible" ? flexHorasDiaDeTurno(t) : null,
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

  const turnoEditando = editandoId
    ? turnos.find((t) => t.id === editandoId) ?? null
    : null;

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

      <TurnoFormDialog
        empresaId={empresaId}
        open={showModal}
        onOpenChange={(abierto) => {
          setShowModal(abierto);
          if (!abierto) setEditandoId(null);
        }}
        turno={turnoEditando}
        empleadoIdsDirectos={
          editandoId
            ? (empleadosDirectosPorTurno[editandoId] ?? []).map((e) => e.id)
            : []
        }
        onGuardado={() => refrescar()}
        onCrearVersion={(t) => setVersionandoTurno(t)}
        onVerVersiones={(t) => setHistorialTurno(t)}
      />

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
                  // Puesto real desde la fuente única (cruzando por id de empleado).
                  puesto: empleadosActivos.find((a) => a.empleadoId === e.id)?.puesto ?? null,
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
                <span className="min-w-0">
                  <span className="block truncate">
                    {e.nombre}
                    {e.apellidos ? ` ${e.apellidos}` : ""}
                  </span>
                  {e.puesto && (
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {e.puesto}
                    </span>
                  )}
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
