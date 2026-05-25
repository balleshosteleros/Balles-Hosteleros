"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calcularDuracionTurno,
  formatTurnoHorario,
  TURNO_TONOS,
  type Turno,
} from "@/features/rrhh/data/horarios";
import { listTurnos } from "@/features/rrhh/actions/turnos-actions";
import {
  listPatrones,
  createPatron,
  updatePatron,
  deletePatron,
  type PatronCompleto,
  type PatronTipo,
} from "@/features/rrhh/actions/patrones-actions";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  ChevronRight,
  GripVertical,
  X,
  CalendarDays,
  CalendarSync,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type Vista =
  | { tipo: "lista" }
  | { tipo: "editor"; patronTipo: PatronTipo; patron?: PatronCompleto };

export function PatronesSection({ empresaId }: { empresaId: string }) {
  const [vista, setVista] = useState<Vista>({ tipo: "lista" });
  const [patrones, setPatrones] = useState<PatronCompleto[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  const refrescar = useCallback(async () => {
    setCargando(true);
    const [pr, tr] = await Promise.all([
      listPatrones(empresaId),
      listTurnos(empresaId),
    ]);
    if (pr.ok) setPatrones(pr.data);
    if (tr.ok) setTurnos(tr.data);
    setCargando(false);
  }, [empresaId]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  if (vista.tipo === "editor") {
    return (
      <PatronEditor
        empresaId={empresaId}
        turnos={turnos}
        patronTipo={vista.patronTipo}
        patron={vista.patron}
        onSalir={async (refrescarTras) => {
          if (refrescarTras) await refrescar();
          setVista({ tipo: "lista" });
        }}
      />
    );
  }

  return (
    <ListaPatrones
      empresaId={empresaId}
      turnos={turnos}
      patrones={patrones}
      cargando={cargando}
      onRefrescar={refrescar}
      onCrear={(tipo) => setVista({ tipo: "editor", patronTipo: tipo })}
      onEditar={(p) => setVista({ tipo: "editor", patronTipo: p.tipo, patron: p })}
    />
  );
}

// --- Lista ----------------------------------------------------------------

function ListaPatrones({
  empresaId: _empresaId,
  turnos,
  patrones,
  cargando,
  onRefrescar,
  onCrear,
  onEditar,
}: {
  empresaId: string;
  turnos: Turno[];
  patrones: PatronCompleto[];
  cargando: boolean;
  onRefrescar: () => Promise<void>;
  onCrear: (tipo: PatronTipo) => void;
  onEditar: (p: PatronCompleto) => void;
}) {
  const turnosById = useMemo(() => new Map(turnos.map((t) => [t.id, t])), [turnos]);
  const [busqueda, setBusqueda] = useState("");
  const [showTipoSelector, setShowTipoSelector] = useState(false);

  const filtrados = patrones.filter(
    (p) => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const eliminar = async (id: string) => {
    const res = await deletePatron(id);
    if (res.ok) await onRefrescar();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Patrones</h2>
        <p className="text-sm text-muted-foreground">
          Configura tu patrón según tus necesidades y añade hasta un máximo de 30 periodos.
          Un patrón puede repetirse tantas veces como indiques cuando le asignes empleados.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowTipoSelector(true)}>Crear patrón</Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Empleados asignados</TableHead>
              <TableHead>Turnos del patrón</TableHead>
              <TableHead>Creador</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
                </TableCell>
              </TableRow>
            )}
            {!cargando && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  Sin patrones
                </TableCell>
              </TableRow>
            )}
            {!cargando &&
              filtrados.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => onEditar(p)}
                >
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.tipo === "semanal" ? "Semanal" : "Libre"}</TableCell>
                  <TableCell>
                    <span className="text-primary underline">
                      {p.empleadosAsignados}{" "}
                      {p.empleadosAsignados === 1 ? "empleado" : "empleados"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TurnoBadges patron={p} turnosById={turnosById} />
                  </TableCell>
                  <TableCell className="text-sm">{p.creado_por_nombre}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditar(p)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => eliminar(p.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <div className="flex justify-end items-center gap-3 px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
          <span>{filtrados.length} Patrones</span>
          <span className="text-border">|</span>
          <span>
            Vista: <strong className="text-foreground">{filtrados.length}</strong>
          </span>
        </div>
      </div>

      <TipoSelectorDialog
        open={showTipoSelector}
        onOpenChange={setShowTipoSelector}
        onElegir={(tipo) => {
          setShowTipoSelector(false);
          onCrear(tipo);
        }}
      />
    </div>
  );
}

function TurnoBadges({
  patron,
  turnosById,
}: {
  patron: PatronCompleto;
  turnosById: Map<string, Turno>;
}) {
  const ids = patron.semanas
    .flatMap((s) => s.dias)
    .filter((id): id is string => !!id);
  const visibles = ids.slice(0, 5);
  const restante = ids.length - visibles.length;
  return (
    <div className="flex items-center gap-1">
      {visibles.map((id, i) => {
        const t = turnosById.get(id);
        if (!t) return null;
        return (
          <span
            key={i}
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded uppercase",
              TURNO_TONOS[t.color].pill
            )}
          >
            {t.codigo}
          </span>
        );
      })}
      {restante > 0 && (
        <span className="text-[10px] text-muted-foreground">+{restante}</span>
      )}
    </div>
  );
}

// --- Selector de tipo -----------------------------------------------------

function TipoSelectorDialog({
  open,
  onOpenChange,
  onElegir,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onElegir: (t: PatronTipo) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Crear patrón</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <button
            type="button"
            onClick={() => onElegir("semanal")}
            className="flex flex-col items-center text-center gap-3 p-6 rounded-lg border-2 border-transparent hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="h-14 w-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Patrón semanal</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Crea patrones semanales y asígnalos a los empleados de tus cuadrantes de turnos.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onElegir("libre")}
            className="flex flex-col items-center text-center gap-3 p-6 rounded-lg border-2 border-transparent hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CalendarSync className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Patrón libre</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Establece secuencias de turnos diarios que luego podrás aplicar a tus empleados en un periodo de tiempo determinado.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Editor ---------------------------------------------------------------

type CeldaSel = { semanaIdx: number; diaIdx: number } | { diaIdx: number } | null;

type BorradorEditor = {
  nombre: string;
  tipo: PatronTipo;
  semanas: { dias: (string | null)[] }[];     // tipo "semanal"
  diasLibres: (string | null)[];               // tipo "libre"
};

function borradorDesdePatron(patron: PatronCompleto): BorradorEditor {
  if (patron.tipo === "semanal") {
    return {
      nombre: patron.nombre,
      tipo: "semanal",
      semanas:
        patron.semanas.length > 0
          ? patron.semanas.map((s) => ({ dias: [...s.dias] }))
          : [{ dias: [null, null, null, null, null, null, null] }],
      diasLibres: [],
    };
  }
  return {
    nombre: patron.nombre,
    tipo: "libre",
    semanas: [],
    diasLibres: patron.semanas[0]?.dias ? [...patron.semanas[0].dias] : [null],
  };
}

function borradorVacio(tipo: PatronTipo): BorradorEditor {
  if (tipo === "semanal") {
    return {
      nombre: "Plantilla sin nombre",
      tipo: "semanal",
      semanas: [{ dias: [null, null, null, null, null, null, null] }],
      diasLibres: [],
    };
  }
  return {
    nombre: "Plantilla sin nombre",
    tipo: "libre",
    semanas: [],
    diasLibres: [null],
  };
}

function PatronEditor({
  empresaId,
  turnos,
  patronTipo,
  patron,
  onSalir,
}: {
  empresaId: string;
  turnos: Turno[];
  patronTipo: PatronTipo;
  patron?: PatronCompleto;
  onSalir: (refrescar: boolean) => Promise<void>;
}) {
  const turnosById = useMemo(() => new Map(turnos.map((t) => [t.id, t])), [turnos]);

  const [borrador, setBorrador] = useState<BorradorEditor>(() =>
    patron ? borradorDesdePatron(patron) : borradorVacio(patronTipo)
  );
  const [celda, setCelda] = useState<CeldaSel>(null);
  const [busquedaTurno, setBusquedaTurno] = useState("");
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(guardando);

  const asignarTurno = (turnoId: string | null) => {
    if (!celda) return;
    if ("semanaIdx" in celda) {
      const { semanaIdx, diaIdx } = celda;
      setBorrador((prev) => ({
        ...prev,
        semanas: prev.semanas.map((s, i) =>
          i !== semanaIdx
            ? s
            : { dias: s.dias.map((d, j) => (j === diaIdx ? turnoId : d)) }
        ),
      }));
    } else {
      const { diaIdx } = celda;
      setBorrador((prev) => ({
        ...prev,
        diasLibres: prev.diasLibres.map((d, i) => (i === diaIdx ? turnoId : d)),
      }));
    }
  };

  const guardar = async () => {
    setGuardando(true);
    const semanas =
      borrador.tipo === "semanal"
        ? borrador.semanas.map((s, i) => ({ orden: i, dias: s.dias }))
        : [{ orden: 0, dias: borrador.diasLibres }];

    if (patron) {
      await updatePatron(patron.id, { nombre: borrador.nombre, semanas });
    } else {
      await createPatron(
        {
          nombre: borrador.nombre,
          tipo: borrador.tipo,
          semanas,
        },
        empresaId,
      );
    }
    setGuardando(false);
    await onSalir(true);
  };

  const turnosFiltrados = turnos.filter(
    (t) =>
      t.activo &&
      (!busquedaTurno ||
        t.nombre.toLowerCase().includes(busquedaTurno.toLowerCase()) ||
        t.codigo.toLowerCase().includes(busquedaTurno.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Patrones</h2>
        <p className="text-sm text-muted-foreground">
          Configura tu patrón según tus necesidades y añade hasta un máximo de 30 periodos.
          Un patrón puede repetirse tantas veces como indiques cuando le asignes empleados.
        </p>
      </div>

      <nav className="flex items-center gap-2 text-sm">
        <button onClick={() => onSalir(false)} className="text-primary underline">
          Patrones
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          Configurador de patrones {patronTipo === "semanal" ? "semanales" : "libres"}
        </span>
      </nav>

      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          value={borrador.nombre}
          onChange={(e) =>
            setBorrador((prev) => ({ ...prev, nombre: e.target.value }))
          }
          className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-0 px-0 flex-1 min-w-0"
        />
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar patrón"}
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
        <div>
          {borrador.tipo === "semanal" ? (
            <SemanalGrid
              borrador={borrador}
              setBorrador={setBorrador}
              turnosById={turnosById}
              celda={celda}
              setCelda={setCelda}
              asignarTurno={asignarTurno}
            />
          ) : (
            <LibreGrid
              borrador={borrador}
              setBorrador={setBorrador}
              turnosById={turnosById}
              celda={celda}
              setCelda={setCelda}
              asignarTurno={asignarTurno}
            />
          )}
        </div>
        <TurnosPanel
          turnos={turnosFiltrados}
          busqueda={busquedaTurno}
          setBusqueda={setBusquedaTurno}
          asignar={(id) => asignarTurno(id)}
          habilitado={!!celda}
        />
      </div>
    </div>
  );
}

function SemanalGrid({
  borrador,
  setBorrador,
  turnosById,
  celda,
  setCelda,
  asignarTurno,
}: {
  borrador: BorradorEditor;
  setBorrador: React.Dispatch<React.SetStateAction<BorradorEditor>>;
  turnosById: Map<string, Turno>;
  celda: CeldaSel;
  setCelda: (c: CeldaSel) => void;
  asignarTurno: (id: string | null) => void;
}) {
  const añadirSemana = () =>
    setBorrador((prev) => ({
      ...prev,
      semanas: [
        ...prev.semanas,
        { dias: [null, null, null, null, null, null, null] },
      ],
    }));
  const eliminarSemana = (idx: number) =>
    setBorrador((prev) => ({
      ...prev,
      semanas: prev.semanas.filter((_, i) => i !== idx),
    }));

  return (
    <div className="space-y-3">
      {borrador.semanas.map((s, sIdx) => {
        const totalMin = s.dias.reduce(
          (sum, id) => sum + (id ? minutosTurno(turnosById.get(id)) : 0),
          0
        );
        return (
          <div key={sIdx} className="rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Semana {sIdx + 1}</span>
                <span className="text-xs text-muted-foreground">
                  ({formatHM(totalMin)})
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => eliminarSemana(sIdx)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar semana
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {DIAS.map((dia, dIdx) => {
                const turnoId = s.dias[dIdx];
                const turno = turnoId ? turnosById.get(turnoId) : undefined;
                const seleccionada =
                  !!celda &&
                  "semanaIdx" in celda &&
                  celda.semanaIdx === sIdx &&
                  celda.diaIdx === dIdx;
                return (
                  <div key={dIdx} className="space-y-1">
                    <p className="text-xs text-muted-foreground text-center">
                      {dia}
                    </p>
                    <div
                      onClick={() => setCelda({ semanaIdx: sIdx, diaIdx: dIdx })}
                      className={cn(
                        "w-full min-h-[72px] rounded-md border-2 border-dashed p-2 text-xs text-center transition-colors relative group cursor-pointer",
                        seleccionada
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                        turno && "border-solid"
                      )}
                    >
                      {turno ? (
                        <div className="space-y-1">
                          <span
                            className={cn(
                              "inline-block text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                              TURNO_TONOS[turno.color].pill
                            )}
                          >
                            {turno.codigo}
                          </span>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {formatTurnoHorario(turno)}
                          </p>
                          {seleccionada && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                asignarTurno(null);
                              }}
                              className="absolute top-1 right-1"
                              aria-label="Quitar turno"
                            >
                              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin turno</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <Button
        variant="ghost"
        onClick={añadirSemana}
        className="text-primary hover:text-primary"
      >
        <Plus className="h-4 w-4 mr-1" /> Añadir semana
      </Button>
    </div>
  );
}

function LibreGrid({
  borrador,
  setBorrador,
  turnosById,
  celda,
  setCelda,
  asignarTurno,
}: {
  borrador: BorradorEditor;
  setBorrador: React.Dispatch<React.SetStateAction<BorradorEditor>>;
  turnosById: Map<string, Turno>;
  celda: CeldaSel;
  setCelda: (c: CeldaSel) => void;
  asignarTurno: (id: string | null) => void;
}) {
  const añadirDia = () =>
    setBorrador((prev) => ({
      ...prev,
      diasLibres: [...prev.diasLibres, null],
    }));
  const eliminarDia = (idx: number) =>
    setBorrador((prev) => ({
      ...prev,
      diasLibres: prev.diasLibres.filter((_, i) => i !== idx),
    }));

  return (
    <div className="space-y-2">
      {borrador.diasLibres.map((turnoId, dIdx) => {
        const turno = turnoId ? turnosById.get(turnoId) : undefined;
        const totalMin = turno ? minutosTurno(turno) : 0;
        const seleccionada =
          !!celda && !("semanaIdx" in celda) && celda.diaIdx === dIdx;
        return (
          <div
            key={dIdx}
            className="flex items-center gap-3 rounded-lg border p-3 bg-background"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-[90px]">
              <p className="text-sm font-semibold">Día {dIdx + 1}</p>
              <p className="text-xs text-muted-foreground">({formatHM(totalMin)})</p>
            </div>
            <div
              onClick={() => setCelda({ diaIdx: dIdx })}
              className={cn(
                "flex-1 min-h-[44px] rounded-md border-2 border-dashed p-2 text-xs text-center transition-colors cursor-pointer relative",
                seleccionada
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
                turno && "border-solid"
              )}
            >
              {turno ? (
                <div className="flex items-center justify-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                      TURNO_TONOS[turno.color].pill
                    )}
                  >
                    {turno.codigo}
                  </span>
                  <span className="text-xs font-semibold">{turno.nombre}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTurnoHorario(turno)}
                  </span>
                  {seleccionada && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        asignarTurno(null);
                      }}
                      className="ml-2"
                      aria-label="Quitar turno"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  Sin turno (arrastra un turno aquí)
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => eliminarDia(dIdx)}
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Eliminar día"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
      <Button
        variant="ghost"
        onClick={añadirDia}
        className="text-primary hover:text-primary"
      >
        <Plus className="h-4 w-4 mr-1" /> Añadir día
      </Button>
    </div>
  );
}

function TurnosPanel({
  turnos,
  busqueda,
  setBusqueda,
  asignar,
  habilitado,
}: {
  turnos: Turno[];
  busqueda: string;
  setBusqueda: (s: string) => void;
  asignar: (id: string) => void;
  habilitado: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Turnos</h3>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="icon" aria-label="Filtros">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>
      {!habilitado && (
        <p className="text-xs text-muted-foreground italic">
          Selecciona un día para asignarle un turno
        </p>
      )}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {turnos.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!habilitado}
            onClick={() => asignar(t.id)}
            className={cn(
              "w-full flex items-center gap-2 p-2 rounded-lg border bg-background text-left transition-colors",
              habilitado
                ? "hover:bg-muted cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase",
                TURNO_TONOS[t.color].pill
              )}
            >
              {t.codigo}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{t.nombre}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatTurnoHorario(t)}
              </p>
            </div>
          </button>
        ))}
        {turnos.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sin turnos
          </p>
        )}
      </div>
    </div>
  );
}

// --- helpers --------------------------------------------------------------

function minutosTurno(turno: Turno | undefined): number {
  if (!turno) return 0;
  return Math.round(calcularDuracionTurno(turno) * 60);
}

function formatHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}min`;
}
