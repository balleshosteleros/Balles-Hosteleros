"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
}

/**
 * El calendario de RRHH: un solo calendario donde se ve TODO a la vez —
 * vacaciones, bajas médicas, permisos, bajas de contrato y festivos— con la
 * cara de cada empleado y un aro del color de su tipo de ausencia.
 *
 * Antes había una pestaña por tipo, así que para saber quién faltaba un día
 * concreto había que ir mirándolas de una en una.
 */
export function CalendarioUnico({ ausencias, festivoEnFecha, onAnioChange, cargando }: Props) {
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
  function celdaDia(fecha: string, dia: number, opts?: { compacto?: boolean }) {
    const compacto = opts?.compacto ?? false;
    const delDia = porFecha.get(fecha) ?? [];
    const festivo = festivosOn ? festivoEnFecha(fecha) : null;
    const esHoy = fecha === hoyISO;
    const esFestivo = festivo?.tipo === "festivo";

    // Una persona sale una vez por día aunque tenga dos cosas ese día.
    const unicos: AusenciaCalendario[] = [];
    const vistos = new Set<string>();
    for (const a of delDia) {
      const clave = a.userId ?? a.id;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      unicos.push(a);
    }

    const tope = compacto ? 3 : 6;
    const mostrados = unicos.slice(0, tope);
    const resto = unicos.length - mostrados.length;

    return (
      <div
        className={cn(
          "relative rounded-md border bg-card p-1.5 transition-colors",
          compacto ? "min-h-[70px]" : "min-h-[104px]",
          esHoy && "ring-2 ring-primary ring-inset",
          esFestivo && "bg-amber-50/60 dark:bg-amber-950/20",
        )}
      >
        <div className="flex items-start justify-between">
          <span
            className={cn(
              "text-[11px] font-medium leading-none",
              esHoy ? "font-bold text-primary" : "text-foreground",
              esFestivo && !esHoy && "text-amber-700 dark:text-amber-500",
            )}
          >
            {dia}
          </span>
          {festivo && <MarcaFestivo info={festivo} />}
        </div>

        {unicos.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {mostrados.map((a) => (
              <AvatarAusencia key={a.id} ausencia={a} compacto={compacto} />
            ))}
            {resto > 0 && (
              <span className="self-center text-[10px] font-medium text-muted-foreground">
                +{resto}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  const modo = rango.mode;
  const mesesAPintar = mesesDelModo(modo, rango.anchor);

  return (
    <div className="space-y-4">
      {/* Navegación y modo de vista */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CalendarRangeToggle mode={rango.mode} onChange={rango.setMode} />
        <CalendarRangeNav
          label={rango.label}
          onPrev={rango.prev}
          onNext={rango.next}
          onToday={rango.goToToday}
          isToday={rango.isToday}
          minWidth={200}
        />
      </div>

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
          title="Días festivos"
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
            "grid gap-4",
            mesesAPintar.length === 1
              ? "grid-cols-1"
              : mesesAPintar.length <= 3
                ? "grid-cols-1 md:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          )}
        >
          {mesesAPintar.map(({ anio, mes }) => (
            <VistaMes
              key={`${anio}-${mes}`}
              anio={anio}
              mes={mes}
              conTitulo={mesesAPintar.length > 1}
              compacto={mesesAPintar.length > 1}
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
  );
}

/** Avatar con el aro del color de su tipo de ausencia. */
function AvatarAusencia({
  ausencia,
  compacto,
}: {
  ausencia: AusenciaCalendario;
  compacto: boolean;
}) {
  const color = colorDeSubtipo(ausencia.subtipo);
  const pendiente = ausencia.estado === "pendiente";
  const tam = compacto ? "h-5 w-5" : "h-6 w-6";

  return (
    <Popover>
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
          title={`${ausencia.empleadoNombre} · ${labelDeSubtipo(ausencia.subtipo)}`}
        >
          <EmpleadoAvatar
            nombre={ausencia.empleadoNombre}
            avatarUrl={ausencia.avatarUrl}
            claveColor={ausencia.userId ?? ausencia.empleadoNombre}
            className={tam}
            textoClassName={compacto ? "text-[8px]" : "text-[9px]"}
          />
        </button>
      </PopoverTrigger>
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
function MarcaFestivo({ info }: { info: FestivoInfo }) {
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
          <PartyPopper className={cn("h-3.5 w-3.5", esVispera && "opacity-60")} />
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

type CeldaFn = (fecha: string, dia: number, opts?: { compacto?: boolean }) => React.ReactNode;

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
  compacto,
}: {
  anio: number;
  mes: number; // 0-11
  celdaDia: CeldaFn;
  conTitulo: boolean;
  compacto: boolean;
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
        <p className="mb-1.5 text-sm font-semibold">{MESES[mes]}</p>
      )}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {compacto ? d[0] : d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((c, i) =>
          c.fecha ? (
            <div key={i}>{celdaDia(c.fecha, c.dia!, { compacto })}</div>
          ) : (
            <div key={i} className={compacto ? "min-h-[70px]" : "min-h-[104px]"} />
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
