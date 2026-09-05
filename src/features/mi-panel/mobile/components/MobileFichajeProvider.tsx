"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { obtenerPosicionActual } from "@/features/rrhh/utils/geo";
import {
  getMiFichajeHoy,
  getMiVentanaFichajeHoy,
  paralizarFichajePersonal,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { MiFichajeHoy } from "@/features/mi-panel/types";
import { formatHoraEnZona, minutosDiaEnZona } from "@/features/empresa/lib/zona-horaria";
import { cn } from "@/shared/lib/utils";
import { BigClockButton } from "./BigClockButton";
import { reproducirAvisoFichaje } from "../lib/aviso-fichaje";

type Estado = "sin-fichar" | "trabajando" | "pausa" | "completado";

/** Tras posponer el pop-up, vuelve a saltar pasado este tiempo (ms). */
const POSPONER_MS = 5 * 60 * 1000;

interface Ventana {
  tieneHorario: boolean;
  entradaMin: number | null;
  /** Inicio de CADA tramo del día: en turno partido, los N que haya. */
  entradasMin: number[];
  salidaMin: number | null;
  salidasMin: number[];
  popupMargenAntesMin: number;
  popupMargenDespuesMin: number;
  /**
   * Cortesía REAL para fichar (distinta de la del pop-up): pasados estos
   * minutos desde la hora del turno el servidor ya RECHAZA el fichaje. Es el
   * instante en que la cuenta atrás pasa a rojo y el aviso cambia de "ficha" a
   * "se te ha pasado", para no invitar a pulsar un botón que va a fallar.
   */
  margenDespuesMin: number;
  permitirFueraHorario: boolean;
  avisoSonido: boolean;
  avisoVibracion: boolean;
  /** Zona horaria en la que están entradaMin/salidaMin (PRP-069). */
  zonaHoraria: string;
}

/**
 * ¿Toca avisar de fichar ahora? Según config de Ajustes RRHH → Fichajes.
 * El aviso SOLO salta a quien tiene turno ese día, y SOLO dentro de la ventana
 * (X min antes / X min después de su hora). Nunca en ningún otro caso.
 */
function calcularDebe(
  ventana: Ventana | null,
  estado: Estado,
  trabajando: boolean,
  nowMin: number,
): { debeEntrada: boolean; debeSalida: boolean; objetivoMin: number | null } {
  const tiene = ventana?.tieneHorario ?? false;
  const mAntes = ventana?.popupMargenAntesMin ?? 15;
  const mDespues = ventana?.popupMargenDespuesMin ?? 15;
  let debeEntrada = false;
  let debeSalida = false;
  let objetivoMin: number | null = null;
  if (tiene) {
    // TURNO PARTIDO: hay que avisar en CADA entrada del día (las que haya),
    // no solo en la primera.
    const inicios =
      ventana?.entradasMin?.length
        ? ventana.entradasMin
        : ventana?.entradaMin != null
          ? [ventana.entradaMin]
          : [];
    const iniActivo =
      inicios.find((ini) => dentroVentana(nowMin, ini, mAntes, mDespues)) ?? null;
    debeEntrada = estado === "sin-fichar" && iniActivo != null;
    if (debeEntrada) objetivoMin = iniActivo;
    // Igual que la entrada: hay que avisar en CADA salida del día. Quien
    // encadena dos empresas (una acaba a las 23:30, la otra empieza ahí) tiene
    // dos cierres, y mirando solo el último no se avisaba del primero.
    const finales =
      ventana?.salidasMin?.length
        ? ventana.salidasMin
        : ventana?.salidaMin != null
          ? [ventana.salidaMin]
          : [];
    const finActivo =
      finales.find((fin) => dentroVentana(nowMin, fin, mAntes, mDespues)) ?? null;
    debeSalida = trabajando && finActivo != null;
    if (debeSalida) objetivoMin = finActivo;
  }
  return { debeEntrada, debeSalida, objetivoMin };
}

/**
 * Cuenta atrás en MM:SS. Negativo = ya pasó la hora, con un menos delante
 * ("-02:15" = dos minutos y cuarto de retraso).
 */
function formatoCuentaAtras(segundos: number): string {
  const signo = segundos < 0 ? "-" : "";
  const abs = Math.abs(segundos);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${signo}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

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

/**
 * Minutos del día (0–1439) ahora mismo en la zona horaria de la empresa cuyo
 * turno marca la ventana (PRP-069), para comparar contra entradaMin/salidaMin
 * que vienen en esa misma referencia. Fallback Europe/Madrid.
 */
function minutosAhoraEnZona(tz: string = "Europe/Madrid"): number {
  return minutosDiaEnZona(new Date(), tz);
}

/**
 * ¿`now` cae en [target − antes, target + despues]? Circular sobre 24 h.
 * `diff` < 0 = `now` es anterior a `target`; > 0 = posterior.
 */
function dentroVentana(now: number, target: number, antes: number, despues: number): boolean {
  let diff = (((now - target) % 1440) + 1440) % 1440;
  if (diff > 720) diff -= 1440;
  return diff >= -antes && diff <= despues;
}

export function MobileFichajeProvider() {
  const router = useRouter();
  const [habilitado, setHabilitado] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [fichaje, setFichaje] = useState<MiFichajeHoy | null>(null);
  const [ventana, setVentana] = useState<Ventana | null>(null);

  const [indicadorOpen, setIndicadorOpen] = useState(false);
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [paralizando, setParalizando] = useState(false);
  const [pospuestoHasta, setPospuestoHasta] = useState<number | null>(null);
  const [nowMin, setNowMin] = useState<number>(() => minutosAhoraEnZona());
  const [, setTick] = useState(0);
  const [, setSegundoTick] = useState(0);

  const estado = deriveEstado(fichaje);
  const trabajando = estado === "trabajando" || estado === "pausa";

  const refetch = useCallback(async () => {
    const r = await getMiFichajeHoy();
    setHabilitado(r.ok);
    if (r.ok) setFichaje(r.data);
    return r.ok ? r.data : null;
  }, []);

  // Recarga la ventana horaria del día (turnos de TODAS sus empresas).
  const refetchVentana = useCallback(async () => {
    const v = await getMiVentanaFichajeHoy();
    if (!v.ok) return;
    setVentana({
      tieneHorario: v.tieneHorario,
      entradaMin: v.entradaMin,
      entradasMin: v.entradasMin,
      salidaMin: v.salidaMin,
      salidasMin: v.salidasMin,
      popupMargenAntesMin: v.popupMargenAntesMin,
      popupMargenDespuesMin: v.popupMargenDespuesMin,
      margenDespuesMin: v.margenDespuesMin,
      permitirFueraHorario: v.permitirFueraHorario,
      avisoSonido: v.avisoSonido,
      avisoVibracion: v.avisoVibracion,
      zonaHoraria: v.zonaHoraria,
    });
    // Recalcula "ahora" en la zona de la empresa (entradaMin/salidaMin van
    // en esa referencia), por si difiere de la del dispositivo.
    setNowMin(minutosAhoraEnZona(v.zonaHoraria));
  }, []);

  // Carga inicial: estado del fichaje + ventana horaria del día.
  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([refetch(), refetchVentana()]);
      if (!alive) return;
      setCargado(true);
    })();
    return () => {
      alive = false;
    };
  }, [refetch, refetchVentana]);

  // La ventana se cargaba UNA sola vez al montar y se quedaba congelada: quien
  // dejaba la app abierta en segundo plano por la mañana volvía a su turno de
  // tarde con los datos de la mañana, y el aviso de fichar no saltaba nunca.
  // Se refresca cada 10 min, y además al cambiar de día (turnos de noche: a las
  // 00:00 el día de la empresa cambia y toca releer los turnos).
  const diaCargado = useRef<string | null>(null);
  useEffect(() => {
    const i = setInterval(() => void refetchVentana(), 600_000);
    return () => clearInterval(i);
  }, [refetchVentana]);

  useEffect(() => {
    if (!ventana?.zonaHoraria) return;
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: ventana.zonaHoraria });
    if (diaCargado.current === null) {
      diaCargado.current = hoy;
      return;
    }
    if (diaCargado.current !== hoy) {
      diaCargado.current = hoy;
      void refetchVentana();
    }
  }, [nowMin, ventana?.zonaHoraria, refetchVentana]);

  // Reloj en vivo (1 s) mientras hay jornada abierta: alimenta el cronómetro.
  useEffect(() => {
    if (!trabajando) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [trabajando]);

  // Tick lento (20 s) siempre activo: refresca la hora actual para reevaluar la
  // ventana de fichaje y el tiempo de posposición del pop-up.
  useEffect(() => {
    const tz = ventana?.zonaHoraria;
    const i = setInterval(() => setNowMin(minutosAhoraEnZona(tz)), 20_000);
    return () => clearInterval(i);
  }, [ventana?.zonaHoraria]);

  // Al volver a la app, refrescar estado y la hora actual.
  useEffect(() => {
    const onFocus = () => {
      void refetch();
      // La ventana también: volver a la app tras horas es justo el caso en que
      // los turnos cargados pueden ser ya de otro momento (u otro día).
      void refetchVentana();
      setNowMin(minutosAhoraEnZona(ventana?.zonaHoraria));
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refetch, refetchVentana, ventana?.zonaHoraria]);

  // Sonido/vibración cuando aparece el aviso (solo en la transición a visible).
  const avisoEmitido = useRef(false);
  useEffect(() => {
    const { debeEntrada, debeSalida } = calcularDebe(ventana, estado, trabajando, nowMin);
    const debe = debeEntrada || debeSalida;
    const pospuesto = pospuestoHasta != null && Date.now() < pospuestoHasta;
    const mostrar = cargado && habilitado && debe && !pospuesto;
    if (mostrar && !avisoEmitido.current) {
      avisoEmitido.current = true;
      reproducirAvisoFichaje({
        sonido: ventana?.avisoSonido ?? false,
        vibracion: ventana?.avisoVibracion ?? false,
      });
    } else if (!mostrar) {
      avisoEmitido.current = false;
    }
  }, [ventana, estado, trabajando, nowMin, pospuestoHasta, cargado, habilitado]);

  const onFichado = async () => {
    await refetch();
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

  // ── ¿Toca fichar ahora? Según la config de Ajustes RRHH → Fichajes ────────
  const { debeEntrada, debeSalida, objetivoMin } = calcularDebe(
    ventana,
    estado,
    trabajando,
    nowMin,
  );
  const debeFichar = debeEntrada || debeSalida;

  const pospuesto = pospuestoHasta != null && Date.now() < pospuestoHasta;
  const mostrarFichar = debeFichar && !pospuesto;

  // Segundero de la cuenta atrás: el tick lento de 20 s vale para decidir SI se
  // muestra el aviso, pero no para un contador que baja segundo a segundo.
  useEffect(() => {
    if (!mostrarFichar) return;
    const i = setInterval(() => setSegundoTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [mostrarFichar]);

  // Segundos con signo hasta la hora del turno (negativo = ya pasó). Se calcula
  // con segundos reales en la zona de la EMPRESA, no con `nowMin`, que solo
  // tiene resolución de minuto.
  const restanteSeg = (() => {
    if (objetivoMin == null) return null;
    const tz = ventana?.zonaHoraria ?? "Europe/Madrid";
    const [h, m, sec] = new Date()
      .toLocaleTimeString("en-GB", { timeZone: tz, hour12: false })
      .split(":")
      .map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const ahoraSeg = h * 3600 + m * 60 + (Number.isFinite(sec) ? sec : 0);
    let d = objetivoMin * 60 - ahoraSeg;
    // Circular sobre 24 h (turnos que cruzan medianoche).
    if (d > 43200) d -= 86400;
    if (d < -43200) d += 86400;
    return d;
  })();

  // "Tarde" NO es pasarse un segundo de la hora: dentro de la cortesía (5 min
  // en BACANAL/HABANA) el fichaje se acepta y se redondea a la hora del turno.
  // El rojo salta cuando esa cortesía se agota, que es cuando el servidor ya
  // rechaza y la única vía es la solicitud. Con `permitirFueraHorario` no hay
  // hora límite, así que nunca se marca tarde.
  const llegaTarde =
    restanteSeg != null &&
    !ventana?.permitirFueraHorario &&
    restanteSeg < -(ventana?.margenDespuesMin ?? 0) * 60;

  const posponer = () => setPospuestoHasta(Date.now() + POSPONER_MS);

  // Hora de salida prevista (HH:MM) del tramo que está cursando, para poder
  // decirle en el aviso a qué hora terminaba. El tramo es el primer fin que
  // aún no ha pasado; si ya pasaron todos, no se muestra hora.
  const salidaPrevista = (() => {
    const finales = ventana?.salidasMin?.length
      ? ventana.salidasMin
      : ventana?.salidaMin != null
        ? [ventana.salidaMin]
        : [];
    if (finales.length === 0) return null;
    const pendiente =
      finales.find((fin) => {
        let d = (((fin - nowMin) % 1440) + 1440) % 1440;
        if (d > 720) d -= 1440;
        return d > 0;
      }) ?? null;
    if (pendiente == null) return null;
    const h = Math.floor(pendiente / 60);
    const m = pendiente % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  })();

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

      {/* Pop-up de fichar: solo dentro de la ventana horaria (±15 min) */}
      {mostrarFichar && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50"
          onClick={posponer}
        >
          <div
            className="rounded-t-3xl bg-background pb-[max(env(safe-area-inset-bottom),16px)] pt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted" />
            <div className="flex items-center justify-between px-5">
              <h2 className="text-lg font-semibold">
                {llegaTarde
                  ? debeSalida
                    ? "Se te ha pasado la salida"
                    : "Se te ha pasado el fichaje"
                  : debeSalida
                    ? "¿Fichar salida?"
                    : "¿Fichar entrada?"}
              </h2>
              <button
                onClick={posponer}
                aria-label="Ahora no"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Cuenta atrás: baja hasta 00:00 en verde y sigue en negativo y en
                rojo una vez agotada la cortesía. El corte no es estético: a
                partir de ahí el servidor rechaza el fichaje, así que el aviso
                deja de pedir que fiches y explica qué hacer. */}
            {restanteSeg != null && (
              <div className="flex flex-col items-center px-5 pt-3">
                <span
                  className={cn(
                    "text-5xl font-bold leading-none tabular-nums",
                    llegaTarde ? "text-rose-600" : "text-emerald-600",
                  )}
                >
                  {formatoCuentaAtras(restanteSeg)}
                </span>
                <span
                  className={cn(
                    "mt-1 text-xs font-medium uppercase tracking-wider",
                    llegaTarde ? "text-rose-600" : "text-muted-foreground",
                  )}
                >
                  {llegaTarde ? "Vas tarde" : debeSalida ? "Para tu salida" : "Para tu entrada"}
                </span>
              </div>
            )}

            <p
              className={cn(
                "px-5 pt-3 text-sm",
                llegaTarde ? "text-rose-600" : "text-muted-foreground",
              )}
            >
              {llegaTarde
                ? "Ya se ha pasado tu hora de fichaje y llegas tarde. Si has asistido, tendrás que fichar por solicitud para que tu responsable lo valide."
                : debeSalida
                  ? "Es tu hora de salida. Registra tu salida para cerrar la jornada."
                  : "Es tu hora de entrada. Registra tu entrada para empezar la jornada."}
            </p>
            <BigClockButton
              fichajeId={debeSalida ? fichaje?.id ?? null : null}
              estado={debeSalida ? estado : "sin-fichar"}
              onAction={onFichado}
            />
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
                  {formatHoraEnZona(fichaje.horaEntrada, fichaje.zonaHoraria)}
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
                {/* Aviso claro ANTES de escribir el motivo: paralizar cierra la
                    jornada antes de la hora prevista y solo cuentan las horas
                    realmente fichadas. Que nadie lo haga sin saberlo. */}
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-900 dark:bg-rose-950">
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                    Vas a salir antes de tu horario
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-rose-600 dark:text-rose-400">
                    Se cerrará tu jornada ahora y solo contarán las horas que
                    llevas fichadas
                    {salidaPrevista ? ` (tu salida era a las ${salidaPrevista})` : ""}.
                    ¿Es lo que quieres?
                  </p>
                </div>
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
