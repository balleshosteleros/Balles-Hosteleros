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

interface Props {
  jornadaHoy: JornadaHoy;
}

export function FicharCard({ jornadaHoy }: Props) {
  const [cargado, setCargado] = useState(false);
  const [habilitado, setHabilitado] = useState(false);
  const [fichaje, setFichaje] = useState<MiFichajeHoy | null>(null);
  const [, setTick] = useState(0);

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

  // Contador en vivo mientras hay jornada abierta.
  useEffect(() => {
    if (!trabajando) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [trabajando]);

  // Al volver a la app, refrescar estado.
  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

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
  const entradaMs = fichaje?.horaEntrada ? new Date(fichaje.horaEntrada).getTime() : null;
  const elapsed = entradaMs ? Date.now() - entradaMs : 0;

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
