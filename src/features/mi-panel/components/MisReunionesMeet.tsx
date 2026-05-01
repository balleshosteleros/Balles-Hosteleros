"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Video, Clock, Users, RefreshCw, ExternalLink, Loader2, MapPin,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoogleConnectBanner } from "@/features/google-workspace/components/GoogleConnectBanner";
import { useGoogleConnection } from "@/features/google-workspace/components/useGoogleConnection";

type Filtro = "hoy" | "manana" | "semana" | "mes";

interface EventoApi {
  id: string;
  calendarId: string;
  titulo: string;
  descripcion?: string;
  hora: string;
  duracion: string;
  lugar?: string;
  participantes?: string[];
  diaIndex: number;
  allDay: boolean;
  inicio: string;
  fin: string;
  fechaDia: string;
  meetLink: string | null;
}

interface ReunionesResponse {
  connected: boolean;
  needsReauth?: boolean;
  eventos: EventoApi[];
}

const DIAS_LARGOS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];
const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function inicioSemanaLunes(base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const diaSemana = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - diaSemana);
  return d;
}

function etiquetaFecha(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  const hoyKey = ymd(hoy);
  const mananaDate = new Date(hoy);
  mananaDate.setDate(hoy.getDate() + 1);
  const mananaKey = ymd(mananaDate);
  const fechaKey = ymd(fecha);

  if (fechaKey === hoyKey) return "Hoy";
  if (fechaKey === mananaKey) return "Mañana";

  const dia = DIAS_LARGOS[fecha.getDay()];
  const mesCorto = MESES_CORTOS[fecha.getMonth()];
  return `${dia} ${fecha.getDate()} ${mesCorto}`;
}

export function MisReunionesMeet() {
  const { connected } = useGoogleConnection();
  const [eventos, setEventos] = useState<EventoApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("hoy");
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsReauth(false);
    try {
      const hoy = new Date();
      const ref = ymd(hoy);
      const res = await fetch(
        `/api/google/calendar/events?view=month&date=${ref}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setError("No se pudieron cargar las reuniones");
        setEventos([]);
        return;
      }
      const data = (await res.json()) as ReunionesResponse;
      if (data.needsReauth) {
        setNeedsReauth(true);
        setEventos([]);
        return;
      }
      if (!data.connected) {
        setEventos([]);
        return;
      }
      const conMeet = (data.eventos ?? []).filter((e) => !!e.meetLink);
      conMeet.sort(
        (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
      );
      setEventos(conMeet);
    } catch (err) {
      console.error("[mis-reuniones] error cargando", err);
      setError("Error de red al cargar reuniones");
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) cargar();
  }, [connected, cargar]);

  const grupos = useMemo(() => {
    const ahora = new Date();
    const hoyKey = ymd(ahora);
    const manana = new Date(ahora);
    manana.setDate(ahora.getDate() + 1);
    const mananaKey = ymd(manana);

    const inicioSem = inicioSemanaLunes(ahora);
    const finSem = new Date(inicioSem);
    finSem.setDate(inicioSem.getDate() + 7);

    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);

    const futuros = eventos.filter(
      (e) => new Date(e.fin).getTime() >= ahora.getTime(),
    );

    const hoy = futuros.filter((e) => ymd(new Date(e.inicio)) === hoyKey);
    const mananaArr = futuros.filter(
      (e) => ymd(new Date(e.inicio)) === mananaKey,
    );
    const semana = futuros.filter((e) => {
      const t = new Date(e.inicio).getTime();
      return t >= inicioSem.getTime() && t < finSem.getTime();
    });
    const mes = futuros.filter((e) => {
      const t = new Date(e.inicio).getTime();
      return t >= inicioMes.getTime() && t < finMes.getTime();
    });

    return { hoy, manana: mananaArr, semana, mes };
  }, [eventos]);

  const lista =
    filtro === "hoy"
      ? grupos.hoy
      : filtro === "manana"
        ? grupos.manana
        : filtro === "semana"
          ? grupos.semana
          : grupos.mes;

  const tabs: { key: Filtro; label: string; count: number }[] = [
    { key: "hoy", label: "Hoy", count: grupos.hoy.length },
    { key: "manana", label: "Mañana", count: grupos.manana.length },
    { key: "semana", label: "Esta semana", count: grupos.semana.length },
    { key: "mes", label: "Este mes", count: grupos.mes.length },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100">
            <Video className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">Mis reuniones</h2>
            <p className="text-[11px] text-muted-foreground">
              Eventos de Google Calendar con videollamada de Meet
            </p>
          </div>
        </div>
        {connected && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={cargar}
            disabled={loading}
            title="Actualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {!connected ? (
        <div className="px-4 py-4 md:px-5">
          <GoogleConnectBanner servicio="Google Calendar" />
        </div>
      ) : needsReauth ? (
        <div className="px-4 py-4 md:px-5">
          <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold text-foreground">
                La sesión con Google ha caducado
              </p>
              <p className="text-[11px] text-muted-foreground">
                Reconecta tu cuenta para volver a cargar las reuniones de Meet.
              </p>
            </div>
            <a
              href={`/api/google/connect?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/mi-panel/calendario")}`}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-amber-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
            >
              Reconectar Google
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="flex border-b bg-muted/20">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFiltro(t.key)}
                className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  filtro === t.key
                    ? "border-b-2 border-emerald-600 bg-emerald-50/50 text-emerald-700"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                      filtro === t.key
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando reuniones…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
              <p className="text-sm font-medium text-rose-600">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={cargar}
              >
                Reintentar
              </Button>
            </div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-10 text-center text-muted-foreground">
              <Video className="mb-3 h-9 w-9 opacity-20" />
              <p className="text-sm font-medium">
                {filtro === "hoy" && "No tienes reuniones hoy"}
                {filtro === "manana" && "No tienes reuniones mañana"}
                {filtro === "semana" && "No tienes reuniones esta semana"}
                {filtro === "mes" && "No tienes reuniones este mes"}
              </p>
              <p className="mt-1 text-xs opacity-70">
                Solo se muestran eventos con videollamada de Meet
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {lista.map((ev) => {
                const fecha = etiquetaFecha(ev.inicio);
                const asistentes = ev.participantes?.length ?? 0;
                return (
                  <li
                    key={`${ev.calendarId}-${ev.id}`}
                    className="px-4 py-3 transition-colors hover:bg-muted/30 md:px-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                            {fecha}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            · {ev.allDay ? "Todo el día" : ev.hora} · {ev.duracion}
                          </span>
                        </div>
                        <p className="truncate text-sm font-semibold leading-tight">
                          {ev.titulo}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {!ev.allDay && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {ev.hora}
                            </span>
                          )}
                          {asistentes > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {asistentes} {asistentes === 1 ? "asistente" : "asistentes"}
                            </span>
                          )}
                          {ev.lugar && (
                            <span className="flex max-w-[180px] items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{ev.lugar}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {ev.meetLink && (
                        <Button
                          size="sm"
                          className="h-9 shrink-0 gap-1.5 bg-emerald-600 px-4 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700"
                          onClick={() => window.open(ev.meetLink!, "_blank")}
                        >
                          <Video className="h-3.5 w-3.5" />
                          Entrar
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
