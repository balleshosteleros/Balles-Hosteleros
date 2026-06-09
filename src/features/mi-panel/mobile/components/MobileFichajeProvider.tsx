"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { obtenerPosicionActual } from "@/features/rrhh/utils/geo";
import {
  getMiFichajeHoy,
  paralizarFichajePersonal,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { MiFichajeHoy } from "@/features/mi-panel/types";
import { BigClockButton } from "./BigClockButton";

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

const POPUP_OFF_KEY = "bh_fichar_popup_off";

export function MobileFichajeProvider() {
  const router = useRouter();
  const [habilitado, setHabilitado] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [fichaje, setFichaje] = useState<MiFichajeHoy | null>(null);

  const [ficharOpen, setFicharOpen] = useState(false);
  const [indicadorOpen, setIndicadorOpen] = useState(false);
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [paralizando, setParalizando] = useState(false);
  const [, setTick] = useState(0);

  const estado = deriveEstado(fichaje);
  const trabajando = estado === "trabajando" || estado === "pausa";

  const refetch = useCallback(async () => {
    const r = await getMiFichajeHoy();
    setHabilitado(r.ok);
    if (r.ok) setFichaje(r.data);
    return r.ok ? r.data : null;
  }, []);

  // Carga inicial: decide si mostrar el pop-up de fichar al abrir la app.
  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await refetch();
      if (!alive) return;
      setCargado(true);
      const est = deriveEstado(data);
      const silenciado =
        typeof window !== "undefined" && sessionStorage.getItem(POPUP_OFF_KEY) === "1";
      if (est === "sin-fichar" && !silenciado) setFicharOpen(true);
    })();
    return () => {
      alive = false;
    };
  }, [refetch]);

  // Reloj en vivo mientras hay jornada abierta.
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

  const cerrarPopupFichar = () => {
    setFicharOpen(false);
    try {
      sessionStorage.setItem(POPUP_OFF_KEY, "1");
    } catch {
      /* noop */
    }
  };

  const onFichado = async () => {
    const data = await refetch();
    if (deriveEstado(data) !== "sin-fichar") setFicharOpen(false);
  };

  const confirmarParalizar = async () => {
    if (!fichaje) return;
    if (!motivo.trim()) {
      toast.error("Indica el motivo de la paralización.");
      return;
    }
    setParalizando(true);
    try {
      let geo: { lat: number; lng: number; precision: number } | undefined;
      try {
        geo = (await obtenerPosicionActual()) ?? undefined;
      } catch {
        geo = undefined;
      }
      const res = await paralizarFichajePersonal(fichaje.id, motivo.trim(), geo);
      if (!res.ok) {
        toast.error(res.error || "No se pudo paralizar el fichaje");
        return;
      }
      toast.success("Fichaje paralizado");
      setIndicadorOpen(false);
      setPidiendoMotivo(false);
      setMotivo("");
      await refetch();
      router.refresh();
    } finally {
      setParalizando(false);
    }
  };

  if (!cargado || !habilitado) return null;

  const entradaMs = fichaje?.horaEntrada ? new Date(fichaje.horaEntrada).getTime() : null;
  const elapsed = entradaMs ? Date.now() - entradaMs : 0;

  return (
    <>
      {/* Indicador verde parpadeante mientras trabaja */}
      {trabajando && (
        <button
          type="button"
          onClick={() => setIndicadorOpen(true)}
          className="fixed left-1/2 top-[max(env(safe-area-inset-top),8px)] z-[55] flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 active:scale-95"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="tabular-nums">{formatoTiempo(elapsed)}</span>
          <span className="opacity-90">· Trabajando</span>
        </button>
      )}

      {/* Pop-up de fichar al abrir la app */}
      {ficharOpen && estado === "sin-fichar" && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50"
          onClick={cerrarPopupFichar}
        >
          <div
            className="rounded-t-3xl bg-background pb-[max(env(safe-area-inset-bottom),16px)] pt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted" />
            <div className="flex items-center justify-between px-5">
              <h2 className="text-lg font-semibold">¿Fichar entrada?</h2>
              <button
                onClick={cerrarPopupFichar}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-5 pt-1 text-sm text-muted-foreground">
              Registra tu entrada para empezar la jornada.
            </p>
            <BigClockButton fichajeId={null} estado="sin-fichar" onAction={onFichado} />
          </div>
        </div>
      )}

      {/* Pop-up del indicador: tiempo + paralizar */}
      {indicadorOpen && trabajando && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50"
          onClick={() => {
            setIndicadorOpen(false);
            setPidiendoMotivo(false);
          }}
        >
          <div
            className="rounded-t-3xl bg-background p-5 pb-[max(env(safe-area-inset-bottom),20px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />

            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Trabajando
              </span>
              <span className="mt-1 text-4xl font-bold tabular-nums">
                {formatoTiempo(elapsed)}
              </span>
              {fichaje?.horaEntrada && (
                <span className="mt-1 text-xs text-muted-foreground">
                  Entrada:{" "}
                  {new Date(fichaje.horaEntrada).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>

            {!pidiendoMotivo ? (
              <button
                type="button"
                onClick={() => setPidiendoMotivo(true)}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 text-sm font-semibold text-white active:bg-rose-600"
              >
                <Ban className="h-5 w-5" />
                Paralizar fichaje
              </button>
            ) : (
              <div className="mt-5 space-y-2">
                <p className="text-sm font-medium">
                  ¿Por qué paralizas el fichaje antes de tu horario?
                </p>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  autoFocus
                  rows={3}
                  placeholder="Motivo de la paralización…"
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  Quedará guardado en tu fichaje y marcado para revisión.
                </p>
                <button
                  type="button"
                  onClick={confirmarParalizar}
                  disabled={paralizando || !motivo.trim()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 text-sm font-semibold text-white active:bg-rose-600 disabled:opacity-60"
                >
                  {paralizando ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Confirmar paralización"
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIndicadorOpen(false);
                setPidiendoMotivo(false);
              }}
              className="mt-2 h-11 w-full rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted"
            >
              Seguir trabajando
            </button>
          </div>
        </div>
      )}
    </>
  );
}
