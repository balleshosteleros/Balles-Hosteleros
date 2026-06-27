"use client";

/**
 * TelefonoDrawer — VoIP softphone integrado en la barra superior.
 *
 * Diseñado para conectarse a:
 *   - Twilio Voice SDK  (https://www.twilio.com/docs/voice/sdks/javascript)
 *   - SIP.js / JsSIP   (WebRTC SIP genérico)
 *
 * En este estado: UI completa lista para integración.
 * Para activar llamadas reales añade tus credenciales SIP o Twilio
 * en Ajustes → Teléfono y descarga el SDK correspondiente.
 */

import { ReactNode, useState, useEffect, useRef } from "react";
import {
  Phone, PhoneOff, PhoneMissed, PhoneCall,
  Mic, MicOff, Volume2, VolumeX,
  Delete, Wifi, WifiOff, Users,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DirectorioEmpleados } from "@/features/llamadas-internas/components/DirectorioEmpleados";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

type CallState = "idle" | "ringing" | "connected" | "ended";

interface RecentCall {
  id: string;
  numero: string;
  nombre?: string;
  tipo: "saliente" | "entrante" | "perdida";
  duracion?: string;
  hora: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Sin telefonía VoIP conectada todavía no hay registro de llamadas: lista vacía.
// Cuando exista backend (B2COM/SIP/Twilio), poblar desde la tabla de llamadas reales.
const RECENT_CALLS: RecentCall[] = [];

// Cuenta llamadas entrantes nuevas no vistas (perdidas) para el badge de la barra.
// Mientras no haya backend de llamadas reales, siempre 0 (no inventar perdidas).
export function contarLlamadasNoVistas(): number {
  return RECENT_CALLS.filter((c) => c.tipo === "perdida").length;
}

const DIAL_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export const LLAMAR_EVENT = "balles:llamar";

/** Dispara una llamada desde cualquier parte del software. Abre el TelefonoDrawer con el número precargado. */
export function llamarDesdeApp(numero: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LLAMAR_EVENT, { detail: { numero } }));
}

export function TelefonoDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"equipo" | "marcador" | "recientes">("equipo");
  const [numero, setNumero] = useState("");
  const [callState, setCallState] = useState<CallState>("idle");
  const [callSeconds, setCallSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // La configuración del teléfono vive en Ajustes → Herramientas → Teléfono.
  const { ajustes } = useEmpresa();
  const isConnected = ajustes.telefonia.proveedor !== "none";

  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<{ numero?: string }>;
      const n = ce.detail?.numero?.replace(/\s/g, "") ?? "";
      if (n) setNumero(n);
      setTab("marcador");
      setOpen(true);
    }
    window.addEventListener(LLAMAR_EVENT, handler);
    return () => window.removeEventListener(LLAMAR_EVENT, handler);
  }, []);

  // Timer during call
  useEffect(() => {
    if (callState === "connected") {
      timerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const pressKey = (k: string) => {
    if (callState === "connected") return; // dtmf - would send tone
    setNumero((n) => n + k);
  };

  const handleCall = () => {
    if (!numero.trim()) return;
    if (!isConnected) return; // sin proveedor configurado en Ajustes → Teléfono
    // TODO: integrar Twilio Device.connect({ params: { To: numero } })
    //       o SIP.js session.invite(numero)
    setCallState("ringing");
    setTimeout(() => setCallState("connected"), 2000); // demo: simula conexión
  };

  const handleHangUp = () => {
    // TODO: llamar a device.disconnectAll() o session.terminate()
    setCallState("ended");
    setTimeout(() => { setCallState("idle"); setNumero(""); }, 1500);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-5 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-sky-600" />
              Teléfono
            </SheetTitle>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge className="bg-emerald-600 text-white text-[10px] h-5 gap-1">
                  <Wifi className="h-3 w-3" /> Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-[10px] h-5 gap-1">
                  <WifiOff className="h-3 w-3" /> Sin configurar
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b bg-muted/20 shrink-0">
          {(["equipo", "marcador", "recientes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 ${
                tab === t
                  ? "border-b-2 border-sky-600 text-sky-700 bg-sky-50/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "equipo" && <Users className="h-3.5 w-3.5" />}
              {t === "marcador" && <Phone className="h-3.5 w-3.5" />}
              {t === "recientes" && <PhoneCall className="h-3.5 w-3.5" />}
              {t === "equipo" ? "Equipo" : t === "marcador" ? "Marcador" : "Recientes"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* ─── EQUIPO (llamadas internas entre empleados, gratis por internet) ─── */}
          {tab === "equipo" && (
            <div className="px-4 py-4">
              <DirectorioEmpleados onIniciar={() => setOpen(false)} />
            </div>
          )}

          {/* ─── MARCADOR ─── */}
          {tab === "marcador" && (
            <div className="flex flex-col items-center px-6 py-5 gap-5">
              {/* Display número / estado llamada */}
              <div className="w-full">
                {callState === "idle" || callState === "ended" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCall()}
                      placeholder="+34 600 000 000"
                      className="text-center text-xl font-mono h-12 tracking-widest border-0 border-b rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-sky-500"
                    />
                    {numero && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => setNumero((n) => n.slice(0, -1))}
                      >
                        <Delete className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-2xl font-mono font-semibold text-foreground">{numero}</p>
                    {callState === "ringing" && (
                      <p className="text-sm text-sky-600 mt-1 animate-pulse">Llamando…</p>
                    )}
                    {callState === "connected" && (
                      <p className="text-sm text-emerald-600 mt-1 font-semibold">
                        {formatDuration(callSeconds)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                {DIAL_KEYS.map((row, ri) =>
                  row.map((k) => (
                    <button
                      key={`${ri}-${k}`}
                      onClick={() => pressKey(k)}
                      disabled={callState === "connected" || callState === "ringing"}
                      className="h-14 w-full rounded-2xl border bg-card hover:bg-muted/60 active:scale-95 transition-all text-xl font-semibold text-foreground shadow-sm disabled:opacity-40"
                    >
                      {k}
                    </button>
                  ))
                )}
              </div>

              {/* Botones de acción */}
              {callState === "idle" || callState === "ended" ? (
                <Button
                  onClick={handleCall}
                  disabled={!numero.trim()}
                  className="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30"
                  size="icon"
                >
                  <Phone className="h-6 w-6" />
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-5">
                  {/* Mute */}
                  <Button
                    variant="outline" size="icon"
                    className={`h-12 w-12 rounded-full ${muted ? "bg-red-50 border-red-300 text-red-600" : ""}`}
                    onClick={() => setMuted((m) => !m)}
                  >
                    {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>

                  {/* Colgar */}
                  <Button
                    onClick={handleHangUp}
                    className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30"
                    size="icon"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>

                  {/* Altavoz */}
                  <Button
                    variant="outline" size="icon"
                    className={`h-12 w-12 rounded-full ${speakerOff ? "bg-muted" : ""}`}
                    onClick={() => setSpeakerOff((s) => !s)}
                  >
                    {speakerOff ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                </div>
              )}

              {/* Aviso sin configurar */}
              {!isConnected && callState === "idle" && (
                <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-xs">
                  Configura tu proveedor VoIP en{" "}
                  <span className="font-semibold">Ajustes → Herramientas → Teléfono</span>{" "}
                  para realizar llamadas reales.
                </p>
              )}
            </div>
          )}

          {/* ─── RECIENTES ─── */}
          {tab === "recientes" && (
            <div className="divide-y">
              {RECENT_CALLS.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
                  <PhoneOff className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No hay llamadas recientes</p>
                  <p className="text-xs text-muted-foreground/70">
                    Aparecerán aquí cuando la telefonía esté conectada.
                  </p>
                </div>
              )}
              {RECENT_CALLS.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
                >
                  {/* Icono tipo llamada */}
                  <div
                    className={`h-9 w-9 rounded-full shrink-0 flex items-center justify-center ${
                      call.tipo === "perdida"
                        ? "bg-red-100"
                        : call.tipo === "entrante"
                          ? "bg-sky-100"
                          : "bg-emerald-100"
                    }`}
                  >
                    {call.tipo === "perdida" ? (
                      <PhoneMissed className="h-4 w-4 text-red-600" />
                    ) : call.tipo === "entrante" ? (
                      <PhoneCall className="h-4 w-4 text-sky-600 scale-x-[-1]" />
                    ) : (
                      <PhoneCall className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${call.tipo === "perdida" ? "text-red-600" : ""}`}>
                      {call.nombre ?? call.numero}
                    </p>
                    {call.nombre && (
                      <p className="text-xs text-muted-foreground truncate">{call.numero}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {call.hora}{call.duracion ? ` · ${call.duracion}` : ""}
                    </p>
                  </div>

                  {/* Botón llamar de vuelta */}
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 shrink-0 hover:bg-emerald-50 hover:text-emerald-600"
                    onClick={() => { setNumero(call.numero.replace(/\s/g, "")); setTab("marcador"); }}
                    title="Llamar"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
