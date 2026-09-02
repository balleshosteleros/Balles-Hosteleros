"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Clock, Loader2 } from "lucide-react";
import { getMiFichajeHoy } from "@/features/mi-panel/actions/mi-panel-actions";
import type { MiFichajeHoy } from "@/features/mi-panel/types";
import { formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { BigClockButton } from "./BigClockButton";
import type { JornadaHoy } from "../lib/mobile-inicio-data";

type Estado = "sin-fichar" | "trabajando" | "pausa" | "completado";

function deriveEstado(f: MiFichajeHoy | null): Estado {
  if (!f) return "sin-fichar";
  const e = (f.estado || "").toLowerCase();
  if (e === "trabajando") return "trabajando";
  if (e === "pausa") return "pausa";
  if (e === "completado" || f.horaSalida) return "completado";
  return "sin-fichar";
}

function formatoTiempo(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function textoJornada(j: JornadaHoy): { libra: boolean; texto: string } {
  switch (j.tipo) {
    case "libra":
      return { libra: true, texto: "Hoy libras" };
    case "trabaja": {
      const v = j.tramos
        .map((t) => `${t.inicio}–${t.fin}`)
        .join(" · ");
      return { libra: false, texto: v ? `Hoy trabajas · ${v}` : "Hoy trabajas" };
    }
    case "flexible":
      return { libra: false, texto: `Hoy trabajas · ${j.horas}h flexibles` };
    default:
      return { libra: false, texto: "Tu jornada de hoy" };
  }
}

/** Minutos del día (0–1439) desde "HH:MM". null si no es válido. */
function hhmmAMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Franja del turno de hoy en minutos, resolviendo el cruce de medianoche: el
 * fin de un turno que acaba de madrugada se expresa como minuto >1440 para que
 * la barra avance de forma continua.
 */
function franjaDelDia(
  tramos: { inicio: string; fin: string }[],
): { inicio: number; fin: number; bloques: { desde: number; hasta: number }[] } | null {
  const bloques: { desde: number; hasta: number }[] = [];
  for (const tr of tramos) {
    const ini = hhmmAMin(tr.inicio);
    let fin = hhmmAMin(tr.fin);
    if (ini == null || fin == null) continue;
    if (fin <= ini) fin += 1440;
    bloques.push({ desde: ini, hasta: fin });
  }
  if (bloques.length === 0) return null;
  const inicio = Math.min(...bloques.map((b) => b.desde));
  const fin = Math.max(...bloques.map((b) => b.hasta));
  return { inicio, fin, bloques };
}

/**
 * Barra del turno de hoy: pinta la franja horaria prevista y una marca con la
 * posición actual, para que el empleado vea de un vistazo cuándo le toca fichar
 * y cuánto lleva de jornada.
 */
function BarraTurno({
  tramos,
  ahoraMin,
}: {
  tramos: { inicio: string; fin: string }[];
  ahoraMin: number;
}) {
  const franja = franjaDelDia(tramos);
  if (!franja) return null;

  const { inicio, fin, bloques } = franja;
  const total = fin - inicio;
  if (total <= 0) return null;

  // La marca de "ahora" también se corrige por medianoche: de madrugada, el
  // reloj vuelve a 0 pero la jornada sigue siendo la del día anterior.
  const ahoraAjustado = ahoraMin < inicio ? ahoraMin + 1440 : ahoraMin;
  const dentro = ahoraAjustado >= inicio && ahoraAjustado <= fin;
  const pct = dentro ? ((ahoraAjustado - inicio) / total) * 100 : null;

  const etiqueta = (min: number) => {
    const n = ((Math.round(min) % 1440) + 1440) % 1440;
    return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  };

  return (
    <div className="px-4 pb-2 pt-1">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        {bloques.map((b) => (
          <div
            key={`${b.desde}-${b.hasta}`}
            className="absolute inset-y-0 rounded-full bg-primary/25"
            style={{
              left: `${((b.desde - inicio) / total) * 100}%`,
              width: `${((b.hasta - b.desde) / total) * 100}%`,
            }}
          />
        ))}
        {pct !== null && (
          <div
            className="absolute inset-y-0 w-0.5 rounded-full bg-primary"
            style={{ left: `calc(${pct}% - 1px)` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{etiqueta(inicio)}</span>
        <span>{etiqueta(fin)}</span>
      </div>
    </div>
  );
}

interface Props {
  jornadaHoy: JornadaHoy;
}

export function FicharCard({ jornadaHoy }: Props) {
  const [cargado, setCargado] = useState(false);
  const [habilitado, setHabilitado] = useState(false);
  const [fichaje, setFichaje] = useState<MiFichajeHoy | null>(null);
  // Marca de tiempo del ultimo refresco del contador. Solo la escribe el
  // intervalo (efecto); el render la usa, nunca consulta el reloj.
  const [ahora, setAhora] = useState<number | null>(null);

  const estado = deriveEstado(fichaje);
  const trabajando = estado === "trabajando" || estado === "pausa";

  const refetch = useCallback(async () => {
    const r = await getMiFichajeHoy();
    setHabilitado(r.ok);
    if (r.ok) setFichaje(r.data);
    setCargado(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Contador en vivo mientras hay jornada abierta. El reloj es un sistema
  // externo: se consulta aqui (efecto) y nunca durante el render, que debe ser
  // puro. El primer refresco pinta el tiempo ya corrido sin esperar un segundo.
  const entradaMs = fichaje?.horaEntrada ? new Date(fichaje.horaEntrada).getTime() : null;
  useEffect(() => {
    if (!trabajando || entradaMs === null) return;
    const refrescar = () => setAhora(Date.now());
    refrescar();
    const i = setInterval(refrescar, 1000);
    return () => clearInterval(i);
  }, [trabajando, entradaMs]);

  // Al volver a la app, refrescar estado.
  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  // Minuto actual para la marca de la barra del turno. El reloj es un sistema
  // externo: se consulta en el efecto, nunca durante el render.
  const [minutoAhora, setMinutoAhora] = useState<number | null>(null);
  useEffect(() => {
    const refrescar = () => {
      const d = new Date();
      setMinutoAhora(d.getHours() * 60 + d.getMinutes());
    };
    refrescar();
    const i = setInterval(refrescar, 60000);
    return () => clearInterval(i);
  }, []);

  if (!cargado) {
    return (
      <div className="mx-5 mt-4 flex h-36 items-center justify-center rounded-3xl border border-border/60 bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Si el usuario no es empleado con fichaje, no mostramos la tarjeta.
  if (!habilitado) return null;

  const { libra, texto } = textoJornada(jornadaHoy);
  const elapsed = trabajando && entradaMs !== null && ahora !== null
    ? Math.max(0, ahora - entradaMs)
    : 0;
  return (
    <section className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
      {/* Cabecera: jornada de hoy o contador en vivo */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1">
        {trabajando ? (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Trabajando
            </span>
            <span className="ml-auto text-lg font-bold tabular-nums">
              {formatoTiempo(elapsed)}
            </span>
          </>
        ) : (
          <>
            {libra ? (
              <CalendarOff className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Clock className="h-4 w-4 shrink-0 text-primary" />
            )}
            <span
              className={
                libra
                  ? "text-sm font-medium text-muted-foreground"
                  : "text-sm font-medium"
              }
            >
              {texto}
            </span>
            {libra && <span className="ml-auto text-base">🎉</span>}
          </>
        )}
      </div>

      {jornadaHoy.tipo === "trabaja" && minutoAhora !== null && (
        <BarraTurno tramos={jornadaHoy.tramos} ahoraMin={minutoAhora} />
      )}

      {fichaje?.horaEntrada && trabajando && (
        <p className="px-4 pb-1 text-xs text-muted-foreground">
          Entrada: {formatHoraEnZona(fichaje.horaEntrada, fichaje.zonaHoraria)}
        </p>
      )}

      {/* Botón de acción (reutiliza toda la lógica de fichaje/offline/tipos) */}
      <BigClockButton
        fichajeId={fichaje?.id ?? null}
        estado={estado}
        onAction={() => void refetch()}
      />
      <div className="pb-3" />
    </section>
  );
}
