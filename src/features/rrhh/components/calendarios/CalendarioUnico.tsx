"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PartyPopper } from "lucide-react";
import {
  CalendarRangeToggle,
  CalendarRangeNav,
} from "@/shared/components/calendar/CalendarRangeToggle";
import {
  useCalendarRange,
  type CalendarRangeMode,
} from "@/shared/components/calendar/calendar-range";
import { EmpleadoAvatar } from "@/features/rrhh/components/EmpleadoAvatar";
import {
  TIPOS_CALENDARIO,
  ESTADOS_CALENDARIO,
  colorDeSubtipo,
  labelDeSubtipo,
  type EstadoCalendario,
} from "@/features/rrhh/data/calendario-tipos";
import type { AusenciaCalendario } from "@/features/rrhh/actions/calendario-ausencias-actions";
import type { FestivoInfo } from "@/features/rrhh/hooks/useFestivos";
import type { SolicitudSubtipoAusencia } from "@/features/mi-panel/types";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Cuánto ocupa cada día según cuántos meses haya en pantalla.
 *  - normal: un mes solo, se ve todo cómodo.
 *  - compacto: trimestre o semestre.
 *  - mini: el año entero, que tiene que caber sin hacer scroll. Ahí solo caben
 *    2 caras por día; el resto se ve pulsando el "+N".
 */
type Densidad = "normal" | "compacto" | "mini";

const MEDIDAS: Record<
  Densidad,
  {
    alto: string;
    padding: string;
    numero: string;
    gap: string;
    margenTop: string;
    avatar: string;
    texto: string;
    tope: number;
  }
> = {
  normal: {
    alto: "min-h-[104px]",
    padding: "p-1.5",
    numero: "text-[11px]",
    gap: "gap-1",
    margenTop: "mt-1.5",
    avatar: "h-6 w-6",
    texto: "text-[9px]",
    tope: 6,
  },
  compacto: {
    alto: "min-h-[64px]",
    padding: "p-1",
    numero: "text-[10px]",
    gap: "gap-0.5",
    margenTop: "mt-1",
    avatar: "h-5 w-5",
    texto: "text-[8px]",
    tope: 3,
  },
  mini: {
    alto: "min-h-[34px]",
    padding: "p-0.5",
    numero: "text-[9px]",
    gap: "gap-0.5",
    margenTop: "mt-0.5",
    avatar: "h-4 w-4",
    texto: "text-[7px]",
    tope: 2,
  },
};

/** "YYYY-MM-DD" de una fecha local, sin pasar por UTC (que la desplazaría). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lunes = 0 … domingo = 6. */
function indexLunes(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

interface Props {
  ausencias: AusenciaCalendario[];
  festivoEnFecha: (fechaISO: string) => FestivoInfo | null;
  /** Se llama al cambiar de año, para recargar los datos. */
  onAnioChange?: (anio: number) => void;
  cargando?: boolean;
  /**
   * Dónde colocar el selector de vista y la navegación. Si se pasa, suben a la
   * cabecera de la página (junto al botón "Nuevo") y el calendario gana esa
   * fila; si no, se quedan encima del propio calendario.
   */
  slotControles?: HTMLElement | null;
}

/**
 * El calendario de RRHH: un solo calendario donde se ve TODO a la vez —
 * vacaciones, bajas médicas, permisos, bajas de contrato y festivos— con la
 * cara de cada empleado y un aro del color de su tipo de ausencia.
 *
 * Antes había una pestaña por tipo, así que para saber quién faltaba un día
 * concreto había que ir mirándolas de una en una.
 */
export function CalendarioUnico({ ausencias, festivoEnFecha, onAnioChange, cargando, slotControles }: Props) {
  const rango = useCalendarRange("MENSUAL");

  // Filtros: por tipo de ausencia y por estado. Todos activos de inicio.
  const [tiposOn, setTiposOn] = useState<Set<SolicitudSubtipoAusencia>>(
    () => new Set(TIPOS_CALENDARIO.map((t) => t.subtipo)),
  );
  const [estadosOn, setEstadosOn] = useState<Set<EstadoCalendario>>(
    () => new Set<EstadoCalendario>(["aprobada", "pendiente"]),
  );
  const [festivosOn, setFestivosOn] = useState(true);

  const anioVisible = rango.anchor.getFullYear();
  // Al cambiar de año hay que traer las ausencias de ese año.
  useMemo(() => {
    onAnioChange?.(anioVisible);
  }, [anioVisible, onAnioChange]);

  function toggleTipo(t: SolicitudSubtipoAusencia) {
    setTiposOn((prev) => {
      const s = new Set(prev);
      if (s.has(t)) s.delete(t); else s.add(t);
      return s;
    });
  }
  function toggleEstado(e: EstadoCalendario) {
    setEstadosOn((prev) => {
      const s = new Set(prev);
      if (s.has(e)) s.delete(e); else s.add(e);
      return s;
    });
  }

  const todosOn =
    tiposOn.size === TIPOS_CALENDARIO.length && estadosOn.size === 2 && festivosOn;

  function marcarTodos() {
    setTiposOn(new Set(TIPOS_CALENDARIO.map((t) => t.subtipo)));
    setEstadosOn(new Set<EstadoCalendario>(["aprobada", "pendiente"]));
    setFestivosOn(true);
  }
  function desmarcarTodos() {
    setTiposOn(new Set());
    setEstadosOn(new Set());
    setFestivosOn(false);
  }

  const visibles = useMemo(
    () =>
      ausencias.filter(
        (a) =>
          tiposOn.has(a.subtipo) &&
          estadosOn.has(a.estado as EstadoCalendario),
      ),
    [ausencias, tiposOn, estadosOn],
  );

  // Cada ausencia se reparte en todos los días que abarca, para poder pintar
  // quién falta cada día. La baja de contrato es la excepción: marca un único
  // día (el último trabajado), no el periodo de preaviso.
  const porFecha = useMemo(() => {
    const map = new Map<string, AusenciaCalendario[]>();
    const push = (clave: string, a: AusenciaCalendario) => {
      const lista = map.get(clave);
      if (lista) lista.push(a);
      else map.set(clave, [a]);
    };
    for (const a of visibles) {
      if (a.subtipo === "baja_contrato") {
        push(a.fechaFin ?? a.fechaInicio, a);
        continue;
      }
      // Mediodía para que el cambio de hora no desplace ningún día.
      const d = new Date(a.fechaInicio + "T12:00:00");
      const fin = new Date((a.fechaFin ?? a.fechaInicio) + "T12:00:00");
      // Una baja abierta se pinta hasta fin de año, no indefinidamente.
      const tope = new Date(`${anioVisible}-12-31T12:00:00`);
      const limite = fin > tope ? tope : fin;
      let guarda = 0;
      while (d <= limite && guarda++ < 400) {
        push(ymd(d), a);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [visibles, anioVisible]);

  const hoyISO = ymd(new Date());

  /** Una celda de día: número, marca de festivo y los avatares de quien falta. */
  function celdaDia(fecha: string, dia: number, opts?: { densidad?: Densidad }) {
    const densidad = opts?.densidad ?? "normal";
    const delDia = porFecha.get(fecha) ?? [];
    const festivo = festivosOn ? festivoEnFecha(fecha) : null;
    const esHoy = fecha === hoyISO;
    const esFestivo = festivo?.tipo === "festivo";
    const esVispera = festivo?.tipo === "vispera";

    // Una persona sale una vez por día aunque tenga dos cosas ese día.
    const unicos: AusenciaCalendario[] = [];
    const vistos = new Set<string>();
    for (const a of delDia) {
      const clave = a.userId ?? a.id;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      unicos.push(a);
    }

    const d = MEDIDAS[densidad];
    const mostrados = unicos.slice(0, d.tope);
    const resto = unicos.length - mostrados.length;

    return (
      <div
        className={cn(
          "relative rounded-md border bg-card transition-colors",
          d.alto,
          d.padding,
          esHoy && "ring-2 ring-primary ring-inset",
          // El festivo se tiñe; la víspera, más flojo. Antes la víspera se
          // quedaba igual que un día normal y parecía que unos festivos se
          // pintaban y otros no.
          esFestivo && "border-amber-300/70 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/25",
          esVispera && "bg-amber-50/40 dark:bg-amber-950/10",
        )}
      >
        <div className="flex items-start justify-between gap-0.5">
          <span
            className={cn(
              "font-medium leading-none",
              d.numero,
              esHoy ? "font-bold text-primary" : "text-foreground",
              esFestivo && !esHoy && "font-bold text-amber-700 dark:text-amber-500",
              esVispera && !esHoy && "text-amber-600/80 dark:text-amber-600",
            )}
          >
            {dia}
          </span>
          {festivo && <MarcaFestivo info={festivo} mini={densidad === "mini"} />}
        </div>

        {unicos.length > 0 && (
          <div className={cn("flex flex-wrap items-center", d.gap, d.margenTop)}>
            {mostrados.map((a) => (
              <AvatarAusencia key={a.id} ausencia={a} densidad={densidad} />
            ))}
            {resto > 0 && <MasDelDia fecha={fecha} restantes={unicos.slice(d.tope)} densidad={densidad} />}
          </div>
        )}
      </div>
    );
  }

  const modo = rango.mode;
  const mesesAPintar = mesesDelModo(modo, rango.anchor);
  // Cuantos más meses en pantalla, más pequeño el día. El año entero va a
  // "mini" para que los 12 meses quepan de una vez.
  const densidadMeses: Densidad =
    mesesAPintar.length >= 12 ? "mini" : mesesAPintar.length > 1 ? "compacto" : "normal";

  // El selector de vista y la navegación van arriba del todo, en la misma fila
  // que el botón de "Nuevo": así el calendario empieza antes y el año entero
  // cabe de una sola vez, sin gastar una fila propia.
  const controles = (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRangeToggle mode={rango.mode} onChange={rango.setMode} />
      <CalendarRangeNav
        label={rango.label}
        onPrev={rango.prev}
        onNext={rango.next}
        onToday={rango.goToToday}
        isToday={rango.isToday}
        minWidth={150}
      />
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-3">
      {slotControles ? createPortal(controles, slotControles) : controles}

      {/* Filtros: qué se ve en el calendario */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
        {TIPOS_CALENDARIO.map((t) => {
          const on = tiposOn.has(t.subtipo);
          return (
            <button
              key={t.subtipo}
              type="button"
              onClick={() => toggleTipo(t.subtipo)}
              title={t.ayuda}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                on ? "bg-card" : "bg-transparent text-muted-foreground opacity-50",
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-background"
                style={{ backgroundColor: t.color, boxShadow: `0 0 0 2px ${t.color}40` }}
              />
              {t.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setFestivosOn((v) => !v)}
          title="Festivos y vísperas. El festivo va en color; la víspera, más flojo."
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            festivosOn ? "bg-card" : "bg-transparent text-muted-foreground opacity-50",
          )}
        >
          <PartyPopper className="h-3.5 w-3.5 text-amber-600" />
          Festivos
        </button>

        <span className="mx-1 h-4 w-px bg-border" />

        {ESTADOS_CALENDARIO.map((e) => {
          const on = estadosOn.has(e.estado);
          return (
            <button
              key={e.estado}
              type="button"
              onClick={() => toggleEstado(e.estado)}
              title={e.ayuda}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                on ? "bg-card" : "bg-transparent text-muted-foreground opacity-50",
                e.estado === "pendiente" && on && "border-dashed",
              )}
            >
              {e.label}
            </button>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 text-xs"
          onClick={todosOn ? desmarcarTodos : marcarTodos}
        >
          {todosOn ? "Quitar todo" : "Ver todo"}
        </Button>
      </div>

      {cargando ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : modo === "DIARIO" ? (
        <VistaDia fecha={ymd(rango.anchor)} celdaDia={celdaDia} />
      ) : modo === "SEMANAL" ? (
        <VistaSemana inicio={rango.range.start} celdaDia={celdaDia} />
      ) : (
        <div
          className={cn(
            "grid",
            // El año entero va apretado (4×3) para que quepa sin scroll.
            densidadMeses === "mini"
              ? "gap-x-3 gap-y-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
              : mesesAPintar.length === 1
                ? "gap-4 grid-cols-1"
                : "gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {mesesAPintar.map(({ anio, mes }) => (
            <VistaMes
              key={`${anio}-${mes}`}
              anio={anio}
              mes={mes}
              conTitulo={mesesAPintar.length > 1}
              densidad={densidadMeses}
              celdaDia={celdaDia}
            />
          ))}
        </div>
      )}

      {!cargando && visibles.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No hay nada que mostrar con los filtros elegidos.
        </p>
      )}
    </div>
    </TooltipProvider>
  );
}

/**
 * El "+N" de un día con más gente de la que cabe. Al pulsarlo se despliegan
 * todos los que faltan ese día, con su nombre y su tipo.
 */
function MasDelDia({
  fecha,
  restantes,
  densidad,
}: {
  fecha: string;
  restantes: AusenciaCalendario[];
  densidad: Densidad;
}) {
  const d = MEDIDAS[densidad];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center rounded-full border border-dashed bg-muted/60 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            d.avatar,
            d.texto,
          )}
          title={`Ver ${restantes.length} más`}
        >
          +{restantes.length}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="px-1 pb-1.5 text-xs font-semibold text-muted-foreground">
          {formatoCorto(fecha)} · {restantes.length} más
        </p>
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {restantes.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md px-1 py-1">
              <span
                className="shrink-0 rounded-full"
                style={{
                  boxShadow:
                    a.estado === "pendiente"
                      ? `0 0 0 2px hsl(var(--background)), 0 0 0 3px ${colorDeSubtipo(a.subtipo)}80`
                      : `0 0 0 2px hsl(var(--background)), 0 0 0 3px ${colorDeSubtipo(a.subtipo)}`,
                }}
              >
                <EmpleadoAvatar
                  nombre={a.empleadoNombre}
                  avatarUrl={a.avatarUrl}
                  claveColor={a.userId ?? a.empleadoNombre}
                  className="h-6 w-6"
                  textoClassName="text-[9px]"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{a.empleadoNombre}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {labelDeSubtipo(a.subtipo)}
                  {a.estado === "pendiente" ? " · pendiente" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Avatar con el aro del color de su tipo de ausencia. */
function AvatarAusencia({
  ausencia,
  densidad,
}: {
  ausencia: AusenciaCalendario;
  densidad: Densidad;
}) {
  const color = colorDeSubtipo(ausencia.subtipo);
  const pendiente = ausencia.estado === "pendiente";
  const d = MEDIDAS[densidad];

  return (
    <Popover>
      {/* Con pasar el ratón ya se ve de quién es; pulsando, el detalle. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="rounded-full transition-transform hover:scale-110"
              // El aro dice de qué tipo es; si está sin decidir, se ve calado.
              style={{
                boxShadow: pendiente
                  ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${color}80`
                  : `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${color}`,
              }}
            >
              <EmpleadoAvatar
                nombre={ausencia.empleadoNombre}
                avatarUrl={ausencia.avatarUrl}
                claveColor={ausencia.userId ?? ausencia.empleadoNombre}
                className={d.avatar}
                textoClassName={d.texto}
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <span className="font-medium">{ausencia.empleadoNombre}</span>
          <span className="opacity-70"> · {labelDeSubtipo(ausencia.subtipo)}</span>
          {pendiente && <span className="opacity-70"> (pendiente)</span>}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-start gap-2.5">
          <EmpleadoAvatar
            nombre={ausencia.empleadoNombre}
            avatarUrl={ausencia.avatarUrl}
            claveColor={ausencia.userId ?? ausencia.empleadoNombre}
            className="h-9 w-9"
            textoClassName="text-xs"
          />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold">{ausencia.empleadoNombre}</p>
            <p className="text-xs text-muted-foreground">{ausencia.departamento}</p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: color }}
              >
                {labelDeSubtipo(ausencia.subtipo)}
              </span>
              {pendiente && (
                <Badge variant="outline" className="border-dashed text-[11px]">
                  Pendiente
                </Badge>
              )}
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              {ausencia.subtipo === "baja_contrato"
                ? `Último día: ${formatoCorto(ausencia.fechaFin ?? ausencia.fechaInicio)}`
                : ausencia.fechaFin
                  ? `Del ${formatoCorto(ausencia.fechaInicio)} al ${formatoCorto(ausencia.fechaFin)}${ausencia.dias ? ` · ${ausencia.dias} días` : ""}`
                  : `Desde ${formatoCorto(ausencia.fechaInicio)} · sin fecha de fin`}
            </p>
            {ausencia.motivo && (
              <p className="pt-0.5 text-xs italic text-muted-foreground">“{ausencia.motivo}”</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Marca de festivo en la esquina del día. */
function MarcaFestivo({ info, mini }: { info: FestivoInfo; mini?: boolean }) {
  const esVispera = info.tipo === "vispera";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded p-0.5 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40",
            esVispera ? "text-amber-500/70" : "text-amber-600",
          )}
          title={esVispera ? `Víspera de ${info.festivo.nombre}` : info.festivo.nombre}
        >
          <PartyPopper className={cn(mini ? "h-2.5 w-2.5" : "h-3.5 w-3.5", esVispera && "opacity-60")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <p className="text-sm font-semibold">{info.festivo.nombre}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {esVispera ? "Víspera de festivo" : "Festivo"}
          {info.festivo.region ? ` · ${info.festivo.region}` : ""}
        </p>
      </PopoverContent>
    </Popover>
  );
}

type CeldaFn = (fecha: string, dia: number, opts?: { densidad?: Densidad }) => React.ReactNode;

function VistaDia({ fecha, celdaDia }: { fecha: string; celdaDia: CeldaFn }) {
  const d = new Date(fecha + "T12:00:00");
  return (
    <div className="mx-auto max-w-sm">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {DIAS_SEMANA[indexLunes(d)]}
      </p>
      {celdaDia(fecha, d.getDate())}
    </div>
  );
}

function VistaSemana({ inicio, celdaDia }: { inicio: Date; celdaDia: CeldaFn }) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
  return (
    <>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d, i) => (
          <div key={i}>{celdaDia(ymd(d), d.getDate())}</div>
        ))}
      </div>
    </>
  );
}

function VistaMes({
  anio,
  mes,
  celdaDia,
  conTitulo,
  densidad,
}: {
  anio: number;
  mes: number; // 0-11
  celdaDia: CeldaFn;
  conTitulo: boolean;
  densidad: Densidad;
}) {
  const primerDia = new Date(anio, mes, 1);
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  const offset = indexLunes(primerDia);

  const celdas: { fecha: string | null; dia: number | null }[] = [];
  for (let i = 0; i < offset; i++) celdas.push({ fecha: null, dia: null });
  for (let d = 1; d <= totalDias; d++) {
    celdas.push({ fecha: ymd(new Date(anio, mes, d)), dia: d });
  }
  // Cerrar la última semana, para que el mes no quede cojo.
  while (celdas.length % 7 !== 0) celdas.push({ fecha: null, dia: null });

  return (
    <div>
      {conTitulo && (
        <p className={cn("font-semibold", densidad === "mini" ? "mb-1 text-xs" : "mb-1.5 text-sm")}>
          {MESES[mes]}
        </p>
      )}
      <div className={cn("mb-1 grid grid-cols-7", densidad === "mini" ? "gap-px" : "gap-1")}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {densidad === "normal" ? d : d[0]}
          </div>
        ))}
      </div>
      <div className={cn("grid grid-cols-7", densidad === "mini" ? "gap-px" : "gap-1")}>
        {celdas.map((c, i) =>
          c.fecha ? (
            <div key={i}>{celdaDia(c.fecha, c.dia!, { densidad })}</div>
          ) : (
            <div key={i} className={MEDIDAS[densidad].alto} />
          ),
        )}
      </div>
    </div>
  );
}

/** Qué meses toca pintar según el modo de vista. */
function mesesDelModo(modo: CalendarRangeMode, anchor: Date): { anio: number; mes: number }[] {
  const anio = anchor.getFullYear();
  const mes = anchor.getMonth();
  const cuantos = modo === "TRIMESTRAL" ? 3 : modo === "SEMESTRAL" ? 6 : modo === "ANUAL" ? 12 : 1;
  if (cuantos === 1) return [{ anio, mes }];
  // Trimestre/semestre/año naturales: empiezan en su primer mes, no en el actual.
  const inicio = modo === "ANUAL" ? 0 : Math.floor(mes / cuantos) * cuantos;
  return Array.from({ length: cuantos }, (_, i) => {
    const m = inicio + i;
    return { anio: anio + Math.floor(m / 12), mes: m % 12 };
  });
}

function formatoCorto(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
