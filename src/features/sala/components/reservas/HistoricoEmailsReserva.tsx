"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  listReservaEmailEnvios,
  type ReservaEmailEnvio,
} from "@/features/sala/actions/reserva-email-envios-actions";

const TIPO_LABEL: Record<ReservaEmailEnvio["tipo"], string> = {
  CONFIRMACION: "Confirmación",
  RECONFIRMACION: "Reconfirmación",
  RECORDATORIO: "Recordatorio",
  CANCELACION: "Cancelación",
  SOLICITUD_VALORACION: "Solicitud de valoración",
};

/**
 * Quién lo mandó. Cuando hay una persona del software detrás, su nombre; si no,
 * de dónde salió, que es lo único que se puede afirmar.
 */
function autor(envio: ReservaEmailEnvio): string {
  if (envio.usuarioNombre) return envio.usuarioNombre;
  switch (envio.origen) {
    case "AUTOMATICO":
      return "Envío automático";
    case "PORTAL_PUBLICO":
      return "Reserva online del cliente";
    case "GOOGLE_RWG":
      return "Reserva desde Google";
    default:
      return "Sin registrar";
  }
}

/**
 * Histórico de correos enviados de una reserva. Solo aparece lo que realmente
 * salió: si un correo no se envía, aquí no consta nada.
 */
export function HistoricoEmailsReserva({ reservaId }: { reservaId: string }) {
  const { empresaActual } = useEmpresa();
  // Se guarda de qué reserva son los datos que hay en mano. Así "cargando" se
  // deduce (aún no coinciden) en vez de tener que resetearlo a mano en cada
  // cambio de reserva, que es lo que provocaba renders en cascada.
  const [cargado, setCargado] = useState<{
    reservaId: string;
    envios: ReservaEmailEnvio[];
  } | null>(null);

  useEffect(() => {
    let vigente = true;
    listReservaEmailEnvios(reservaId).then((res) => {
      // Si mientras cargaba se abrió otra reserva, este resultado ya no vale.
      if (!vigente) return;
      setCargado({ reservaId, envios: res.data });
    });
    return () => {
      vigente = false;
    };
  }, [reservaId]);

  const cargando = cargado?.reservaId !== reservaId;
  const envios = cargando ? [] : (cargado?.envios ?? []);

  const tz = empresaActual?.zonaHoraria;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        Correos enviados
      </div>

      {cargando ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : envios.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no se ha enviado ningún correo de esta reserva.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {envios.map((e) => (
            <li
              key={e.id}
              className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-medium text-foreground">
                  {TIPO_LABEL[e.tipo]}
                </span>
                <span className="text-muted-foreground">
                  {tz ? formatFechaHoraEnZona(e.enviadoAt, tz) : "—"}
                </span>
              </div>
              <div className="mt-0.5 text-muted-foreground">
                Enviado por{" "}
                <span className="font-medium text-foreground">{autor(e)}</span>
                {e.destinatario ? ` · ${e.destinatario}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
