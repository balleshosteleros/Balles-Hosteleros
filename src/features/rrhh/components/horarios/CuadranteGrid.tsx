"use client";

import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, Users, Loader2, Building2, X, Layers, MapPin, Filter, LayoutGrid } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  formatTramo,
  formatHoras,
  pillStyleDepartamento,
  dotStyleDepartamento,
  DIAS_SEMANA,
  type DiaSemana,
} from "@/features/rrhh/data/horarios";
import type {
  Planificacion,
  PlanEmpleado,
  PlanTurno,
  TurnoCelda,
} from "@/features/rrhh/actions/planificacion-actions";

export type Agrupacion = "departamentos" | "empleados" | "turnos";
export type AreaValor = "operativa" | "administrativa";

interface CuadranteOpt {
  id: string;
  nombre: string;
}

interface DiaCol {
  iso: string;
  date: Date;
}

interface CuadranteGridProps {
  planificacion: Planificacion;
  dias: DiaCol[];
  agrupacion: Agrupacion;
  onAgrupacionChange: (a: Agrupacion) => void;
  areas: AreaValor[];
  onAreasChange: (a: AreaValor[]) => void;
  departamentosSel: string[];
  onDepartamentosSelChange: (d: string[]) => void;
  departamentos: string[];
  ocultarSinTurno: boolean;
  onOcultarSinTurnoChange: (v: boolean) => void;
  cuadrantes: CuadranteOpt[];
  cuadranteId: string | null;
  onCuadranteChange: (id: string | null) => void;
  hoyISO: string;
  cargando: boolean;
  compacto: boolean;
  /** Activa las zonas de drop (arrastrar turnos/patrones) y la × de quitar. */
  interactivo: boolean;
  onQuitar: (asignacionId: string) => void;
}

/** Datos que viajan al `over` en onDragEnd. */
export interface DropData {
  empleadoIds: string[];
  fecha: string;
  etiqueta: string;
}

const SIN_DEPTO = "Sin departamento";

export function CuadranteGrid({
  planificacion,
  dias,
  agrupacion,
  onAgrupacionChange,
  areas,
  onAreasChange,
  departamentosSel,
  onDepartamentosSelChange,
  departamentos,
  ocultarSinTurno,
  onOcultarSinTurnoChange,
  cuadrantes,
  cuadranteId,
  onCuadranteChange,
  hoyISO,
  cargando,
  compacto,
  interactivo,
  onQuitar,
}: CuadranteGridProps) {
  const { empleados, turnos, celdas, coloresDepartamento } = planificacion;
  const turnoById = useMemo(
    () => new Map(turnos.map((t) => [t.id, t])),
    [turnos],
  );

  // Cabecera: nº de empleados con algún turno ese día.
  const empleadosPorDia = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dias) {
      let n = 0;
      for (const e of empleados) {
        if ((celdas[e.empleadoId]?.[d.iso]?.length ?? 0) > 0) n += 1;
      }
      map.set(d.iso, n);
    }
    return map;
  }, [dias, empleados, celdas]);

  // Ancho FIJO por día (no min-w): cabecera y cuerpo deben medir igual o las
  // columnas se desalinean. En mes la cabecera "L 1 👤 0" no cabe en 52px, así
  // que reservamos un ancho que la contenga; en semana flex-1 reparte el sobrante.
  const colWidth = compacto ? "w-[76px]" : "min-w-[116px] flex-1";
  const nameColWidth = compacto ? "w-[200px]" : "w-[240px]";
  // En la vista Turnos no hay destino de asignación.
  const dndActivo = interactivo && agrupacion !== "turnos";

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Cabecera de días */}
          <div className="flex border-b bg-muted sticky top-0 z-20">
            <div
              className={cn(
                "shrink-0 sticky left-0 z-20 bg-muted border-r px-2.5 py-2 flex items-center gap-1.5",
                nameColWidth,
              )}
            >
              {/* Vista (cómo se agrupa la rejilla) + icono pequeño de filtros */}
              <Select
                value={agrupacion}
                onValueChange={(v) => onAgrupacionChange(v as Agrupacion)}
              >
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="departamentos">Por departamentos</SelectItem>
                  <SelectItem value="empleados">Por empleados</SelectItem>
                  <SelectItem value="turnos">Por turnos</SelectItem>
                </SelectContent>
              </Select>

              <FiltrosMenu
                areas={areas}
                onAreasChange={onAreasChange}
                departamentosSel={departamentosSel}
                onDepartamentosSelChange={onDepartamentosSelChange}
                departamentos={departamentos}
                ocultarSinTurno={ocultarSinTurno}
                onOcultarSinTurnoChange={onOcultarSinTurnoChange}
                cuadrantes={cuadrantes}
                cuadranteId={cuadranteId}
                onCuadranteChange={onCuadranteChange}
              />
            </div>
            {dias.map((d) => {
              const esHoy = d.iso === hoyISO;
              return (
                <div
                  key={d.iso}
                  className={cn(
                    "shrink-0 px-2 py-2 flex items-baseline justify-center gap-1 border-r last:border-r-0",
                    colWidth,
                    esHoy && "bg-primary/10",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px]",
                      compacto ? "uppercase" : "capitalize",
                      esHoy
                        ? "text-primary font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {/* Letra del día en mayúscula; miércoles = "X" para no confundir con martes ("M") */}
                    {compacto
                      ? ["D", "L", "M", "X", "J", "V", "S"][d.date.getDay()]
                      : format(d.date, "EEE", { locale: es })}
                  </span>
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      esHoy ? "text-primary font-bold" : "font-medium",
                    )}
                  >
                    {format(d.date, "d")}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Users className="h-2.5 w-2.5" />
                    {empleadosPorDia.get(d.iso) ?? 0}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Cuerpo */}
          {cargando ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando
              cuadrante…
            </div>
          ) : agrupacion === "turnos" ? (
            <TurnosBody
              turnos={turnos}
              dias={dias}
              empleados={empleados}
              celdas={celdas}
              hoyISO={hoyISO}
              colWidth={colWidth}
              nameColWidth={nameColWidth}
              compacto={compacto}
            />
          ) : (
            <EmpleadosBody
              empleados={empleados}
              dias={dias}
              celdas={celdas}
              turnoById={turnoById}
              coloresDepartamento={coloresDepartamento}
              agrupacion={agrupacion}
              hoyISO={hoyISO}
              colWidth={colWidth}
              nameColWidth={nameColWidth}
              compacto={compacto}
              dndActivo={dndActivo}
              onQuitar={onQuitar}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Menú de filtros (cuadrante + área + departamento) ────────────────────
const AREA_OPCIONES: { valor: AreaValor; label: string }[] = [
  { valor: "operativa", label: "Operativa" },
  { valor: "administrativa", label: "Administrativa" },
];

/** Fila con checkbox — mismo estilo que el filtro de columna estándar. */
function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 rounded px-1.5 py-1 text-sm font-normal hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded accent-primary"
      />
      <span className="truncate">{children}</span>
    </label>
  );
}

/** Cabecera de sección con "Seleccionar todo / Limpiar todo". */
function SeccionTitulo({
  icon: Icon,
  titulo,
  todasSel,
  onToggleTodas,
  nSel,
}: {
  icon: typeof MapPin;
  titulo: string;
  todasSel: boolean;
  onToggleTodas: () => void;
  nSel: number;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {titulo}
      </p>
      <div className="flex items-center justify-between px-1 text-[11px]">
        <button
          type="button"
          onClick={onToggleTodas}
          className="text-primary hover:underline"
        >
          {todasSel ? "Limpiar todo" : "Seleccionar todo"}
        </button>
        {nSel > 0 && (
          <span className="text-muted-foreground">
            {nSel} seleccionad{nSel === 1 ? "o" : "os"}
          </span>
        )}
      </div>
    </div>
  );
}

function FiltrosMenu({
  areas,
  onAreasChange,
  departamentosSel,
  onDepartamentosSelChange,
  departamentos,
  ocultarSinTurno,
  onOcultarSinTurnoChange,
  cuadrantes,
  cuadranteId,
  onCuadranteChange,
}: {
  areas: AreaValor[];
  onAreasChange: (a: AreaValor[]) => void;
  departamentosSel: string[];
  onDepartamentosSelChange: (d: string[]) => void;
  departamentos: string[];
  ocultarSinTurno: boolean;
  onOcultarSinTurnoChange: (v: boolean) => void;
  cuadrantes: CuadranteOpt[];
  cuadranteId: string | null;
  onCuadranteChange: (id: string | null) => void;
}) {
  // Área (multi). "Todas" = las dos marcadas (estado por defecto).
  const areasTodas = areas.length === AREA_OPCIONES.length;
  const toggleArea = (v: AreaValor, on: boolean) =>
    onAreasChange(on ? [...areas, v] : areas.filter((a) => a !== v));

  // Departamento (multi). "Todos" = todos marcados (estado por defecto).
  const deptsVisiblesSel =
    departamentos.length > 0 &&
    departamentos.every((d) => departamentosSel.includes(d));
  const toggleDepto = (d: string, on: boolean) =>
    onDepartamentosSelChange(
      on ? [...departamentosSel, d] : departamentosSel.filter((x) => x !== d),
    );

  // El badge del filtro solo aparece cuando hay una selección PARCIAL concreta
  // (no cuando está todo marcado, que es el default). El cuadrante NO cuenta: se
  // selecciona el del local por defecto, es el ámbito, no un filtro que estreche.
  const areasParcial = areas.length > 0 && areas.length < AREA_OPCIONES.length;
  const deptsParcial =
    departamentos.length > 0 &&
    departamentosSel.length > 0 &&
    departamentosSel.length < departamentos.length;
  const nActivos = (areasParcial ? 1 : 0) + (deptsParcial ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-7 w-7 shrink-0"
          title="Filtrar"
          aria-label="Filtrar"
        >
          <Filter
            className={cn(
              "h-3.5 w-3.5",
              nActivos > 0 ? "fill-current text-primary" : "text-muted-foreground",
            )}
          />
          {nActivos > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {nActivos}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {/* Mostrar/ocultar empleados sin ningún turno en el rango */}
          <label className="flex cursor-pointer select-none items-center gap-2 rounded px-1.5 py-1.5 text-xs font-medium hover:bg-muted">
            <input
              type="checkbox"
              checked={ocultarSinTurno}
              onChange={(e) => onOcultarSinTurnoChange(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>Ocultar empleados sin turno</span>
          </label>
          <div className="border-t" />

          {/* Cuadrante (selección única — define el ámbito que se carga) */}
          {cuadrantes.length > 0 && (
            <div className="space-y-0.5">
              <SeccionTitulo
                icon={MapPin}
                titulo="Cuadrante"
                todasSel={!!cuadranteId}
                nSel={cuadranteId ? 1 : 0}
                onToggleTodas={() => onCuadranteChange(null)}
              />
              {cuadrantes.map((c) => (
                <CheckRow
                  key={c.id}
                  checked={cuadranteId === c.id}
                  onChange={(on) => onCuadranteChange(on ? c.id : null)}
                >
                  {c.nombre}
                </CheckRow>
              ))}
            </div>
          )}

          {/* Área (multi) */}
          <div className="space-y-0.5">
            <SeccionTitulo
              icon={Layers}
              titulo="Área"
              todasSel={areasTodas}
              nSel={areasParcial ? areas.length : 0}
              onToggleTodas={() =>
                onAreasChange(areasTodas ? [] : AREA_OPCIONES.map((o) => o.valor))
              }
            />
            {AREA_OPCIONES.map((o) => (
              <CheckRow
                key={o.valor}
                checked={areas.includes(o.valor)}
                onChange={(on) => toggleArea(o.valor, on)}
              >
                {o.label}
              </CheckRow>
            ))}
          </div>

          {/* Departamento (multi) */}
          {departamentos.length > 0 && (
            <div className="space-y-0.5">
              <SeccionTitulo
                icon={Building2}
                titulo="Departamento"
                todasSel={deptsVisiblesSel}
                nSel={deptsParcial ? departamentosSel.length : 0}
                onToggleTodas={() => {
                  if (deptsVisiblesSel) {
                    onDepartamentosSelChange([]);
                  } else {
                    onDepartamentosSelChange(
                      Array.from(new Set([...departamentosSel, ...departamentos])),
                    );
                  }
                }}
              />
              <div className="max-h-52 space-y-0.5 overflow-y-auto">
                {departamentos.map((d) => (
                  <CheckRow
                    key={d}
                    checked={departamentosSel.includes(d)}
                    onChange={(on) => toggleDepto(d, on)}
                  >
                    {d}
                  </CheckRow>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Letra de día (L…D) a partir de "YYYY-MM-DD" (lunes = 0). */
function letraDeFecha(iso: string): DiaSemana {
  const d = new Date(`${iso}T12:00:00`);
  return DIAS_SEMANA[(d.getDay() + 6) % 7];
}

// ─── Pill de turno ──────────────────────────────────────────────────────
function TurnoPill({
  turno,
  compacto,
  diaLetra,
  asignacionId,
  onQuitar,
}: {
  turno: PlanTurno;
  compacto: boolean;
  /** Día de la semana de la casilla, para el total de horas del flexible. */
  diaLetra: DiaSemana;
  asignacionId?: string;
  onQuitar?: (asignacionId: string) => void;
}) {
  const quitable = !!asignacionId && !!onQuitar;
  const esFlexible = turno.tipoJornada === "flexible";
  // Modelo nuevo: el flexible indica horas/día (flexHorasDia). Legacy: por día.
  const horasDia = esFlexible
    ? turno.flexHorasDia ?? turno.flexHoras[diaLetra] ?? 0
    : 0;
  // Turno partido = más de un tramo el mismo día → se apilan entrada/salida.
  const tramos = turno.tramos;
  const titulo = `${turno.codigo} · ${turno.nombre}${
    esFlexible
      ? horasDia > 0
        ? " · " + formatHoras(horasDia)
        : ""
      : tramos.length
        ? " · " + tramos.map(formatTramo).join(" / ")
        : ""
  }`;
  return (
    <div
      className="group/pill relative rounded-md px-1.5 py-1 text-center leading-tight"
      style={pillStyleDepartamento(turno.colorHex)}
      title={titulo}
    >
      <span className="block text-[11px] font-semibold tracking-wide truncate">
        {turno.codigo}
      </span>
      {!compacto && esFlexible && horasDia > 0 && (
        <span className="block text-[10px] font-medium opacity-90 tabular-nums truncate">
          {formatHoras(horasDia)}
        </span>
      )}
      {!compacto &&
        !esFlexible &&
        tramos.map((tr, i) => (
          <span
            key={i}
            className="block text-[10px] opacity-80 tabular-nums truncate"
          >
            {tr.inicio}–{tr.fin}
          </span>
        ))}
      {quitable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuitar!(asignacionId!);
          }}
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-foreground/80 text-background shadow group-hover/pill:flex hover:bg-destructive"
          aria-label="Quitar asignación"
          title="Quitar"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function Celda({
  celdasTurno,
  turnoById,
  compacto,
  esHoy,
  colWidth,
  dropId,
  dropData,
  dndActivo,
  onQuitar,
}: {
  celdasTurno: TurnoCelda[] | undefined;
  turnoById: Map<string, PlanTurno>;
  compacto: boolean;
  esHoy: boolean;
  colWidth: string;
  dropId: string;
  dropData: DropData;
  dndActivo: boolean;
  onQuitar: (asignacionId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: dropData,
    disabled: !dndActivo,
  });
  const items = (celdasTurno ?? [])
    .map((c) => ({ turno: turnoById.get(c.turnoId), celda: c }))
    .filter((x) => x.turno) as { turno: PlanTurno; celda: TurnoCelda }[];
  const diaLetra = letraDeFecha(dropData.fecha);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 border-r last:border-r-0 p-1 space-y-1 transition-colors",
        colWidth,
        esHoy && "bg-primary/5",
        isOver && "ring-2 ring-inset ring-primary bg-primary/10",
      )}
    >
      {items.slice(0, compacto ? 1 : 3).map(({ turno, celda }) => (
        <TurnoPill
          key={turno.id}
          turno={turno}
          compacto={compacto}
          diaLetra={diaLetra}
          asignacionId={celda.asignacionId}
          onQuitar={dndActivo ? onQuitar : undefined}
        />
      ))}
      {compacto && items.length > 1 && (
        <span className="block text-center text-[9px] text-muted-foreground">
          +{items.length - 1}
        </span>
      )}
    </div>
  );
}

// ─── Cuerpo Empleados / Departamentos ─────────────────────────────────────
function EmpleadosBody({
  empleados,
  dias,
  celdas,
  turnoById,
  coloresDepartamento,
  agrupacion,
  hoyISO,
  colWidth,
  nameColWidth,
  compacto,
  dndActivo,
  onQuitar,
}: {
  empleados: PlanEmpleado[];
  dias: DiaCol[];
  celdas: Planificacion["celdas"];
  turnoById: Map<string, PlanTurno>;
  coloresDepartamento: Record<string, string>;
  agrupacion: Agrupacion;
  hoyISO: string;
  colWidth: string;
  nameColWidth: string;
  compacto: boolean;
  dndActivo: boolean;
  onQuitar: (asignacionId: string) => void;
}) {
  const filtrados = useMemo(
    () =>
      [...empleados].sort((a, b) =>
        a.nombreCompleto.localeCompare(b.nombreCompleto, "es"),
      ),
    [empleados],
  );

  // Agrupar por departamento (con cabeceras plegables).
  const grupos = useMemo(() => {
    if (agrupacion !== "departamentos") return null;
    const map = new Map<string, PlanEmpleado[]>();
    for (const e of filtrados) {
      const dep = e.departamento ?? SIN_DEPTO;
      const arr = map.get(dep) ?? [];
      arr.push(e);
      map.set(dep, arr);
    }
    // Más empleados primero; a igualdad, alfabético. "Sin departamento" al final.
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === SIN_DEPTO) return 1;
      if (b[0] === SIN_DEPTO) return -1;
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0], "es");
    });
  }, [filtrados, agrupacion]);

  const [plegados, setPlegados] = useState<Set<string>>(new Set());
  const togglePlegado = (dep: string) =>
    setPlegados((prev) => {
      const next = new Set(prev);
      if (next.has(dep)) next.delete(dep);
      else next.add(dep);
      return next;
    });

  if (filtrados.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Sin empleados en este ámbito.
      </div>
    );
  }

  const renderFila = (e: PlanEmpleado) => {
    // Al agrupar por departamentos no mostramos nada bajo el nombre: el depto
    // ya aparece en la cabecera del grupo.
    const subtitulo =
      agrupacion === "departamentos" ? null : e.puesto ?? e.departamento;
    return (
    <div key={e.empleadoId} className="flex border-b hover:bg-muted/30 group">
      <div
        className={cn(
          "shrink-0 sticky left-0 z-10 bg-card group-hover:bg-muted border-r px-4 py-2 flex flex-col justify-center",
          nameColWidth,
        )}
      >
        <span className="text-sm font-medium truncate">{e.nombreCompleto}</span>
        {!compacto && subtitulo && (
          <span className="text-[11px] text-muted-foreground truncate">
            {subtitulo}
          </span>
        )}
      </div>
      {dias.map((d) => (
        <Celda
          key={d.iso}
          celdasTurno={celdas[e.empleadoId]?.[d.iso]}
          turnoById={turnoById}
          compacto={compacto}
          esHoy={d.iso === hoyISO}
          colWidth={colWidth}
          dropId={`emp:${e.empleadoId}:${d.iso}`}
          dropData={{
            empleadoIds: [e.empleadoId],
            fecha: d.iso,
            etiqueta: e.nombreCompleto,
          }}
          dndActivo={dndActivo}
          onQuitar={onQuitar}
        />
      ))}
    </div>
    );
  };

  if (agrupacion === "departamentos" && grupos) {
    return (
      <>
        {grupos.map(([dep, emps]) => {
          const plegado = plegados.has(dep);
          const empIds = emps.map((e) => e.empleadoId);
          return (
            <div key={dep}>
              {/* Cabecera de departamento: nombre + celdas de día droppables. */}
              <div className="flex border-b bg-muted/50">
                <button
                  type="button"
                  onClick={() => togglePlegado(dep)}
                  className={cn(
                    "shrink-0 sticky left-0 z-10 bg-muted hover:bg-accent flex items-center gap-2 px-4 py-2 text-left",
                    nameColWidth,
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      plegado && "-rotate-90",
                    )}
                  />
                  {dep !== SIN_DEPTO ? (
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={dotStyleDepartamento(coloresDepartamento[dep])}
                    />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm font-semibold truncate">{dep}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    · {emps.length}
                  </span>
                </button>
                {dias.map((d) => (
                  <DeptoDropCelda
                    key={d.iso}
                    dropId={`dep:${dep}:${d.iso}`}
                    dropData={{
                      empleadoIds: empIds,
                      fecha: d.iso,
                      etiqueta: dep,
                    }}
                    dndActivo={dndActivo}
                    esHoy={d.iso === hoyISO}
                    colWidth={colWidth}
                  />
                ))}
              </div>
              {!plegado && emps.map(renderFila)}
            </div>
          );
        })}
      </>
    );
  }

  return <>{filtrados.map(renderFila)}</>;
}

// Celda de día sobre la cabecera de departamento: solo zona de drop.
function DeptoDropCelda({
  dropId,
  dropData,
  dndActivo,
  esHoy,
  colWidth,
}: {
  dropId: string;
  dropData: DropData;
  dndActivo: boolean;
  esHoy: boolean;
  colWidth: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: dropData,
    disabled: !dndActivo,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 border-r last:border-r-0 transition-colors",
        colWidth,
        esHoy && "bg-primary/10",
        isOver && "ring-2 ring-inset ring-primary bg-primary/20",
      )}
    />
  );
}

// ─── Cuerpo Turnos y patrones ─────────────────────────────────────────────
function TurnosBody({
  turnos,
  dias,
  empleados,
  celdas,
  hoyISO,
  colWidth,
  nameColWidth,
  compacto,
}: {
  turnos: PlanTurno[];
  dias: DiaCol[];
  empleados: PlanEmpleado[];
  celdas: Planificacion["celdas"];
  hoyISO: string;
  colWidth: string;
  nameColWidth: string;
  compacto: boolean;
}) {
  // Recuento de empleados con cada turno por día.
  const conteo = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const t of turnos) map.set(t.id, new Map());
    for (const e of empleados) {
      const porFecha = celdas[e.empleadoId] ?? {};
      for (const [iso, items] of Object.entries(porFecha)) {
        for (const c of items) {
          const m = map.get(c.turnoId);
          if (m) m.set(iso, (m.get(iso) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [turnos, empleados, celdas]);

  const turnosFiltrados = [...turnos].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );

  if (turnosFiltrados.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Sin turnos configurados.
      </div>
    );
  }

  return (
    <>
      {turnosFiltrados.map((t) => {
        return (
          <div key={t.id} className="flex border-b hover:bg-muted/30 group">
            <div
              className={cn(
                "shrink-0 sticky left-0 z-10 bg-card group-hover:bg-muted border-r px-4 py-2 flex items-center gap-2.5",
                nameColWidth,
              )}
            >
              <span
                className="inline-flex h-6 min-w-[42px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide"
                style={pillStyleDepartamento(t.colorHex)}
              >
                {t.codigo}
              </span>
              <span className="text-sm font-medium truncate">{t.nombre}</span>
            </div>
            {dias.map((d) => {
              const weekday = (d.date.getDay() + 6) % 7;
              const n = conteo.get(t.id)?.get(d.iso) ?? 0;
              // Con días configurados: se muestra en esos días. Turnos legacy
              // sin días: solo donde alguien realmente lo trabaja (evita ruido).
              const aplica =
                t.dias.length === 0 ? n > 0 : t.dias.includes(DIAS_SEMANA[weekday]);
              return (
                <div
                  key={d.iso}
                  className={cn(
                    "shrink-0 border-r last:border-r-0 p-1 flex flex-col items-center justify-center gap-0.5",
                    colWidth,
                    d.iso === hoyISO && "bg-primary/5",
                  )}
                >
                  {aplica ? (
                    <>
                      {!compacto && t.tramos[0] && (
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {t.tramos[0].inicio}–{t.tramos[0].fin}
                        </span>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 text-[11px] font-medium",
                          n === 0 ? "text-muted-foreground/50" : "text-foreground",
                        )}
                      >
                        <Users className="h-2.5 w-2.5" />
                        {n}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/20">·</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
