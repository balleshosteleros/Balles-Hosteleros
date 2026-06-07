"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calcularDuracionTurno,
  formatTurnoHorario,
  TURNO_TONOS,
  type Turno,
  type TipoJornada,
} from "@/features/rrhh/data/horarios";
import { listTurnos } from "@/features/rrhh/actions/turnos-actions";
import {
  listPatrones,
  createPatron,
  crearVersionPatron,
  getVersionesPatron,
  deletePatron,
  type PatronCompleto,
  type PatronTipo,
} from "@/features/rrhh/actions/patrones-actions";
import { listDepartamentos } from "@/features/rrhh/actions/empleados-actions";
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
  History,
  Building2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { toast } from "sonner";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Máximo de periodos (semanas) por patrón. */
const MAX_SEMANAS = 5;

type Vista =
  | { tipo: "lista" }
  | {
      tipo: "editor";
      patronTipo: PatronTipo;
      patronJornada: TipoJornada;
      patron?: PatronCompleto;
    };

const JORNADA_LABEL: Record<TipoJornada, string> = {
  fijo: "Fija",
  flexible: "Flexible",
};

export function PatronesSection({ empresaId }: { empresaId: string }) {
  const [vista, setVista] = useState<Vista>({ tipo: "lista" });
  const [patrones, setPatrones] = useState<PatronCompleto[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  const refrescar = useCallback(async () => {
    setCargando(true);
    const [pr, tr, dr] = await Promise.all([
      listPatrones(empresaId),
      listTurnos(empresaId),
      listDepartamentos(),
    ]);
    if (pr.ok) setPatrones(pr.data);
    if (tr.ok) setTurnos(tr.data);
    if (dr.ok) {
      const nombres = Array.from(
        new Set((dr.data ?? []).map((d) => d.nombre).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "es"));
      setDepartamentos(nombres);
    }
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
        departamentos={departamentos}
        patronTipo={vista.patronTipo}
        patronJornada={vista.patronJornada}
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
      onCrear={(tipo, jornada) =>
        setVista({ tipo: "editor", patronTipo: tipo, patronJornada: jornada })
      }
      onEditar={(p) =>
        setVista({
          tipo: "editor",
          patronTipo: p.tipo,
          patronJornada: p.tipo_jornada,
          patron: p,
        })
      }
    />
  );
}

// --- Lista ----------------------------------------------------------------

function ListaPatrones({
  empresaId,
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
  onCrear: (tipo: PatronTipo, jornada: TipoJornada) => void;
  onEditar: (p: PatronCompleto) => void;
}) {
  const turnosById = useMemo(() => new Map(turnos.map((t) => [t.id, t])), [turnos]);
  const [busqueda, setBusqueda] = useState("");
  const [deptoFiltro, setDeptoFiltro] = useState<string>("__todos__");
  const [showTipoSelector, setShowTipoSelector] = useState(false);
  const [verVersiones, setVerVersiones] = useState<PatronCompleto | null>(null);

  // Departamentos presentes en los patrones (para el filtro).
  const departamentosFiltro = useMemo(
    () =>
      Array.from(
        new Set(
          patrones
            .map((p) => p.departamento?.trim())
            .filter((d): d is string => !!d),
        ),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [patrones],
  );

  const filtrados = patrones.filter(
    (p) =>
      (!busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase())) &&
      (deptoFiltro === "__todos__" || p.departamento?.trim() === deptoFiltro),
  );

  const eliminar = async (id: string) => {
    const res = await deletePatron(id);
    if (res.ok) await onRefrescar();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarSync className="h-5 w-5 text-primary" />
          Patrones
        </h2>
        <p className="text-sm text-muted-foreground">
          Configura tu patrón según tus necesidades y añade hasta un máximo de 5 periodos (5 semanas).
          Un patrón puede repetirse tantas veces como indiques cuando le asignes empleados.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          {departamentosFiltro.length > 0 && (
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={deptoFiltro}
                onChange={(e) => setDeptoFiltro(e.target.value)}
                className="h-9 rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Filtrar patrones por departamento"
              >
                <option value="__todos__">Todos los departamentos</option>
                {departamentosFiltro.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowTipoSelector(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Empleados asignados</TableHead>
              <TableHead>Turnos del patrón</TableHead>
              <TableHead>Creador</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
                </TableCell>
              </TableRow>
            )}
            {!cargando && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
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
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {p.nombre}
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        v{p.version}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{p.tipo === "semanal" ? "Semanal" : "Libre"}</span>
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                          p.tipo_jornada === "flexible"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-sky-100 text-sky-700"
                        )}
                      >
                        {JORNADA_LABEL[p.tipo_jornada]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.departamento ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{p.departamento}</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-500">
                        Sin asignar
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.empleadosAsignados}{" "}
                    {p.empleadosAsignados === 1 ? "empleado" : "empleados"}
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
                        <DropdownMenuItem onClick={() => setVerVersiones(p)}>
                          <History className="h-3.5 w-3.5 mr-2" /> Ver versiones
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
        onElegir={(tipo, jornada) => {
          setShowTipoSelector(false);
          onCrear(tipo, jornada);
        }}
      />

      {verVersiones && (
        <VersionesPatronDialog
          patron={verVersiones}
          turnosById={turnosById}
          onClose={() => setVerVersiones(null)}
        />
      )}
    </div>
  );
}

// --- Diálogo: histórico de versiones de un patrón ------------------------

function VersionesPatronDialog({
  patron,
  turnosById,
  onClose,
}: {
  patron: PatronCompleto;
  turnosById: Map<string, Turno>;
  onClose: () => void;
}) {
  const [versiones, setVersiones] = useState<PatronCompleto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    getVersionesPatron(patron.id).then((res) => {
      if (cancelado) return;
      if (res.ok) setVersiones(res.data);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [patron.id]);

  const fmtFecha = (iso: string) => {
    const d = (iso ?? "").slice(0, 10).split("-");
    return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Versiones · {patron.nombre}</DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {versiones.map((v) => {
              const ids = v.semanas.flatMap((s) => s.dias).filter((id): id is string => !!id);
              return (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-lg border p-3",
                    v.es_oficial && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-1.5">
                      v{v.version}
                      {v.es_oficial && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          Actual
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Creada el {fmtFecha(v.created_at)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {ids.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sin turnos</span>
                    ) : (
                      ids.slice(0, 10).map((id, i) => {
                        const t = turnosById.get(id);
                        return t ? (
                          <span
                            key={i}
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded uppercase",
                              TURNO_TONOS[t.color].pill,
                            )}
                          >
                            {t.codigo}
                          </span>
                        ) : null;
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  onElegir: (t: PatronTipo, jornada: TipoJornada) => void;
}) {
  const [jornada, setJornada] = useState<TipoJornada>("fijo");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Crear patrón</DialogTitle>
        </DialogHeader>

        <div className="mt-1">
          <label className="block text-sm font-medium mb-1.5">Tipo de jornada</label>
          <div className="inline-flex rounded-lg border p-0.5 bg-muted/40">
            {(["fijo", "flexible"] as const).map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJornada(j)}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-md transition-colors",
                  jornada === j
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {JORNADA_LABEL[j]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {jornada === "flexible"
              ? "Sus celdas usarán turnos flexibles (horas objetivo por día)."
              : "Sus celdas usarán turnos fijos (tramos horarios por día)."}{" "}
            Un patrón no mezcla jornadas.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <button
            type="button"
            onClick={() => onElegir("semanal", jornada)}
            className="flex flex-col items-center text-center gap-3 p-6 rounded-lg border-2 border-transparent hover:border-primary hover:bg-muted/40 transition-colors"
          >
            <div className="h-14 w-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Patrón semanal</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Crea patrones semanales y asígnalos a los empleados de tus turnos.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onElegir("libre", jornada)}
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
  departamento: string;                         // "" = sin asignar
  vigenteDesde: string;                         // YYYY-MM-DD (fecha de inicio)
  vigenteHasta: string;                         // YYYY-MM-DD o "" = sin fecha fin
  semanas: { dias: (string | null)[] }[];     // tipo "semanal"
  diasLibres: (string | null)[];               // tipo "libre"
};

function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function borradorDesdePatron(patron: PatronCompleto): BorradorEditor {
  if (patron.tipo === "semanal") {
    return {
      nombre: patron.nombre,
      tipo: "semanal",
      departamento: patron.departamento ?? "",
      vigenteDesde: patron.vigente_desde ?? hoyISO(),
      vigenteHasta: patron.vigente_hasta ?? "",
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
    departamento: patron.departamento ?? "",
    vigenteDesde: patron.vigente_desde ?? hoyISO(),
    vigenteHasta: patron.vigente_hasta ?? "",
    semanas: [],
    diasLibres: patron.semanas[0]?.dias ? [...patron.semanas[0].dias] : [null],
  };
}

function borradorVacio(tipo: PatronTipo): BorradorEditor {
  if (tipo === "semanal") {
    return {
      nombre: "Plantilla sin nombre",
      tipo: "semanal",
      departamento: "",
      vigenteDesde: hoyISO(),
      vigenteHasta: "",
      semanas: [{ dias: [null, null, null, null, null, null, null] }],
      diasLibres: [],
    };
  }
  return {
    nombre: "Plantilla sin nombre",
    tipo: "libre",
    departamento: "",
    vigenteDesde: hoyISO(),
    vigenteHasta: "",
    semanas: [],
    diasLibres: [null],
  };
}

function PatronEditor({
  empresaId,
  turnos,
  departamentos,
  patronTipo,
  patronJornada,
  patron,
  onSalir,
}: {
  empresaId: string;
  turnos: Turno[];
  departamentos: string[];
  patronTipo: PatronTipo;
  patronJornada: TipoJornada;
  patron?: PatronCompleto;
  onSalir: (refrescar: boolean) => Promise<void>;
}) {
  // La jornada es inmutable una vez creado el patrón: al editar manda la del
  // patrón; al crear, la elegida en el diálogo.
  const jornada = patron?.tipo_jornada ?? patronJornada;
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

    const vigente_desde = borrador.vigenteDesde || undefined;
    const vigente_hasta = borrador.vigenteHasta ? borrador.vigenteHasta : null;

    // Editar un patrón existente NO se hace en sitio: crea una versión nueva
    // (la anterior queda como histórico). Crear uno nuevo = versión 1.
    const departamento = borrador.departamento.trim() || null;
    const res = patron
      ? await crearVersionPatron(patron.id, {
          nombre: borrador.nombre,
          tipo_jornada: jornada,
          departamento,
          semanas,
        })
      : await createPatron(
          {
            nombre: borrador.nombre,
            tipo: borrador.tipo,
            tipo_jornada: jornada,
            departamento,
            semanas,
            vigente_desde,
            vigente_hasta,
          },
          empresaId,
        );
    setGuardando(false);
    if (!res?.ok) {
      toast.error(res?.error || "No se pudo guardar el patrón");
      return;
    }
    if (patron) toast.success("Nueva versión del patrón creada");
    await onSalir(true);
  };

  const rangoInvalido =
    !!borrador.vigenteHasta && borrador.vigenteHasta < borrador.vigenteDesde;

  const turnosFiltrados = turnos.filter(
    (t) =>
      t.activo &&
      t.tipoJornada === jornada &&
      (!busquedaTurno ||
        t.nombre.toLowerCase().includes(busquedaTurno.toLowerCase()) ||
        t.codigo.toLowerCase().includes(busquedaTurno.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarSync className="h-5 w-5 text-primary" />
          Patrones
        </h2>
        <p className="text-sm text-muted-foreground">
          Configura tu patrón según tus necesidades y añade hasta un máximo de 5 periodos (5 semanas).
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
          {" · jornada "}
          {JORNADA_LABEL[jornada].toLowerCase()}
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
        <Button onClick={guardar} disabled={guardando || rangoInvalido}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar patrón"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Departamento</label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={borrador.departamento}
              onChange={(e) =>
                setBorrador((prev) => ({ ...prev, departamento: e.target.value }))
              }
              className="h-9 w-52 rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Sin asignar</option>
              {departamentos.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Agrupa y filtra el patrón, aunque tenga turnos de varios departamentos.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fecha de inicio</label>
          <Input
            type="date"
            value={borrador.vigenteDesde}
            onChange={(e) => setBorrador((prev) => ({ ...prev, vigenteDesde: e.target.value }))}
            className="w-44"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fecha de fin</label>
          <Input
            type="date"
            value={borrador.vigenteHasta}
            min={borrador.vigenteDesde || undefined}
            onChange={(e) => setBorrador((prev) => ({ ...prev, vigenteHasta: e.target.value }))}
            className="w-44"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Vacío = sin fecha de fin.</p>
        </div>
      </div>
      {rangoInvalido && (
        <p className="text-xs text-destructive">
          La fecha de fin no puede ser anterior a la de inicio.
        </p>
      )}

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
    setBorrador((prev) =>
      prev.semanas.length >= MAX_SEMANAS
        ? prev
        : {
            ...prev,
            semanas: [
              ...prev.semanas,
              { dias: [null, null, null, null, null, null, null] },
            ],
          },
    );
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
        disabled={borrador.semanas.length >= MAX_SEMANAS}
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
