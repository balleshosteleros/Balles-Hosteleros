"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
  getMiVentanaFichajeHoy,
  getTiposFichajeDisponibles,
  type ModoFichaje,
  type TipoFichajeDisponible,
  type VentanaFichajeHoy,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { minutosDiaEnZona } from "@/features/empresa/lib/zona-horaria";
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
  // Ventana horaria: decide si el botón está VIVO (verde) o apagado (gris).
  // El botón vive siempre en pantalla; lo que cambia es si se puede pulsar.
  const [ventana, setVentana] = useState<VentanaFichajeHoy | null>(null);
  const [nowMin, setNowMin] = useState<number>(() => Date.now());
  const { online, pending: pendingOffline, flushing } = useOfflineFichajes(() => {
    startTransition(() => router.refresh());
  });

  // `cargada` distingue "aún no sé" de "ya sé y no hay horario". Sin esta
  // marca, un fallo al leer la ventana dejaba `ventana` en null y el botón se
  // quedaba VERDE para siempre (la regla "mientras carga no se apaga" no
  // llegaba a caducar nunca). En la duda es mejor apagarlo: el servidor va a
  // rechazar igual, y un botón verde que falla al pulsarlo engaña más.
  const [ventanaCargada, setVentanaCargada] = useState(false);
  const cargarVentana = useCallback(() => {
    getMiVentanaFichajeHoy()
      .then((v) => {
        // `ok:false` es no-poder-saber (sin sesión, error de consulta): se trata
        // como "sin horario", que es lo que el servidor aplicará de todas formas.
        setVentana(v.ok ? v : null);
      })
      .catch(() => setVentana(null))
      .finally(() => setVentanaCargada(true));
  }, []);

  useEffect(() => {
    getMiConfigFichaje().then((res) => {
      if (res.ok) setPermiteTeletrabajo(res.permiteTeletrabajo);
    });
    getTiposFichajeDisponibles().then((res) => {
      if (res.ok) setTiposDisponibles(res.data);
    });
    cargarVentana();
  }, [cargarVentana]);

  // El botón se apaga y enciende solo con el paso del tiempo, así que hace
  // falta un reloj. Cada 15 s basta: la ventana se mide en minutos.
  useEffect(() => {
    const i = setInterval(() => setNowMin(Date.now()), 15_000);
    return () => clearInterval(i);
  }, []);

  // Y al volver a la app: los turnos pueden haber cambiado (o ser de otro día).
  useEffect(() => {
    const onFocus = () => {
      cargarVentana();
      setNowMin(Date.now());
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [cargarVentana]);

  const Icon = STYLES[estado].icon;

  // ─── ¿Puede fichar AHORA? ─────────────────────────────────────────────────
  // Misma regla que aplica el servidor en `evaluarEntradaFichaje`, para que el
  // botón no invite a pulsar algo que va a ser rechazado. Dos motivos posibles
  // de apagado, y se distinguen a propósito porque no se arreglan igual:
  //   · SIN TURNO HOY   → no hay nada planificado; se pide por solicitud.
  //   · FUERA DE TURNO  → sí trabaja hoy, pero no a esta hora.
  const motivoApagado: "sin-turno" | "fuera-de-turno" | null = (() => {
    // Mientras carga no se apaga: apagar y encender a los 300 ms es peor que
    // esperar. Una vez cerrada la jornada tampoco aplica (el botón ya es gris).
    if (estado === "completado") return null;
    // Aún no se sabe: no se apaga (parpadear a gris y volver es peor).
    if (!ventanaCargada) return null;
    // Ya se sabe, y no hay ventana que valga: sin horario.
    if (!ventana) return "sin-turno";
    // Salir siempre se puede: quien está dentro tiene que poder cerrar, aunque
    // se le haya pasado la hora (si no, la jornada queda abierta para siempre).
    if (estado === "trabajando" || estado === "pausa") return null;
    // Config abierta: sin hora límite, el botón nunca se apaga.
    if (ventana.permitirFueraHorario) return null;
    if (!ventana.tieneHorario) return "sin-turno";

    const tz = ventana.zonaHoraria || "Europe/Madrid";
    const ahora = minutosDiaEnZona(new Date(nowMin), tz);
    const inicios = ventana.entradasMin?.length
      ? ventana.entradasMin
      : ventana.entradaMin != null
        ? [ventana.entradaMin]
        : [];
    if (inicios.length === 0) return "sin-turno";

    // Ventana REAL de fichaje: la cortesía configurada en Ajustes, la misma que
    // valida el servidor. Circular sobre 24 h por los turnos de noche.
    //
    // OJO: `entradasMin` junta los tramos de TODAS sus empresas, pero la
    // cortesía que llega es la de UNA (la del tramo más temprano). Hoy las dos
    // empresas tienen la misma (5/5) así que coincide; si algún día difieren,
    // el gris podría adelantarse o retrasarse unos minutos respecto al
    // servidor. Quien manda y rechaza sigue siendo el servidor: esto es solo
    // la pista visual.
    const antes = ventana.margenAntesMin ?? 0;
    const despues = ventana.margenDespuesMin ?? 0;
    const dentro = inicios.some((ini) => {
      let diff = (((ahora - ini) % 1440) + 1440) % 1440;
      if (diff > 720) diff -= 1440;
      return diff >= -antes && diff <= despues;
    });
    return dentro ? null : "fuera-de-turno";
  })();

  const apagado = motivoApagado !== null;
  const disabled = estado === "completado" || busy || pending || flushing;

  // Al pulsar el botón apagado NO se ficha: se explica por qué, y se ofrece la
  // salida real (la solicitud), que es lo que el empleado tiene que hacer.
  const avisarApagado = () => {
    const msg =
      motivoApagado === "sin-turno"
        ? "Hoy no tienes turno asignado, así que no puedes fichar el horario normal. Si has trabajado, pídelo por solicitud y tu responsable lo revisará."
        : "Estás fuera de tu turno: aún no se abre tu hora de fichaje o ya se ha pasado. Si has trabajado, pídelo por solicitud y tu responsable lo revisará.";
    toast.error(msg, {
      duration: 9000,
      action: {
        label: "Ir a solicitudes",
        onClick: () => router.push("/m/solicitudes"),
      },
    });
  };

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

      {/* El botón NO desaparece nunca: fuera de la ventana se queda gris y, al
          pulsarlo, dice por qué. Antes solo existía dentro del aviso, y a quien
          se le pasaba la ventana se quedaba sin ninguna forma de fichar. */}
      <button
        type="button"
        onClick={apagado ? avisarApagado : action}
        disabled={disabled}
        aria-disabled={apagado}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-3xl py-9 text-lg font-semibold shadow-lg transition-transform",
          apagado
            ? "bg-muted text-muted-foreground shadow-none"
            : STYLES[estado].bg,
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
        {apagado && (
          <span className="text-xs font-medium normal-case tracking-normal opacity-80">
            {motivoApagado === "sin-turno" ? "Hoy no tienes turno" : "Fuera de tu turno"}
          </span>
        )}
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
