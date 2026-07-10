"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  MODELO_LABEL,
  MODELO_PERIODOS_VALIDOS,
  ventanaPresentacion,
  grupoDeModelo,
  type ModeloTipo,
  type ModeloPeriodo,
  type GrupoModelo,
} from "../types/modelos";

interface Props {
  ejercicio: number;
}

// --- Formato de fechas en español (sin toLocale*, regla del proyecto) ---
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const MESES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

// Semana empieza en LUNES (España): L M X J V S D
const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"] as const;

const PERIODO_LABEL: Record<ModeloPeriodo, string> = {
  T1: "1T",
  T2: "2T",
  T3: "3T",
  T4: "4T",
  ANUAL: "Anual",
};

/** Normaliza una fecha a medianoche local (comparación a nivel de día). */
function aDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function mismaFecha(a: Date, b: Date): boolean {
  return aDia(a) === aDia(b);
}

/** "1 abr", "20 abr" — formato corto en español. */
function fechaCorta(d: Date): string {
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}

/**
 * Índice de columna (0=lunes .. 6=domingo) para un getDay() JS (0=domingo).
 */
function columnaLunes(getDay: number): number {
  return (getDay + 6) % 7;
}

interface Ventana {
  tipo: ModeloTipo;
  periodo: ModeloPeriodo;
  grupo: GrupoModelo;
  inicio: Date;
  fin: Date;
}

// Color por GRUPO: trimestrales en verde, anuales en azul.
const COLOR_GRUPO: Record<GrupoModelo, { franja: string; limite: string; leyenda: string }> = {
  TRIMESTRALES: {
    franja: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
    limite: "ring-2 ring-emerald-600 dark:ring-emerald-400",
    leyenda: "bg-emerald-100 dark:bg-emerald-900/50",
  },
  ANUALES: {
    franja: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
    limite: "ring-2 ring-sky-600 dark:ring-sky-400",
    leyenda: "bg-sky-100 dark:bg-sky-900/50",
  },
};

// Colores CSS crudos (para el gradiente de días con dos grupos a la vez).
const COLOR_CSS: Record<GrupoModelo, string> = {
  TRIMESTRALES: "rgb(209 250 229)", // emerald-100
  ANUALES: "rgb(224 242 254)", // sky-100
};

export function CalendarioFiscal({ ejercicio }: Props) {
  const [vista, setVista] = useState<"mes" | "anio">("mes");
  const [filtroModelo, setFiltroModelo] = useState<ModeloTipo | "TODOS">("TODOS");
  // Año natural que se muestra dentro del calendario (por defecto = ejercicio).
  const [anioVista, setAnioVista] = useState<number>(ejercicio);
  // Mes actual en vista mensual (0-11). Arranca en abril (primer plazo del ejercicio).
  const [mesVista, setMesVista] = useState<number>(3);

  // Ventanas de VARIOS ejercicios: las de T4/anuales del ejercicio N caen en
  // enero-julio de N+1, así que para que enero (y feb/jul) no salgan vacíos hay
  // que incluir el ejercicio anterior. Generamos N-1, N y N+1.
  const todasVentanas = useMemo<Ventana[]>(() => {
    const tipos = Object.keys(MODELO_LABEL) as ModeloTipo[];
    const ejercicios = [ejercicio - 1, ejercicio, ejercicio + 1];
    return ejercicios.flatMap((ej) =>
      tipos.flatMap((tipo) =>
        MODELO_PERIODOS_VALIDOS[tipo]
          .map((periodo) => {
            const v = ventanaPresentacion(tipo, periodo, ej);
            return v
              ? { tipo, periodo, grupo: grupoDeModelo(tipo), inicio: v.inicio, fin: v.fin }
              : null;
          })
          .filter((x): x is Ventana => x !== null),
      ),
    );
  }, [ejercicio]);

  // Tipos que realmente tienen alguna ventana (para poblar el selector).
  const tiposConVentana = useMemo<ModeloTipo[]>(() => {
    const set = new Set<ModeloTipo>();
    for (const v of todasVentanas) set.add(v.tipo);
    return (Object.keys(MODELO_LABEL) as ModeloTipo[]).filter((t) => set.has(t));
  }, [todasVentanas]);

  // Ventanas visibles según el filtro de modelo.
  const ventanasVisibles = useMemo<Ventana[]>(() => {
    if (filtroModelo === "TODOS") return todasVentanas;
    return todasVentanas.filter((v) => v.tipo === filtroModelo);
  }, [todasVentanas, filtroModelo]);

  // Lista textual: solo las ventanas que caen (inicio o fin) en el año mostrado,
  // ordenadas por fecha de inicio.
  const listaOrdenada = useMemo<Ventana[]>(
    () =>
      [...ventanasVisibles]
        .filter(
          (v) => v.inicio.getFullYear() === anioVista || v.fin.getFullYear() === anioVista,
        )
        .sort((a, b) => aDia(a.inicio) - aDia(b.inicio)),
    [ventanasVisibles, anioVista],
  );

  /** ¿El día está dentro de [inicio, fin] de alguna ventana visible? */
  function ventanasEnDia(dia: Date): Ventana[] {
    const t = aDia(dia);
    return ventanasVisibles.filter((v) => t >= aDia(v.inicio) && t <= aDia(v.fin));
  }

  /** Ventanas cuyo día LÍMITE (fin) coincide con el día. */
  function limitesEnDia(dia: Date): Ventana[] {
    return ventanasVisibles.filter((v) => mismaFecha(v.fin, dia));
  }

  function navegarMes(delta: number) {
    let nuevoMes = mesVista + delta;
    let nuevoAnio = anioVista;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAnio -= 1;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAnio += 1;
    }
    setMesVista(nuevoMes);
    setAnioVista(nuevoAnio);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarDays className="h-4 w-4" />
          Calendario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Calendario fiscal</DialogTitle>
          <DialogDescription>Ejercicio {ejercicio}</DialogDescription>
        </DialogHeader>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle vista */}
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              type="button"
              variant={vista === "mes" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3"
              onClick={() => setVista("mes")}
            >
              Mes
            </Button>
            <Button
              type="button"
              variant={vista === "anio" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3"
              onClick={() => setVista("anio")}
            >
              Año
            </Button>
          </div>

          {/* Filtro de modelo */}
          <Select
            value={filtroModelo}
            onValueChange={(v) => setFiltroModelo(v as ModeloTipo | "TODOS")}
          >
            <SelectTrigger className="h-8 w-[220px]">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los modelos</SelectItem>
              {tiposConVentana.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {MODELO_LABEL[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Navegación temporal */}
          <div className="ml-auto flex items-center gap-1">
            {vista === "mes" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navegarMes(-1)}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[140px] text-center text-sm font-medium capitalize">
                  {MESES[mesVista]} {anioVista}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navegarMes(1)}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAnioVista((a) => a - 1)}
                  aria-label="Año anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[64px] text-center text-sm font-medium">
                  {anioVista}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAnioVista((a) => a + 1)}
                  aria-label="Año siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {vista === "mes" ? (
            <MesGrande
              anio={anioVista}
              mes={mesVista}
              ventanasEnDia={ventanasEnDia}
              limitesEnDia={limitesEnDia}
            />
          ) : (
            <VistaAnual
              anio={anioVista}
              ventanasEnDia={ventanasEnDia}
              limitesEnDia={limitesEnDia}
            />
          )}

          {/* Leyenda */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-sm bg-emerald-100 dark:bg-emerald-900/50" />
              Trimestrales (disponible)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-sm bg-sky-100 dark:bg-sky-900/50" />
              Anuales (disponible)
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="h-4 w-4 rounded-sm"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${COLOR_CSS.TRIMESTRALES} 0 50%, ${COLOR_CSS.ANUALES} 50% 100%)`,
                }}
              />
              Coinciden trimestral y anual
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-sm bg-emerald-100 ring-2 ring-emerald-600 dark:bg-emerald-900/50" />
              Fecha límite (último día)
            </span>
          </div>

          {/* Lista textual de ventanas visibles */}
          <div className="mt-5 border-t pt-4">
            <h4 className="mb-2 text-sm font-medium">Ventanas de presentación</h4>
            {listaOrdenada.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay ventanas de presentación para este filtro.
              </p>
            ) : (
              <ul className="space-y-1">
                {listaOrdenada.map((v) => (
                  <li
                    key={`${v.tipo}-${v.periodo}-${v.fin.getFullYear()}`}
                    className="flex items-baseline justify-between gap-4 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          v.grupo === "TRIMESTRALES" ? "bg-emerald-500" : "bg-sky-500",
                        )}
                      />
                      <span className="font-medium">{MODELO_LABEL[v.tipo]}</span>{" "}
                      <span className="text-muted-foreground">
                        · {PERIODO_LABEL[v.periodo]}
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      del {fechaCorta(v.inicio)} al {fechaCorta(v.fin)} {v.fin.getFullYear()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Estilo de una celda-día según las ventanas activas: clases de fondo cuando
 * hay un solo grupo, o un `style` con gradiente diagonal mitad-mitad cuando
 * coinciden ventanas de DOS grupos distintos (trimestral + anual) ese día.
 */
function estiloCelda(ventanas: Ventana[]): {
  className: string;
  style?: React.CSSProperties;
} {
  if (ventanas.length === 0) return { className: "" };
  const grupos = new Set(ventanas.map((v) => v.grupo));
  if (grupos.size >= 2) {
    // Día partido: mitad verde (trimestral) / mitad azul (anual), diagonal.
    return {
      className: "text-foreground",
      style: {
        backgroundImage: `linear-gradient(135deg, ${COLOR_CSS.TRIMESTRALES} 0 50%, ${COLOR_CSS.ANUALES} 50% 100%)`,
      },
    };
  }
  const grupo = [...grupos][0];
  return { className: COLOR_GRUPO[grupo].franja };
}

/** Clase de anillo del día límite (según el grupo del/los que vencen ese día). */
function anilloLimite(limites: Ventana[]): string {
  if (limites.length === 0) return "";
  const grupos = new Set(limites.map((v) => v.grupo));
  // Si vencen dos grupos el mismo día, prioriza el anillo trimestral (verde).
  const grupo: GrupoModelo = grupos.has("TRIMESTRALES") ? "TRIMESTRALES" : "ANUALES";
  return COLOR_GRUPO[grupo].limite;
}

// --- Utilidad: matriz de días (celdas) de un mes con relleno de otros meses ---
interface Celda {
  fecha: Date;
  enMes: boolean;
}

function celdasDelMes(anio: number, mes: number): Celda[] {
  const primero = new Date(anio, mes, 1);
  const offset = columnaLunes(primero.getDay()); // días de relleno antes del día 1
  const inicioRejilla = new Date(anio, mes, 1 - offset);

  const celdas: Celda[] = [];
  // 6 semanas × 7 días cubren cualquier mes.
  for (let i = 0; i < 42; i++) {
    const fecha = new Date(
      inicioRejilla.getFullYear(),
      inicioRejilla.getMonth(),
      inicioRejilla.getDate() + i,
    );
    celdas.push({ fecha, enMes: fecha.getMonth() === mes });
  }
  return celdas;
}

// --- Vista mensual grande ---
interface MesProps {
  anio: number;
  mes: number;
  ventanasEnDia: (d: Date) => Ventana[];
  limitesEnDia: (d: Date) => Ventana[];
}

function MesGrande({ anio, mes, ventanasEnDia, limitesEnDia }: MesProps) {
  const celdas = celdasDelMes(anio, mes);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="pb-1 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {celdas.map((celda, i) => {
          const dentro = celda.enMes ? ventanasEnDia(celda.fecha) : [];
          const limites = celda.enMes ? limitesEnDia(celda.fecha) : [];
          const esLimite = limites.length > 0;
          const esInicioFranja = dentro.some((v) => mismaFecha(v.inicio, celda.fecha));
          const esFinFranja = dentro.some((v) => mismaFecha(v.fin, celda.fecha));
          const est = estiloCelda(dentro);

          const titulo = esLimite
            ? "Vence: " +
              limites
                .map((v) => `${MODELO_LABEL[v.tipo]} ${PERIODO_LABEL[v.periodo]}`)
                .join(", ")
            : dentro.length > 0
              ? dentro.map((v) => `${MODELO_LABEL[v.tipo]} ${PERIODO_LABEL[v.periodo]}`).join(", ")
              : undefined;

          return (
            <div
              key={i}
              title={titulo}
              style={celda.enMes ? est.style : undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border border-transparent text-sm",
                !celda.enMes && "text-muted-foreground/40",
                celda.enMes && est.className,
                esInicioFranja && "rounded-l-lg",
                esFinFranja && "rounded-r-lg",
                esLimite && cn("font-bold", anilloLimite(limites)),
              )}
            >
              {celda.fecha.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Vista anual (12 mini-meses) ---
interface AnualProps {
  anio: number;
  ventanasEnDia: (d: Date) => Ventana[];
  limitesEnDia: (d: Date) => Ventana[];
}

function VistaAnual({ anio, ventanasEnDia, limitesEnDia }: AnualProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, mes) => (
        <MiniMes
          key={mes}
          anio={anio}
          mes={mes}
          ventanasEnDia={ventanasEnDia}
          limitesEnDia={limitesEnDia}
        />
      ))}
    </div>
  );
}

function MiniMes({ anio, mes, ventanasEnDia, limitesEnDia }: MesProps) {
  const celdas = celdasDelMes(anio, mes);

  return (
    <div className="rounded-lg border p-2">
      <div className="mb-1 text-center text-xs font-medium capitalize">
        {MESES[mes]}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="text-center text-[9px] font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {celdas.map((celda, i) => {
          const dentro = celda.enMes ? ventanasEnDia(celda.fecha) : [];
          const limites = celda.enMes ? limitesEnDia(celda.fecha) : [];
          const esLimite = limites.length > 0;
          const est = estiloCelda(dentro);

          const titulo = esLimite
            ? "Vence: " +
              limites
                .map((v) => `${MODELO_LABEL[v.tipo]} ${PERIODO_LABEL[v.periodo]}`)
                .join(", ")
            : dentro.length > 0
              ? dentro.map((v) => `${MODELO_LABEL[v.tipo]} ${PERIODO_LABEL[v.periodo]}`).join(", ")
              : undefined;

          return (
            <div
              key={i}
              title={titulo}
              style={celda.enMes ? est.style : undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-[3px] text-[10px] leading-none",
                !celda.enMes && "text-muted-foreground/30",
                celda.enMes && est.className,
                esLimite && cn("font-bold", anilloLimite(limites).replace("ring-2", "ring-1")),
              )}
            >
              {celda.enMes ? celda.fecha.getDate() : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
