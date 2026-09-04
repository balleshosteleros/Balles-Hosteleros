"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, AlertCircle, Info } from "lucide-react";
import { getMiCalendarioMes } from "@/features/mi-panel/actions/mi-panel-actions";
import { useFestivos } from "@/features/rrhh/hooks/useFestivos";
import type { DiaCalendario } from "@/features/mi-panel/types";
import { formatHorasDecimal } from "@/shared/lib/timeUtils";
import { cn } from "@/lib/utils";

/*
  Calendario de la app móvil.

  Antes esta pantalla montaba `MiCalendarioView` (la vista de ordenador) tal
  cual, y en un teléfono no se leía nada: siete columnas de escritorio metidas
  en 360px dejaban celdas de ~45px con una etiqueta de texto ("TRABAJADO") y un
  horario dentro, todo a 8-9px. Aquí la rejilla solo lleva el NÚMERO del día,
  grande, y el estado se ve por el color del propio día; el detalle (horario,
  festivo, extras) se abre al tocar, debajo del mes, con letra normal.
*/

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TIPO_FESTIVO_LABEL: Record<string, string> = {
  nacional: "Nacional",
  autonomico: "Autonómico",
  local: "Local",
};

function indexLunes(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

type EstadoDia = "vacaciones" | "baja" | "permiso" | "hoy" | "trabajado" | "trabajar" | "libre" | "sinDato";

interface DiaInfo {
  estado: EstadoDia;
  badgeText: string;
  horario: string;
}

function getDiaInfo(fecha: string, info: DiaCalendario | undefined, todayKey: string): DiaInfo {
  const isToday = fecha === todayKey;
  const isPast = fecha < todayKey;
  const isFuture = fecha > todayKey;

  if (info?.ausencia === "vacaciones") return { estado: "vacaciones", badgeText: "Vacaciones", horario: "—" };
  if (info?.ausencia === "baja_medica") return { estado: "baja", badgeText: "Baja médica", horario: "—" };
  if (info?.ausencia === "permiso") return { estado: "permiso", badgeText: "Permiso", horario: "—" };

  // Turno REAL del empleado ese día (turnos + patrones), calculado en servidor.
  // Mientras no llega, no se inventa nada: el día se queda sin horario en vez
  // de enseñar uno falso.
  const previsto = info?.horarioPrevisto ?? null;
  const trabajaPrevisto = previsto?.trabaja ?? false;
  const textoPrevisto = previsto?.texto ? previsto.texto : "—";

  // Hoy sigue marcándose en amarillo aunque no haya turno —ubicarse en el mes
  // es útil—, pero entonces el texto lo dice en vez de dejar una raya muda.
  const textoHoy = !previsto && !info?.fichado ? "Sin turno asignado" : textoPrevisto;
  const horarioFichado = info?.fichado
    ? `${formatHorasDecimal(info.horasFichaje)} fichadas`
    : textoHoy;

  if (isToday) return { estado: "hoy", badgeText: "Hoy", horario: horarioFichado };
  if (info?.fichado || (trabajaPrevisto && isPast)) return { estado: "trabajado", badgeText: "Trabajado", horario: horarioFichado };
  if (trabajaPrevisto && isFuture) return { estado: "trabajar", badgeText: "Trabajar", horario: textoPrevisto };
  // Sin turno cargado no se afirma que libras: un cuadrante aún sin publicar
  // no es un día libre, y pintarlo igual que uno sería inventárselo.
  if (!previsto) return { estado: "sinDato", badgeText: "Sin turno", horario: "Aún sin publicar" };
  return { estado: "libre", badgeText: "Libre", horario: "—" };
}

/**
 * Colores por estado. `celda` pinta el día en la rejilla y `punto` es la marca
 * sólida que se usa en la leyenda y en la ficha del día abierto.
 */
const ESTILOS: Record<EstadoDia, { celda: string; numero: string; punto: string; texto: string }> = {
  vacaciones: { celda: "bg-blue-50 border-blue-200",       numero: "text-blue-900",    punto: "bg-blue-500",    texto: "text-blue-700" },
  baja:       { celda: "bg-rose-50 border-rose-200",       numero: "text-rose-900",    punto: "bg-rose-500",    texto: "text-rose-700" },
  permiso:    { celda: "bg-violet-50 border-violet-200",   numero: "text-violet-900",  punto: "bg-violet-500",  texto: "text-violet-700" },
  hoy:        { celda: "bg-yellow-100 border-yellow-400",  numero: "text-yellow-900",  punto: "bg-yellow-500",  texto: "text-yellow-800" },
  trabajado:  { celda: "bg-emerald-50 border-emerald-200", numero: "text-emerald-900", punto: "bg-emerald-500", texto: "text-emerald-700" },
  trabajar:   { celda: "bg-orange-50 border-orange-200",   numero: "text-orange-900",  punto: "bg-orange-500",  texto: "text-orange-700" },
  libre:      { celda: "bg-slate-50 border-slate-200",     numero: "text-slate-500",   punto: "bg-slate-400",   texto: "text-slate-500" },
  sinDato:    { celda: "bg-white border-dashed border-slate-300", numero: "text-slate-400", punto: "bg-slate-300", texto: "text-slate-400" },
};

const LEYENDA: { estado: EstadoDia; texto: string }[] = [
  { estado: "trabajado", texto: "Trabajado" },
  { estado: "hoy", texto: "Hoy" },
  { estado: "trabajar", texto: "Trabajar" },
  { estado: "libre", texto: "Libre" },
  { estado: "vacaciones", texto: "Vacaciones" },
  { estado: "baja", texto: "Baja médica" },
  { estado: "permiso", texto: "Permiso" },
  { estado: "sinDato", texto: "Sin turno" },
];

export function CalendarioMobile() {
  const hoy = new Date();
  const todayKey = ymd(hoy);

  // El mes que se está viendo, siempre como día 1 (evita el clásico salto de
  // "31 de enero + 1 mes" al navegar).
  const [mesActual, setMesActual] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [dias, setDias] = useState<DiaCalendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccion, setSeleccion] = useState<string | null>(todayKey);

  const { festivoEnFecha } = useFestivos(mesActual.getFullYear());

  const anio = mesActual.getFullYear();
  const mes = mesActual.getMonth() + 1;

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getMiCalendarioMes(anio, mes).then((r) => {
      if (cancel) return;
      setDias(r.ok ? r.data : []);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [anio, mes]);

  const map = useMemo(() => {
    const m = new Map<string, DiaCalendario>();
    for (const d of dias) m.set(d.fecha, d);
    return m;
  }, [dias]);

  const celdas = useMemo(() => {
    const primerDia = new Date(anio, mes - 1, 1);
    const totalDias = new Date(anio, mes, 0).getDate();
    const offsetIni = indexLunes(primerDia);
    const out: { fecha: string | null; dia: number | null }[] = [];
    for (let i = 0; i < offsetIni; i++) out.push({ fecha: null, dia: null });
    for (let d = 1; d <= totalDias; d++) {
      out.push({ fecha: ymd(new Date(anio, mes - 1, d)), dia: d });
    }
    while (out.length % 7 !== 0) out.push({ fecha: null, dia: null });
    return out;
  }, [anio, mes]);

  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;

  function cambiarMes(delta: number) {
    setMesActual((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setSeleccion(null);
  }

  function irAHoy() {
    setMesActual(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    setSeleccion(todayKey);
  }

  return (
    <div className="space-y-3">
      {/* Navegador de mes: mismos botones de 44px que el resto de la app móvil */}
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-2 py-1.5">
        <button
          type="button"
          onClick={() => cambiarMes(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted active:scale-95"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-base font-semibold leading-tight">{MESES[mes - 1]}</p>
          <p className="text-xs text-muted-foreground">{anio}</p>
        </div>
        <button
          type="button"
          onClick={() => cambiarMes(1)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted active:scale-95"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {!esMesActual && (
        <button
          type="button"
          onClick={irAHoy}
          className="w-full rounded-xl border border-border/60 bg-card py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted active:scale-[0.99]"
        >
          Volver a hoy
        </button>
      )}

      {/* Rejilla del mes */}
      <div className="rounded-2xl border border-border/60 bg-card p-2.5">
        <div className="mb-1.5 grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="py-1 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Cargando…
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {celdas.map((c, i) => {
              if (!c.fecha) return <div key={i} className="aspect-square" />;
              const info = map.get(c.fecha);
              const di = getDiaInfo(c.fecha, info, todayKey);
              const est = ESTILOS[di.estado];
              const festivo = festivoEnFecha(c.fecha);
              const activo = seleccion === c.fecha;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSeleccion(activo ? null : c.fecha)}
                  aria-label={`${c.dia} de ${MESES[mes - 1]} · ${di.badgeText}`}
                  aria-pressed={activo}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-xl border transition-transform active:scale-95",
                    est.celda,
                    activo && "ring-2 ring-primary ring-offset-1",
                  )}
                >
                  <span className={cn("text-base font-semibold leading-none", est.numero)}>
                    {c.dia}
                  </span>
                  {festivo && (
                    <span
                      className={cn(
                        "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
                        festivo.tipo === "festivo" ? "bg-rose-500" : "bg-sky-500",
                      )}
                    />
                  )}
                  {info?.trabajoExtra === "horas_extras" && (
                    <span className="absolute bottom-1 left-1/2 h-1 w-3 -translate-x-1/2 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Ficha del día tocado */}
      {seleccion && !loading && (
        <DetalleDia
          fecha={seleccion}
          info={map.get(seleccion)}
          todayKey={todayKey}
          festivo={festivoEnFecha(seleccion)}
        />
      )}

      {/* Leyenda */}
      <div className="rounded-2xl border border-border/60 bg-card p-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {LEYENDA.map((l) => (
            <div key={l.estado} className="flex items-center gap-2 text-xs text-muted-foreground">
              {/* "Sin turno" se dibuja como el propio día: recuadro vacío a
                  rayas. Con un cuadradito gris más se confundía con "Libre",
                  que es justo lo contrario (ahí SÍ sabemos que no trabajas). */}
              {l.estado === "sinDato" ? (
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-dashed border-slate-400 bg-transparent" />
              ) : (
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", ESTILOS[l.estado].punto)} />
              )}
              {l.texto}
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
            Festivo
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
            Víspera festivo
          </div>
        </div>
      </div>
    </div>
  );
}

function DetalleDia({
  fecha,
  info,
  todayKey,
  festivo,
}: {
  fecha: string;
  info: DiaCalendario | undefined;
  todayKey: string;
  festivo: ReturnType<ReturnType<typeof useFestivos>["festivoEnFecha"]>;
}) {
  const [yy, mm, dd] = fecha.split("-").map(Number);
  const di = getDiaInfo(fecha, info, todayKey);
  const est = ESTILOS[di.estado];
  const diaSemana = new Date(yy, mm - 1, dd).toLocaleDateString("es-ES", { weekday: "long" });

  return (
    <div className={cn("rounded-2xl border p-4", est.celda)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs capitalize text-muted-foreground">{diaSemana}</p>
          {/* Fecha en día/mes/año, como en todo el software */}
          <p className="text-lg font-semibold leading-tight">
            {String(dd).padStart(2, "0")}/{String(mm).padStart(2, "0")}/{yy}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white", est.punto)}>
          {di.badgeText}
        </span>
      </div>

      <p className={cn("mt-3 text-base font-medium", est.texto)}>{di.horario}</p>

      {info?.trabajoExtra === "horas_extras" && (
        <p className="mt-1.5 text-sm font-medium text-amber-700">Con horas extras</p>
      )}

      {festivo && (
        <div className="mt-3 flex items-start gap-2 border-t border-black/5 pt-3">
          {festivo.tipo === "festivo"
            ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            : <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />}
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {festivo.tipo === "festivo" ? festivo.festivo.nombre : `Víspera de ${festivo.festivo.nombre}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {TIPO_FESTIVO_LABEL[festivo.festivo.tipo] ?? festivo.festivo.tipo}
              {festivo.festivo.region ? ` · ${festivo.festivo.region}` : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
