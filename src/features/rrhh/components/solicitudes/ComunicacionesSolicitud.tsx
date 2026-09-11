"use client";

/**
 * Lo que se ha mandado sobre una solicitud: por qué vía, qué, a quién, cuándo y
 * quién le dio al botón. Plegado, porque casi nunca hace falta — pero cuando
 * hace falta, hace mucha.
 *
 * Y cuando a la gestoría no le consta ningún aviso, el botón para mandárselo.
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Mail,
  Bell,
  Smartphone,
  Send,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getHistorialSolicitud,
  reenviarBajaMedicaGestoria,
  type HistorialSolicitud,
} from "@/features/mi-panel/actions/comunicaciones-actions";
import type { ComunicacionRegistrada } from "@/features/comunicaciones/services/registro";

/** Icono y color por vía: se reconoce antes por la forma que leyendo. */
const VIA = {
  email: { icon: Mail, label: "Correo", clase: "bg-blue-50 text-blue-600" },
  notificacion: { icon: Bell, label: "Aviso", clase: "bg-violet-50 text-violet-600" },
  push: { icon: Smartphone, label: "Móvil", clase: "bg-cyan-50 text-cyan-600" },
} as const;

function fechaHora(iso: string): { dia: string; hora: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dia: "—", hora: "" };
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { dia: `${dd}/${mm}/${d.getFullYear()}`, hora: `${hh}:${mi}` };
}

function Linea({ c }: { c: ComunicacionRegistrada }) {
  const via = VIA[c.via] ?? VIA.notificacion;
  const Icono = via.icon;
  const { dia, hora } = fechaHora(c.createdAt);
  const fallido = c.estado === "fallido";

  // Quién: el nombre de quien lo mandó, o «Automático» cuando no hubo persona.
  const autor = c.automatico
    ? c.enviadoPorNombre
      ? `Automático · ${c.enviadoPorNombre}`
      : "Automático"
    : c.enviadoPorNombre ?? "—";

  return (
    <div className="grid grid-cols-[26px_1fr_auto] gap-3 items-start border-b px-4 py-3 last:border-b-0">
      <span className={`grid h-[26px] w-[26px] place-items-center rounded-md ${via.clase}`}>
        <Icono className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">
          {c.asunto}
          <span
            className={`ml-2 rounded px-1.5 py-0.5 align-[1px] text-[10px] font-bold uppercase tracking-wide ${
              fallido ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {fallido ? "No salió" : "Enviado"}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {via.label} · A {c.destinatario}
          {c.destinoEmail ? ` (${c.destinoEmail})` : ""} · {autor}
        </p>
        {fallido && c.error && (
          <p className="mt-1 text-xs text-rose-600">{c.error}</p>
        )}
      </div>
      <span className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
        {dia}
        <br />
        {hora}
      </span>
    </div>
  );
}

export function ComunicacionesSolicitud({
  solicitudId,
  defaultAbierto = false,
}: {
  solicitudId: string;
  /** Dentro de un diálogo el pliegue sobra: se abre ya desplegado. */
  defaultAbierto?: boolean;
}) {
  const [abierto, setAbierto] = useState(defaultAbierto);
  const [datos, setDatos] = useState<HistorialSolicitud | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Se carga al abrir, no al pintar la lista: son decenas de solicitudes y casi
  // ninguna se abre.
  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await getHistorialSolicitud(solicitudId);
    setCargando(false);
    if (res.ok && res.data) setDatos(res.data);
    else toast.error(res.error ?? "No se pudo cargar el historial");
  }, [solicitudId]);

  // Nace abierto (dentro de un diálogo): carga sin esperar a que lo pulsen.
  useEffect(() => {
    if (defaultAbierto && !datos && !cargando) void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAbierto]);

  const alternar = () => {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (nuevo && !datos) void cargar();
  };

  const reenviar = async () => {
    setEnviando(true);
    const res = await reenviarBajaMedicaGestoria(solicitudId);
    setEnviando(false);
    if (res.ok) {
      toast.success("Aviso enviado a la gestoría");
      void cargar();
    } else {
      toast.error(res.error ?? "No se pudo enviar");
    }
  };

  const total = datos?.comunicaciones.length ?? 0;
  const faltaAvisar = datos?.esBajaMedica && !datos.gestoriaAvisada;

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        Comunicaciones
        {datos && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
            {total}
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="border-t">
          {cargando ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : total === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              Todavía no ha salido nada sobre esta solicitud.
            </p>
          ) : (
            datos?.comunicaciones.map((c) => <Linea key={c.id} c={c} />)
          )}

          {faltaAvisar && (
            <div className="m-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-orange-300 bg-orange-50/60 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" />
              <span className="min-w-[180px] flex-1 text-xs leading-relaxed text-orange-900">
                <b>La gestoría no está avisada.</b> Se aprobó sin marcar la casilla, o el correo
                no llegó a salir.
              </span>
              <Button size="sm" onClick={reenviar} disabled={enviando}>
                {enviando ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1 h-3.5 w-3.5" />
                )}
                Avisar a la gestoría
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
