"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, Coffee, Play, CheckCircle2, WifiOff, MapPin, House, TriangleAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AvisoBajaMedicaDialog } from "@/features/mi-panel/components/AvisoBajaMedicaDialog";
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
  getProximaEntradaFichaje,
  anularEntradaRecienFichada,
  type ModoFichaje,
  type TipoFichajeDisponible,
  type VentanaFichajeHoy,
} from "@/features/mi-panel/actions/mi-panel-actions";
import {
  minutosDiaEnZona,
  ahoraEnZona,
  zonaLocalAUtcISO,
  formatHoraEnZona,
  formatFechaEnZona,
} from "@/features/empresa/lib/zona-horaria";
import { MOTIVO_MIN_CARACTERES } from "@/features/mi-panel/types";
import { fichajeColorDot } from "@/features/rrhh/data/fichajes";
import { enqueue } from "../lib/offline-fichaje-db";
import { useOfflineFichajes } from "../hooks/use-offline-fichajes";
import { CapaFichaje } from "./CapaFichaje";

type Estado = "sin-fichar" | "trabajando" | "pausa" | "completado";

interface Props {
  fichajeId: string | null;
  estado: Estado;
  /** Se llama tras una acción de fichaje (entrada/salida/pausa) con éxito o no. */
  onAction?: () => void;
  /**
   * El fichaje de hoy todavía se está leyendo. El botón se pinta IGUAL de
   * grande desde el primer instante, en gris y sin pulsar: antes quien abría
   * la huella veía cinco segundos de hoja vacía (solo el título y la X) hasta
   * que aparecía el recuadro de golpe.
   */
  cargando?: boolean;
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

/** Minutos del día (0–1439) como "HH:MM". */
function minutosAHora(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "2 h 14 min", "4 min 32 s", "45 s" — lo que falta, en una pieza corta. */
function textoRestante(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const horas = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const seg = total % 60;
  if (horas >= 24) {
    const dias = Math.floor(horas / 24);
    return `${dias} día${dias === 1 ? "" : "s"} y ${horas % 24} h`;
  }
  if (horas > 0) return `${horas} h ${min} min`;
  if (min > 0) return `${min} min ${String(seg).padStart(2, "0")} s`;
  return `${seg} s`;
}

/**
 * Mini contador de lo que queda para poder fichar. Vive aparte para que el
 * tictac de cada segundo repinte solo esta línea y no el botón entero.
 */
function CuentaAtras({ objetivoMs, onLlegada }: { objetivoMs: number; onLlegada: () => void }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const restante = objetivoMs - ahora;
  const yaAbre = restante <= 0;
  // Llegó la hora: el botón se pone verde solo, sin que el empleado tenga que
  // cerrar y volver a abrir la hoja.
  useEffect(() => {
    if (yaAbre) onLlegada();
  }, [yaAbre, onLlegada]);
  if (yaAbre) return null;
  return <span className="tabular-nums">Faltan {textoRestante(restante)}</span>;
}

async function tryGetGeo() {
  try {
    return await obtenerPosicionActual();
  } catch {
    return null;
  }
}

export function BigClockButton({ fichajeId, estado, onAction, cargando = false }: Props) {
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
    // Antes aquí se salía en seco con la jornada cerrada, porque el botón
    // grande ya era gris y daba igual. Desde que existe "Fichar nueva entrada"
    // NO da igual: la ventana de cortesía tiene que valer también para esa
    // segunda entrada. Pasada la cortesía no se ficha, se pide por solicitud.
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
  // "Aún no se sabe": ni el fichaje de hoy ni la ventana del turno. El botón se
  // queda en gris neutro hasta saberlo — pintarlo verde y cambiarlo a gris un
  // segundo después es peor que esperar ese segundo.
  const enCarga = cargando || !ventanaCargada;

  // ─── ¿A partir de cuándo se podrá fichar? ─────────────────────────────────
  // El botón gris decía "fuera de tu turno" y ahí se acababa: verdad, pero
  // inservible. Lo que hace falta saber es la hora exacta desde la que el
  // fichaje se acepta — con la cortesía ya descontada, que es la hora real — y
  // cuánto queda para eso.
  //
  // Los turnos de HOY salen de la ventana que el botón ya tiene: instantáneo,
  // sin pedir nada. Si hoy ya no queda ninguno (o no hay turno), se pregunta al
  // servidor, que sí sabe mirar los próximos días.
  const minutoActual = Math.floor(nowMin / 60_000);
  const aperturaHoyMs = useMemo(() => {
    if (!ventana || !ventana.tieneHorario || ventana.permitirFueraHorario) return null;
    const tz = ventana.zonaHoraria || "Europe/Madrid";
    const hoy = ahoraEnZona(tz, new Date(nowMin)).fecha;
    const antes = ventana.margenAntesMin ?? 0;
    const inicios = ventana.entradasMin?.length
      ? ventana.entradasMin
      : ventana.entradaMin != null
        ? [ventana.entradaMin]
        : [];
    let mejor: number | null = null;
    for (const ini of inicios) {
      const inicioMs = Date.parse(zonaLocalAUtcISO(hoy, minutosAHora(ini), tz));
      if (Number.isNaN(inicioMs)) continue;
      const abre = inicioMs - antes * 60_000;
      if (abre <= nowMin) continue;
      if (mejor === null || abre < mejor) mejor = abre;
    }
    return mejor;
    // El minuto (no el milisegundo) basta para decidir qué tramos ya han pasado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventana, minutoActual]);

  // El cálculo de arriba da por hecho que el tramo es de HOY, y eso solo se
  // sostiene a pocas horas vista: de madrugada, con un turno de noche, el "día"
  // del servidor y el del móvil pueden no ser el mismo y saldría una hora
  // inventada. Pasadas doce horas se deja de suponer y se pregunta.
  const aperturaHoyFiable =
    aperturaHoyMs !== null && aperturaHoyMs - nowMin <= 12 * 3_600_000 ? aperturaHoyMs : null;

  // Lo que hoy no se puede saber: el siguiente turno puede ser mañana o el
  // lunes que viene. Se pide UNA vez, y solo cuando de verdad hace falta.
  const [proxima, setProxima] = useState<{ aperturaMs: number; zonaHoraria: string } | null>(null);
  const necesitaProxima = apagado && ventanaCargada && aperturaHoyFiable === null;
  useEffect(() => {
    if (!necesitaProxima) return;
    let vivo = true;
    getProximaEntradaFichaje()
      .then((r) => {
        if (!vivo || !r.ok || !r.aperturaISO) return;
        const ms = Date.parse(r.aperturaISO);
        if (!Number.isNaN(ms)) setProxima({ aperturaMs: ms, zonaHoraria: r.zonaHoraria });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [necesitaProxima]);

  const apertura: { ms: number; tz: string } | null = aperturaHoyFiable
    ? { ms: aperturaHoyFiable, tz: ventana?.zonaHoraria || "Europe/Madrid" }
    : proxima && proxima.aperturaMs > nowMin
      ? { ms: proxima.aperturaMs, tz: proxima.zonaHoraria }
      : null;

  /** "Podrás fichar a partir de las 18:55" — con el día si no es hoy. */
  const fraseApertura = (() => {
    if (!apertura) return null;
    const iso = new Date(apertura.ms).toISOString();
    const hora = formatHoraEnZona(iso, apertura.tz);
    const dia = ahoraEnZona(apertura.tz, new Date(apertura.ms)).fecha;
    const hoy = ahoraEnZona(apertura.tz, new Date(nowMin)).fecha;
    if (dia === hoy) return `Podrás fichar a partir de las ${hora}`;
    const [a, m, d] = hoy.split("-").map(Number);
    const manana = new Date(Date.UTC(a, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
    if (dia === manana) return `Podrás fichar mañana a las ${hora}`;
    return `Podrás fichar el ${formatFechaEnZona(iso, apertura.tz)} a las ${hora}`;
  })();

  // Cuando el contador llega a cero, el botón se enciende solo.
  const alAbrirseLaVentana = useCallback(() => {
    setNowMin(Date.now());
    cargarVentana();
  }, [cargarVentana]);

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
  const [avisoBaja, setAvisoBaja] = useState(false);

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
          if ((res as { bajaMedica?: boolean }).bajaMedica) {
            // De baja no se ficha: se para en seco con un aviso propio, no con
            // un mensaje que se desvanece en tres segundos.
            setAvisoBaja(true);
          } else if ((res as { fueraDeHora?: boolean }).fueraDeHora) {
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

  /** Ya ha confirmado que empieza: a partir de aquí, el flujo de siempre. */
  const empezarATrabajar = async () => {
    setConfirmandoEntrada(false);
    if (!online) {
      await ficharEntrada("presencial");
      return;
    }
    if (tiposDisponibles.length > 1) {
      setEligiendoTipo(true);
      return;
    }
    iniciarFichajeEntrada(tiposDisponibles[0]?.codigo);
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

  // Reconfirmar la ENTRADA: un toque sin querer en el botón grande abría la
  // jornada sin más. Una pregunta corta y ya.
  const [confirmandoEntrada, setConfirmandoEntrada] = useState(false);
  // Sale antes de su hora: hay que explicarse. La hoja guarda la hora a la que
  // debía terminar, que la calcula el servidor.
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivoSalida, setMotivoSalida] = useState("");
  const [horaPrevista, setHoraPrevista] = useState<string | null>(null);
  // Recién entrado: no se cierra, se ofrece deshacer la entrada.
  const [avisoPronto, setAvisoPronto] = useState<{ minutos: number; minimo: number } | null>(null);

  /** Cierra la jornada. Con motivo si el servidor lo pidió por salir antes. */
  const ficharSalida = async (motivo?: string) => {
    if (!fichajeId) return;
    setBusy(true);
    try {
      const geo = await tryGetGeo();
      if (!online) {
        await enqueueOffline("salida", geo);
        return;
      }
      const res = await ficharSalidaPersonal(fichajeId, geo, motivo);
      if (res.ok) {
        setPidiendoMotivo(false);
        setMotivoSalida("");
        toast.success(
          (res as { data?: { salidaAnticipada?: boolean } }).data?.salidaAnticipada
            ? "Salida registrada. Tu responsable tiene que aprobarla."
            : "Salida registrada",
        );
        return;
      }
      const r = res as {
        error?: string;
        demasiadoPronto?: boolean;
        minutosDentro?: number;
        minutosMinimos?: number;
        requiereMotivo?: boolean;
        salidaPrevistaHora?: string;
      };
      if (r.demasiadoPronto) {
        setAvisoPronto({ minutos: r.minutosDentro ?? 0, minimo: r.minutosMinimos ?? 30 });
        return;
      }
      if (r.requiereMotivo) {
        setHoraPrevista(r.salidaPrevistaHora ?? null);
        setPidiendoMotivo(true);
        return;
      }
      toast.error(r.error || "No se pudo fichar la salida");
    } finally {
      setBusy(false);
      onAction?.();
      startTransition(() => router.refresh());
    }
  };

  /** "Me he equivocado al entrar": borra la entrada y devuelve el botón. */
  const anularEntrada = async () => {
    if (!fichajeId) return;
    setBusy(true);
    try {
      const res = await anularEntradaRecienFichada(fichajeId);
      if (res.ok) {
        setAvisoPronto(null);
        toast.success("Entrada anulada. Puedes volver a fichar.");
      } else {
        toast.error(res.error || "No se pudo anular la entrada");
      }
    } finally {
      setBusy(false);
      onAction?.();
      startTransition(() => router.refresh());
    }
  };

  const action = async () => {
    if (disabled) return;
    // Entrada: sin conexión va directa (presencial, sin tipo). Con conexión,
    // primero el tipo (si hay más de uno) y luego el modo (si teletrabaja).
    if (estado === "sin-fichar") {
      // Reconfirmación: el botón es grande y está en la portada. Un roce no
      // puede abrir la jornada.
      setConfirmandoEntrada(true);
      return;
    }
    if (estado === "trabajando" && fichajeId) {
      await ficharSalida();
      return;
    }
    setBusy(true);
    try {
      if (estado === "pausa" && fichajeId) {
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
    <div className="pointer-events-auto px-5 pt-3">
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
        onClick={enCarga ? undefined : apagado ? avisarApagado : action}
        disabled={disabled || enCarga}
        aria-disabled={apagado || enCarga}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-3xl py-9 text-lg font-semibold shadow-lg transition-transform",
          apagado || enCarga
            ? "bg-muted text-muted-foreground shadow-none"
            : STYLES[estado].bg,
          !disabled && !enCarga && "active:scale-[0.98]",
          disabled && "opacity-90",
        )}
      >
        {busy || pending || enCarga ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <Icon className="h-10 w-10" strokeWidth={2.2} />
        )}
        <span className="tracking-wide">{enCarga ? "UN MOMENTO" : STYLES[estado].label}</span>
        {apagado && !enCarga && (
          <span className="flex flex-col items-center gap-0.5 px-4 text-center text-xs font-medium normal-case leading-snug tracking-normal opacity-80">
            <span>
              {fraseApertura ??
                (motivoApagado === "sin-turno" ? "Hoy no tienes turno" : "Fuera de tu turno")}
            </span>
            {apertura && <CuentaAtras objetivoMs={apertura.ms} onLlegada={alAbrirseLaVentana} />}
          </span>
        )}
      </button>

      {/* Cerrar la jornada NO puede dejarte fuera el resto del día. En
          escritorio esto existía ("Fichar nueva entrada") y en el móvil no: el
          botón se quedaba gris y no había forma de volver a fichar. */}
      {estado === "completado" && (
        <button
          type="button"
          onClick={apagado ? avisarApagado : () => setConfirmandoEntrada(true)}
          disabled={busy || pending}
          aria-disabled={apagado}
          className={cn(
            "mt-3 flex w-full flex-col items-center justify-center gap-1 rounded-2xl border py-3 text-sm font-medium disabled:opacity-60",
            apagado
              ? "border-border bg-muted text-muted-foreground"
              : "border-border bg-background active:bg-muted",
          )}
        >
          <span className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4" /> Fichar nueva entrada
          </span>
          {apagado && (
            <span className="flex flex-col items-center gap-0.5 px-4 text-center text-xs font-normal leading-snug opacity-80">
              <span>
                {fraseApertura ??
                  (motivoApagado === "sin-turno" ? "Hoy no tienes más turnos" : "Fuera de tu turno")}
              </span>
              {apertura && <CuentaAtras objetivoMs={apertura.ms} onLlegada={alAbrirseLaVentana} />}
            </span>
          )}
        </button>
      )}

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

      {/* Reconfirmar la entrada. Corta a propósito: si cada día hay que leerse
          un párrafo, se pulsa en automático y deja de servir de nada. */}
      {confirmandoEntrada && (
        <CapaFichaje
          encima
          onFondo={() => setConfirmandoEntrada(false)}
        >
          <div
            className="w-full max-w-md self-center rounded-t-3xl bg-background p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h2 className="text-center text-lg font-semibold">¿Empiezas tu turno?</h2>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={empezarATrabajar}
                disabled={busy}
                className="h-14 rounded-2xl bg-emerald-500 text-base font-semibold text-white active:bg-emerald-600 disabled:opacity-60"
              >
                Empezar a trabajar
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoEntrada(false)}
                className="h-12 rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </CapaFichaje>
      )}

      {/* Recién entrado: cerrar aquí casi siempre es un error, y antes costaba
          el turno entero (jornada a 0 h y botón apagado el resto del día). */}
      {avisoPronto && (
        <CapaFichaje
          encima
          onFondo={() => setAvisoPronto(null)}
        >
          <div
            className="w-full max-w-md self-center rounded-t-3xl bg-background p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Acabas de fichar la entrada
                </p>
                <p className="mt-0.5 text-xs leading-snug text-amber-800 dark:text-amber-200">
                  Llevas {avisoPronto.minutos} min dentro. ¿Te has equivocado al fichar, o de verdad
                  has terminado?
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={anularEntrada}
                disabled={busy}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-border bg-background text-base font-semibold active:bg-muted disabled:opacity-60"
              >
                <Undo2 className="h-5 w-5" /> Me he equivocado al entrar
              </button>
              <button
                type="button"
                onClick={() => setAvisoPronto(null)}
                className="h-12 rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted"
              >
                Seguir trabajando
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Podrás fichar la salida a partir de los {avisoPronto.minimo} min.
            </p>
          </div>
        </CapaFichaje>
      )}

      {/* Sale antes de su hora: se cierra igual, pero explicándose. */}
      {pidiendoMotivo && (
        <CapaFichaje
          encima
          onFondo={() => setPidiendoMotivo(false)}
        >
          <div
            className="w-full max-w-md self-center rounded-t-3xl bg-background p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Vas a salir antes de tu horario
              </p>
              {horaPrevista && (
                <p className="mt-0.5 text-xs leading-snug text-amber-800 dark:text-amber-200 tabular-nums">
                  Tu turno termina a las {horaPrevista}.
                </p>
              )}
            </div>

            <p className="mt-4 text-sm font-medium">Explica por qué te vas antes</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tu responsable tendrá que aprobarlo o rechazarlo.
            </p>
            <textarea
              value={motivoSalida}
              onChange={(e) => setMotivoSalida(e.target.value)}
              autoFocus
              rows={3}
              className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Obligatorio. Mínimo {MOTIVO_MIN_CARACTERES} caracteres.
            </p>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => ficharSalida(motivoSalida)}
                disabled={busy || motivoSalida.trim().length < MOTIVO_MIN_CARACTERES}
                className="h-14 rounded-2xl bg-rose-500 text-base font-semibold text-white active:bg-rose-600 disabled:opacity-60"
              >
                {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Fichar salida y enviar"}
              </button>
              <button
                type="button"
                onClick={() => setPidiendoMotivo(false)}
                className="h-12 rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted"
              >
                Seguir trabajando
              </button>
            </div>
          </div>
        </CapaFichaje>
      )}

      {/* Hoja de elección de tipo (solo si hay más de un tipo disponible hoy). */}
      {eligiendoTipo && (
        <CapaFichaje
          encima
          onFondo={() => setEligiendoTipo(false)}
        >
          <div
            className="w-full max-w-md self-center rounded-t-3xl bg-background p-5 pb-8"
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
        </CapaFichaje>
      )}

      {/* Hoja de elección de modo (solo si el empleado puede teletrabajar). */}
      {eligiendoModo && (
        <CapaFichaje
          encima
          onFondo={() => setEligiendoModo(false)}
        >
          <div
            className="w-full max-w-md self-center rounded-t-3xl bg-background p-5 pb-8"
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
        </CapaFichaje>
      )}

      <AvisoBajaMedicaDialog
        open={avisoBaja}
        onOpenChange={setAvisoBaja}
        hrefSolicitudes="/m/solicitudes"
      />
    </div>
  );
}
