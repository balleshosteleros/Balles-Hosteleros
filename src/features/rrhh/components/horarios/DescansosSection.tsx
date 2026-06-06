"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TURNO_TONOS,
  type Descanso,
  type DiaSemana,
  type Turno,
} from "@/features/rrhh/data/horarios";
import {
  listDescansos,
  createDescanso,
  updateDescanso,
  deleteDescanso,
} from "@/features/rrhh/actions/descansos-actions";
import { listTurnos } from "@/features/rrhh/actions/turnos-actions";
import {
  getEmpleadosPorTurno,
  type EmpleadoBasico,
} from "@/features/rrhh/actions/patrones-actions";
import { SelectorReplicarEmpresas } from "@/features/empresa/components/SelectorReplicarEmpresas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Coffee,
  X,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

const DIAS: DiaSemana[] = ["L", "M", "X", "J", "V", "S", "D"];

const COLORES = [
  "#FCA98E",
  "#FBBF24",
  "#34D399",
  "#60A5FA",
  "#A78BFA",
  "#F472B6",
  "#94A3B8",
];

const ICONOS = ["☕", "🍔", "🥪", "🚬", "💧", "🛋️", "📞"];

function pluralTurnos(n: number) {
  if (n === 0) return "sin turnos";
  if (n === 1) return "1 turno";
  return `${n} turnos`;
}

function pluralEmpleados(n: number) {
  if (n === 0) return "0 empleados";
  if (n === 1) return "1 empleado";
  return `${n} empleados`;
}

type DescansoDraft = Omit<Descanso, "id"> & { id?: string };

function draftVacio(): DescansoDraft {
  return {
    nombre: "",
    icono: "☕",
    color: "#FCA98E",
    remunerado: false,
    cuandoFichar: "intervalo",
    intervaloInicio: "17:00",
    intervaloFin: "19:30",
    duracionTipo: "sin_limite",
    dias: [],
    turnos: [],
    activo: true,
  };
}

export function DescansosSection({ empresaId }: { empresaId: string }) {
  const [descansos, setDescansos] = useState<Descanso[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [empleadosPorTurno, setEmpleadosPorTurno] = useState<
    Record<string, EmpleadoBasico[]>
  >({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(cargando || guardando);
  const [busqueda, setBusqueda] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editando, setEditando] = useState<DescansoDraft | null>(null);
  const [empresasReplicar, setEmpresasReplicar] = useState<string[]>([]);
  const [turnosOpenId, setTurnosOpenId] = useState<string | null>(null);
  const [verEmpleadosDescanso, setVerEmpleadosDescanso] =
    useState<Descanso | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    const [dr, tr, ep] = await Promise.all([
      listDescansos(empresaId),
      listTurnos(empresaId),
      getEmpleadosPorTurno(empresaId),
    ]);
    if (dr.ok) setDescansos(dr.data);
    if (tr.ok) setTurnos(tr.data);
    if (ep.ok) setEmpleadosPorTurno(ep.data);
    setCargando(false);
  }, [empresaId]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const empleadosPorDescanso = useMemo(() => {
    const map = new Map<string, EmpleadoBasico[]>();
    for (const d of descansos) {
      const acc = new Map<string, EmpleadoBasico>();
      for (const tId of d.turnos) {
        for (const e of empleadosPorTurno[tId] ?? []) acc.set(e.id, e);
      }
      map.set(
        d.id,
        Array.from(acc.values()).sort((a, b) =>
          a.nombre.localeCompare(b.nombre),
        ),
      );
    }
    return map;
  }, [descansos, empleadosPorTurno]);

  const filtrados = descansos.filter(
    (d) => !busqueda || d.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const abrirNuevo = () => {
    setEditando(draftVacio());
    setEmpresasReplicar([empresaId]);
    setShowEdit(true);
  };

  const abrirEditar = (d: Descanso) => {
    setEditando({ ...d });
    setEmpresasReplicar([empresaId]);
    setShowEdit(true);
  };

  const guardar = async () => {
    if (!editando) return;
    setGuardando(true);
    if (editando.id) {
      await updateDescanso(editando.id, editando);
    } else {
      const empresas =
        empresasReplicar.length > 0 ? empresasReplicar : [empresaId];
      await createDescanso(empresas, editando);
    }
    await refrescar();
    setGuardando(false);
    setShowEdit(false);
    setEditando(null);
  };

  const eliminar = async (id: string) => {
    setGuardando(true);
    await deleteDescanso(id);
    await refrescar();
    setGuardando(false);
  };

  const descansoTurnos = descansos.find((d) => d.id === turnosOpenId) ?? null;

  const setTurnosDescanso = async (turnoIds: string[]) => {
    if (!turnosOpenId) return;
    // optimista
    setDescansos((prev) =>
      prev.map((d) => (d.id === turnosOpenId ? { ...d, turnos: turnoIds } : d)),
    );
    await updateDescanso(turnosOpenId, { turnos: turnoIds });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Coffee className="h-5 w-5 text-primary" />
            Descansos
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea diferentes descansos y establece reglas para que los empleados
            puedan marcarlos durante su jornada.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={abrirNuevo} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar descanso..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Intervalo</TableHead>
              <TableHead>Días disponibles</TableHead>
              <TableHead>Turnos</TableHead>
              <TableHead>Empleados</TableHead>
              <TableHead>Remunerado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
                </TableCell>
              </TableRow>
            )}
            {!cargando &&
              filtrados.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-7 w-7 rounded-md flex items-center justify-center text-sm"
                        style={{ backgroundColor: `${d.color}33` }}
                      >
                        <span>{d.icono}</span>
                      </div>
                      <span className="font-medium text-sm">{d.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.duracionTipo === "sin_limite"
                      ? "Sin límite"
                      : `${d.duracionMinutos ?? 0} min`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.cuandoFichar === "cualquier" ? (
                      <span className="text-muted-foreground">Cualquier momento</span>
                    ) : (
                      <div className="flex flex-col leading-tight">
                        <span className="text-emerald-600">↳ {d.intervaloInicio}</span>
                        <span className="text-rose-600">↲ {d.intervaloFin}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {DIAS.map((dia) => (
                        <span
                          key={dia}
                          className={cn(
                            "h-6 w-6 rounded text-[10px] font-semibold flex items-center justify-center",
                            d.dias.includes(dia)
                              ? "bg-slate-700 text-white"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {dia}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setTurnosOpenId(d.id)}
                      className="text-sm text-primary hover:underline"
                    >
                      {pluralTurnos(d.turnos.length)}
                    </button>
                  </TableCell>
                  <TableCell>
                    {(empleadosPorDescanso.get(d.id) ?? []).length === 0 ? (
                      <span className="text-sm text-muted-foreground">0 empleados</span>
                    ) : (
                      <button
                        onClick={() => setVerEmpleadosDescanso(d)}
                        className="text-sm text-primary hover:underline"
                      >
                        {pluralEmpleados(
                          (empleadosPorDescanso.get(d.id) ?? []).length,
                        )}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={d.remunerado ? "default" : "outline"}
                      className="text-xs"
                    >
                      {d.remunerado ? "Sí" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => abrirEditar(d)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => eliminar(d.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!cargando && filtrados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  Sin descansos configurados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <DescansoEditDialog
        open={showEdit}
        descanso={editando}
        onChange={setEditando}
        onClose={() => {
          setShowEdit(false);
          setEditando(null);
        }}
        onSave={guardar}
        guardando={guardando}
        empresaId={empresaId}
        empresasReplicar={empresasReplicar}
        onEmpresasReplicarChange={setEmpresasReplicar}
      />

      <TurnosSelectDialog
        open={!!turnosOpenId}
        descanso={descansoTurnos}
        turnosDisponibles={turnos}
        onClose={() => setTurnosOpenId(null)}
        onChange={setTurnosDescanso}
      />

      <EmpleadosDescansoDialog
        descanso={verEmpleadosDescanso}
        empleados={
          verEmpleadosDescanso
            ? empleadosPorDescanso.get(verEmpleadosDescanso.id) ?? []
            : []
        }
        onClose={() => setVerEmpleadosDescanso(null)}
      />
    </div>
  );
}

function DescansoEditDialog({
  open,
  descanso,
  onChange,
  onClose,
  onSave,
  guardando,
  empresaId,
  empresasReplicar,
  onEmpresasReplicarChange,
}: {
  open: boolean;
  descanso: DescansoDraft | null;
  onChange: (d: DescansoDraft) => void;
  onClose: () => void;
  onSave: () => void;
  guardando: boolean;
  empresaId: string;
  empresasReplicar: string[];
  onEmpresasReplicarChange: (ids: string[]) => void;
}) {
  if (!descanso) return null;

  const update = (patch: Partial<DescansoDraft>) =>
    onChange({ ...descanso, ...patch });

  const toggleDia = (dia: DiaSemana) => {
    const set = new Set(descanso.dias);
    if (set.has(dia)) set.delete(dia);
    else set.add(dia);
    update({ dias: DIAS.filter((d) => set.has(d)) });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {descanso.id ? "Modificar descanso" : "Crear descanso"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Coffee className="h-4 w-4 text-primary" /> General
            </h3>
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Nombre del descanso
                </label>
                <Input
                  value={descanso.nombre}
                  onChange={(e) => update({ nombre: e.target.value })}
                  placeholder="Ej: CAMARERO SABADO"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Icono
                </label>
                <select
                  value={descanso.icono}
                  onChange={(e) => update({ icono: e.target.value })}
                  className="h-10 w-16 rounded-md border bg-background px-2 text-base"
                >
                  {ICONOS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Color
                </label>
                <div className="flex gap-1 h-10 items-center">
                  {COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update({ color: c })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2",
                        descanso.color === c
                          ? "border-foreground"
                          : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Remunerado</span>
              <Switch
                checked={descanso.remunerado}
                onCheckedChange={(v) => update({ remunerado: v })}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Tiempo
            </h3>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                ¿Cuándo podrán fichar con este descanso?
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cuandoFichar"
                  className="mt-1"
                  checked={descanso.cuandoFichar === "cualquier"}
                  onChange={() => update({ cuandoFichar: "cualquier" })}
                />
                <span className="text-sm">Cualquier momento del día</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cuandoFichar"
                  className="mt-1"
                  checked={descanso.cuandoFichar === "intervalo"}
                  onChange={() => update({ cuandoFichar: "intervalo" })}
                />
                <div>
                  <p className="text-sm">Intervalo</p>
                  <p className="text-xs text-muted-foreground">
                    Los empleados sólo podrán empezar a fichar dentro del siguiente
                    intervalo.
                  </p>
                </div>
              </label>
              {descanso.cuandoFichar === "intervalo" && (
                <div className="flex items-center gap-2 ml-6">
                  <Input
                    type="time"
                    value={descanso.intervaloInicio}
                    onChange={(e) => update({ intervaloInicio: e.target.value })}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="time"
                    value={descanso.intervaloFin}
                    onChange={(e) => update({ intervaloFin: e.target.value })}
                    className="w-32"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                ¿Cuánto tiempo podrá durar este descanso?
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="duracionTipo"
                  className="mt-1"
                  checked={descanso.duracionTipo === "sin_limite"}
                  onChange={() => update({ duracionTipo: "sin_limite" })}
                />
                <div>
                  <p className="text-sm">Sin límite</p>
                  <p className="text-xs text-muted-foreground">
                    Los empleados podrán fichar este descanso todo el tiempo que
                    quieran dentro del intervalo.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="duracionTipo"
                  className="mt-1"
                  checked={descanso.duracionTipo === "duracion"}
                  onChange={() =>
                    update({
                      duracionTipo: "duracion",
                      duracionMinutos: descanso.duracionMinutos ?? 30,
                    })
                  }
                />
                <div>
                  <p className="text-sm">Duración</p>
                  <p className="text-xs text-muted-foreground">
                    Los empleados podrán fichar este descanso durante el tiempo
                    configurado.
                  </p>
                </div>
              </label>
              {descanso.duracionTipo === "duracion" && (
                <div className="ml-6">
                  <Input
                    type="number"
                    min={1}
                    value={descanso.duracionMinutos ?? 30}
                    onChange={(e) =>
                      update({ duracionMinutos: Number(e.target.value) })
                    }
                    className="w-32"
                    placeholder="Minutos"
                  />
                </div>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Días disponibles</h3>
            <div className="flex items-center gap-2">
              {DIAS.map((dia) => (
                <button
                  key={dia}
                  type="button"
                  onClick={() => toggleDia(dia)}
                  className={cn(
                    "h-8 w-8 rounded-md text-xs font-semibold transition-colors",
                    descanso.dias.includes(dia)
                      ? "bg-slate-700 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {dia}
                </button>
              ))}
            </div>
          </section>

          {!descanso.id && (
            <SelectorReplicarEmpresas
              empresaActualId={empresaId}
              seleccionadas={empresasReplicar}
              onChange={onEmpresasReplicarChange}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TurnosSelectDialog({
  open,
  descanso,
  turnosDisponibles,
  onClose,
  onChange,
}: {
  open: boolean;
  descanso: Descanso | null;
  turnosDisponibles: Turno[];
  onClose: () => void;
  onChange: (turnoIds: string[]) => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const seleccionados = descanso?.turnos ?? [];

  const filtrados = turnosDisponibles.filter(
    (t) => !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const toggle = (turnoId: string) => {
    const set = new Set(seleccionados);
    if (set.has(turnoId)) set.delete(turnoId);
    else set.add(turnoId);
    onChange(Array.from(set));
  };

  const quitar = (turnoId: string) => {
    onChange(seleccionados.filter((id) => id !== turnoId));
  };

  const seleccionadosTurnos = turnosDisponibles.filter((t) =>
    seleccionados.includes(t.id),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{pluralTurnos(seleccionados.length)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar turno..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {seleccionadosTurnos.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {seleccionadosTurnos.map((t) => {
                const tono = TURNO_TONOS[t.color];
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md border bg-emerald-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center",
                          tono.pill,
                        )}
                      >
                        {t.codigo.slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium">{t.nombre}</span>
                    </div>
                    <button
                      onClick={() => quitar(t.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Quitar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t pt-3 space-y-1 max-h-72 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Todos los turnos
            </p>
            {filtrados.map((t) => {
              const checked = seleccionados.includes(t.id);
              const tono = TURNO_TONOS[t.color];
              const tramosTxt = t.tramos
                .map((tr) => `${tr.inicio}–${tr.fin}`)
                .join(" / ");
              return (
                <label
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-muted cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(t.id)}
                    />
                    <div className={cn("h-3 w-3 rounded-full shrink-0", tono.dot)} />
                    <span className="text-sm truncate">{t.nombre}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {tramosTxt}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono shrink-0"
                  >
                    {t.codigo}
                  </Badge>
                </label>
              );
            })}
            {filtrados.length === 0 && (
              <p className="text-center py-6 text-sm text-muted-foreground">
                Sin turnos disponibles
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmpleadosDescansoDialog({
  descanso,
  empleados,
  onClose,
}: {
  descanso: Descanso | null;
  empleados: EmpleadoBasico[];
  onClose: () => void;
}) {
  return (
    <Dialog open={!!descanso} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {descanso && (
              <span
                className="h-7 w-7 rounded-md flex items-center justify-center text-sm"
                style={{ backgroundColor: `${descanso.color}33` }}
              >
                {descanso.icono}
              </span>
            )}
            <span>
              {descanso?.nombre} · {pluralEmpleados(empleados.length)}
            </span>
          </DialogTitle>
        </DialogHeader>
        {empleados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Ningún empleado tiene un turno asociado a este descanso.
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
