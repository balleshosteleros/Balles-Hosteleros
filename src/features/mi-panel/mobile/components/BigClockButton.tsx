"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, Coffee, Play, CheckCircle2, WifiOff, MapPin, House } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { obtenerPosicionActual } from "@/features/rrhh/utils/geo";
import {
  ficharEntradaPersonal,
  ficharSalidaPersonal,
  iniciarPausaPersonal,
  finalizarPausaPersonal,
  getMiConfigFichaje,
  getTiposFichajeDisponibles,
  type ModoFichaje,
  type TipoFichajeDisponible,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { fichajeColorDot } from "@/features/rrhh/data/fichajes";
import { enqueue } from "../lib/offline-fichaje-db";
import { useOfflineFichajes } from "../hooks/use-offline-fichajes";

type Estado = "sin-fichar" | "trabajando" | "pausa" | "completado";

interface Props {
  fichajeId: string | null;
  estado: Estado;
  /** Se llama tras una acción de fichaje (entrada/salida/pausa) con éxito o no. */
  onAction?: () => void;
}

const STYLES: Record<Estado, { label: string; bg: string; icon: typeof Fingerprint }> = {
  "sin-fichar": {
    label: "FICHAR ENTRADA",
    bg: "bg-emerald-500 active:bg-emerald-600 text-white",
    icon: Fingerprint,
  },
  trabajando: {
    label: "FICHAR SALIDA",
    bg: "bg-rose-500 active:bg-rose-600 text-white",
    icon: Fingerprint,
  },
  pausa: {
    label: "REANUDAR",
    bg: "bg-amber-500 active:bg-amber-600 text-white",
    icon: Play,
  },
  completado: {
    label: "JORNADA COMPLETA",
    bg: "bg-muted text-muted-foreground",
    icon: CheckCircle2,
  },
};

function monotonicNowMs(): number {
  if (typeof performance !== "undefined") return performance.timeOrigin + performance.now();
  return Date.now();
}

async function tryGetGeo() {
  try {
    return await obtenerPosicionActual();
  } catch {
    return null;
  }
}

export function BigClockButton({ fichajeId, estado, onAction }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [permiteTeletrabajo, setPermiteTeletrabajo] = useState(false);
  const [eligiendoModo, setEligiendoModo] = useState(false);
  const [tiposDisponibles, setTiposDisponibles] = useState<TipoFichajeDisponible[]>([]);
  const [eligiendoTipo, setEligiendoTipo] = useState(false);
  const [tipoElegido, setTipoElegido] = useState<string | undefined>(undefined);
  const { online, pending: pendingOffline, flushing } = useOfflineFichajes(() => {
    startTransition(() => router.refresh());
  });

  useEffect(() => {
    getMiConfigFichaje().then((res) => {
      if (res.ok) setPermiteTeletrabajo(res.permiteTeletrabajo);
    });
    getTiposFichajeDisponibles().then((res) => {
      if (res.ok) setTiposDisponibles(res.data);
    });
  }, []);

  const Icon = STYLES[estado].icon;
  const disabled = estado === "completado" || busy || pending || flushing;

  const enqueueOffline = async (
    kind: "entrada" | "salida" | "pausa_inicio" | "pausa_fin",
    geo: { lat: number; lng: number; precision: number } | null,
  ) => {
    await enqueue({
      kind,
      fichajeId: kind === "entrada" ? null : fichajeId,
      deviceTimestampIso: new Date().toISOString(),
      deviceMonotonicMs: monotonicNowMs(),
      geo,
    });
    toast.success("Sin conexión — guardado, se sincronizará cuando vuelva la señal");
  };

  // Fichaje de entrada con modo explícito. El teletrabajo no captura ubicación;
  // el presencial sí (y el server valida que estés dentro de un local).
  const ficharEntrada = async (modo: ModoFichaje, tipoCodigo?: string) => {
    setEligiendoModo(false);
    setEligiendoTipo(false);
    const codigo = tipoCodigo !== undefined ? tipoCodigo : tipoElegido;
    setBusy(true);
    try {
      const geo = modo === "presencial" ? await tryGetGeo() : null;
      if (!online) {
        // Sin conexión se encola siempre como presencial (con la geo capturada).
        await enqueueOffline("entrada", geo);
      } else {
        const res = await ficharEntradaPersonal(geo ?? undefined, modo, codigo);
        if (!res.ok) {
          if ((res as { fueraDeHora?: boolean }).fueraDeHora) {
            toast.error(res.error || "Estás fuera de hora", {
              duration: 9000,
              action: {
                label: "Ir a solicitudes",
                onClick: () => router.push("/m/solicitudes"),
              },
            });
          } else {
            toast.error(res.error || "No se pudo fichar la entrada");
          }
        } else {
          toast.success(modo === "teletrabajo" ? "Entrada registrada (teletrabajo)" : "Entrada registrada");
        }
      }
    } finally {
      setBusy(false);
      onAction?.();
      startTransition(() => router.refresh());
    }
  };

  // Tras elegir tipo (o si solo hay uno), preguntamos el modo si procede.
  const iniciarFichajeEntrada = (tipoCodigo?: string) => {
    setTipoElegido(tipoCodigo);
    if (permiteTeletrabajo) {
      setEligiendoModo(true);
      return;
    }
    void ficharEntrada("presencial", tipoCodigo);
  };

  const action = async () => {
    if (disabled) return;
    // Entrada: sin conexión va directa (presencial, sin tipo). Con conexión,
    // primero el tipo (si hay más de uno) y luego el modo (si teletrabaja).
    if (estado === "sin-fichar") {
      if (!online) {
        await ficharEntrada("presencial");
        return;
      }
      if (tiposDisponibles.length > 1) {
        setEligiendoTipo(true);
        return;
      }
      iniciarFichajeEntrada(tiposDisponibles[0]?.codigo);
      return;
    }
    setBusy(true);
    try {
      if (estado === "trabajando" && fichajeId) {
        const geo = await tryGetGeo();
        if (!online) {
          await enqueueOffline("salida", geo);
        } else {
          const res = await ficharSalidaPersonal(fichajeId, geo);
          if (!res.ok) toast.error(res.error || "No se pudo fichar la salida");
          else toast.success("Salida registrada");
        }
      } else if (estado === "pausa" && fichajeId) {
        if (!online) {
          await enqueueOffline("pausa_fin", null);
        } else {
          const res = await finalizarPausaPersonal(fichajeId);
          if (!res.ok) toast.error(res.error || "No se pudo reanudar");
          else toast.success("Pausa finalizada");
        }
      }
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  };

  const onPausar = async () => {
    if (!fichajeId || estado !== "trabajando" || busy) return;
    setBusy(true);
    try {
      if (!online) {
        await enqueueOffline("pausa_inicio", null);
      } else {
        const res = await iniciarPausaPersonal(fichajeId);
        if (!res.ok) toast.error(res.error || "No se pudo iniciar pausa");
        else toast.success("En pausa");
      }
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  };

  return (
    <div className="px-5 pt-3">
      {(!online || pendingOffline > 0) && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            {!online ? "Sin conexión" : "Sincronizando…"}
          </span>
          {pendingOffline > 0 && (
            <span className="font-semibold">
              {pendingOffline} pendiente{pendingOffline === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={action}
        disabled={disabled}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-3xl py-9 text-lg font-semibold shadow-lg transition-transform",
          STYLES[estado].bg,
          !disabled && "active:scale-[0.98]",
          disabled && "opacity-90",
        )}
      >
        {busy || pending ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <Icon className="h-10 w-10" strokeWidth={2.2} />
        )}
        <span className="tracking-wide">{STYLES[estado].label}</span>
      </button>

      {estado === "trabajando" && fichajeId && (
        <button
          type="button"
          onClick={onPausar}
          disabled={busy || pending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-medium text-muted-foreground active:bg-muted"
        >
          <Coffee className="h-4 w-4" /> Iniciar pausa
        </button>
      )}

      {/* Hoja de elección de tipo (solo si hay más de un tipo disponible hoy). */}
      {eligiendoTipo && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
          onClick={() => setEligiendoTipo(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-background p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h2 className="text-center text-lg font-semibold">¿Qué tipo de fichaje?</h2>
            <p className="mt-1 mb-4 text-center text-sm text-muted-foreground">
              Elige el tipo de jornada que vas a registrar.
            </p>
            <div className="grid gap-2">
              {tiposDisponibles.map((t) => (
                <button
                  key={t.codigo}
                  type="button"
                  onClick={() => { setEligiendoTipo(false); iniciarFichajeEntrada(t.codigo); }}
                  disabled={busy}
                  className="flex items-center gap-3 rounded-2xl border-2 border-border bg-background p-4 text-left active:bg-muted disabled:opacity-60"
                >
                  <span className={cn("h-3.5 w-3.5 rounded-full shrink-0", fichajeColorDot(t.color))} />
                  <span className="font-semibold">{t.nombre}</span>
                  {t.requiere_solicitud && (
                    <span className="ml-auto rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Con solicitud</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hoja de elección de modo (solo si el empleado puede teletrabajar). */}
      {eligiendoModo && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
          onClick={() => setEligiendoModo(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-background p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h2 className="text-center text-lg font-semibold">¿Cómo quieres fichar?</h2>
            <p className="mt-1 mb-4 text-center text-sm text-muted-foreground">
              El presencial necesita que estés en tu local; el teletrabajo no requiere ubicación.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => ficharEntrada("presencial")}
                disabled={busy}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-emerald-800 active:bg-emerald-100 disabled:opacity-60"
              >
                <MapPin className="h-7 w-7" />
                <span className="font-semibold">Presencial</span>
                <span className="text-xs text-emerald-700/80">Con ubicación</span>
              </button>
              <button
                type="button"
                onClick={() => ficharEntrada("teletrabajo")}
                disabled={busy}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-blue-800 active:bg-blue-100 disabled:opacity-60"
              >
                <House className="h-7 w-7" />
                <span className="font-semibold">Teletrabajo</span>
                <span className="text-xs text-blue-700/80">Sin ubicación</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
