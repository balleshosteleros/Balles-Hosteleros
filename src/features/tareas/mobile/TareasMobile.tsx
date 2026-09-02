"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Flame, PlayCircle, CalendarClock, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import {
  listTareasMias,
  syncTareasCronograma,
  syncTareasCronogramaRange,
  toggleTareaHecha,
  type TareaRow,
} from "@/features/tareas/actions/tareas-actions";

type Periodo = "dia" | "semana" | "mes";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangoFechas(periodo: Periodo): string[] {
  const hoy = new Date();
  if (periodo === "dia") return [ymd(hoy)];
  if (periodo === "semana") {
    const dow = (hoy.getDay() + 6) % 7; // lunes = 0
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return ymd(d);
    });
  }
  // mes
  const año = hoy.getFullYear();
  const mes = hoy.getMonth();
  const dias = new Date(año, mes + 1, 0).getDate();
  return Array.from({ length: dias }, (_, i) => ymd(new Date(año, mes, i + 1)));
}

const PERIODO_LABEL: Record<Periodo, string> = { dia: "Día", semana: "Semana", mes: "Mes" };

/** CUÁNDO toca la tarea, en texto corto para la ficha. */
function cuandoTexto(fecha: string, periodo: Periodo): string {
  const d = new Date(fecha + "T00:00:00");
  if (periodo === "dia") return "Hoy";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
}

/** Duración prevista: 90 → "1 h 30 min"; 45 → "45 min". */
function duracionTexto(min: number | null): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function TareasMobile() {
  const [tareas, setTareas] = useState<TareaRow[]>([]);
  const [rol, setRol] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const fechas = useMemo(() => rangoFechas(periodo), [periodo]);
  const fechasSet = useMemo(() => new Set(fechas), [fechas]);

  const cargar = useCallback(
    async (spinner = false) => {
      if (spinner) setRefrescando(true);
      // Sembrar las tareas del periodo desde el cronograma (por rol/departamento).
      if (periodo === "dia") {
        const seed = await syncTareasCronograma();
        if (seed.ok) setRol(seed.data.rol);
      } else {
        await syncTareasCronogramaRange(fechas);
        const seed = await syncTareasCronograma();
        if (seed.ok) setRol(seed.data.rol);
      }
      const list = await listTareasMias();
      if (list.ok) setTareas(list.data);
      setCargando(false);
      setRefrescando(false);
    },
    [periodo, fechas],
  );

  useEffect(() => {
    setCargando(true);
    cargar(false);
  }, [cargar]);

  const tareasPeriodo = useMemo(
    () => tareas.filter((t) => t.tipo === "cronograma" && fechasSet.has(t.fecha)),
    [tareas, fechasSet],
  );

  const hechas = tareasPeriodo.filter((t) => t.hecha).length;
  const total = tareasPeriodo.length;
  const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;

  // Agrupar por puesto/departamento (ref_rol).
  const grupos = useMemo(() => {
    const m = new Map<string, TareaRow[]>();
    for (const t of tareasPeriodo) {
      const k = t.ref_rol || rol || "General";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo));
    }
    return Array.from(m.entries());
  }, [tareasPeriodo, rol]);

  const handleToggle = async (id: string) => {
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, hecha: !t.hecha } : t)));
    const res = await toggleTareaHecha(id);
    if (!res.ok) {
      toast.error("No se pudo guardar");
      setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, hecha: !t.hecha } : t)));
    }
  };

  return (
    <div className="space-y-3">
      {/* Progreso + filtro de periodo (pequeño) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold tabular-nums">
            {hechas}
            <span className="text-muted-foreground">/{total}</span>
          </div>
          {pct === 100 && total > 0 && <Flame className="h-5 w-5 text-amber-500" />}
        </div>
        <div className="flex rounded-full border bg-muted/40 p-0.5 text-[11px]">
          {(["dia", "semana", "mes"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium transition-colors",
                periodo === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Barra de progreso */}
      {total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {cargando ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : !rol ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Aún no tienes un rol asignado. Pide a Dirección que te asigne uno para ver tus tareas.
        </p>
      ) : total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No tienes tareas de cronograma para {PERIODO_LABEL[periodo].toLowerCase()}. ¡Buen trabajo!
        </p>
      ) : (
        <div className="space-y-4">
          {grupos.map(([puesto, items]) => (
            <div key={puesto} className="space-y-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {puesto}
              </p>
              <ul className="space-y-1.5">
                {items.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => handleToggle(t.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border border-border/50 bg-card px-3 py-2.5 text-left active:bg-muted/40",
                        t.hecha && "bg-emerald-50/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          t.hecha
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {t.hecha && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* QUÉ: la tarea y su detalle */}
                        <span
                          className={cn(
                            "block text-sm font-medium leading-snug",
                            t.hecha && "text-muted-foreground line-through",
                          )}
                        >
                          {t.titulo}
                        </span>
                        {t.descripcion && (
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                            {t.descripcion}
                          </span>
                        )}

                        {/* CUÁNDO y CÓMO: siempre visibles bajo la tarea */}
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <CalendarClock className="h-3 w-3 shrink-0" />
                            {cuandoTexto(t.fecha, periodo)}
                          </span>

                          {duracionTexto(t.duracion_minutos) && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3 shrink-0" />
                              {duracionTexto(t.duracion_minutos)}
                            </span>
                          )}

                          {t.link_url ? (
                            <a
                              href={t.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                            >
                              <PlayCircle className="h-3 w-3 shrink-0" />
                              Cómo se hace
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                              <PlayCircle className="h-3 w-3 shrink-0" />
                              Sin guía
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <button
            onClick={() => cargar(true)}
            disabled={refrescando}
            className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground active:bg-muted"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refrescando && "animate-spin")} />
            Refrescar
          </button>
        </div>
      )}
    </div>
  );
}
