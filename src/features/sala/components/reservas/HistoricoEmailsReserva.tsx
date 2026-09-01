"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Mail, MessageCircle, Smartphone } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  listReservaEmailEnvios,
  type ReservaEmailEnvio,
} from "@/features/sala/actions/reserva-email-envios-actions";
import { RESERVA_EMAIL_TIPO_LABELS } from "@/lib/seeds/reserva-email-plantillas";
import {
  listMensajeriaEnvios,
  type MensajeriaEnvio,
} from "@/features/mensajeria/actions/envios-actions";

/**
 * Una línea del histórico, venga del correo o de la mensajería. Se unifican
 * porque a quien mira la ficha le importa QUÉ se le ha dicho al cliente, no
 * por qué tubería salió.
 */
interface LineaComunicacion {
  id: string;
  via: "CORREO" | "WHATSAPP" | "SMS";
  titulo: string;
  destinatario: string | null;
  autor: string;
  enviadoAt: string;
  /** Solo en WhatsApp y SMS: el correo no informa de la entrega. */
  estado: string | null;
  fallido: boolean;
}

const TIPO_MENSAJERIA_LABEL: Record<string, string> = {
  CONFIRMACION: "Confirmación",
  RECONFIRMACION: "Reconfirmación",
  RECORDATORIO: "Recordatorio",
  CANCELACION: "Cancelación",
  CAMPANA: "Campaña",
};

/** Lo que el restaurante necesita saber: si llegó o no. */
const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Enviando",
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
  LEIDO: "Leído",
  FALLIDO: "No se entregó",
};

function autorMensajeria(envio: MensajeriaEnvio): string {
  if (envio.usuarioNombre) return envio.usuarioNombre;
  switch (envio.origen) {
    case "PORTAL_PUBLICO":
      return "Reserva online del cliente";
    case "GOOGLE_RWG":
      return "Reserva desde Google";
    default:
      return "Envío automático";
  }
}

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
    lineas: LineaComunicacion[];
  } | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    // Las dos fuentes se piden a la vez: son independientes y esperar una
    // detrás de otra doblaría el tiempo de carga sin ganar nada.
    Promise.all([
      listReservaEmailEnvios(reservaId),
      listMensajeriaEnvios(reservaId),
    ]).then(([correos, mensajes]) => {
      // Si mientras cargaba se abrió otra reserva, este resultado ya no vale.
      if (!vigente) return;

      const lineas: LineaComunicacion[] = [
        ...correos.data.map((e): LineaComunicacion => ({
          id: `correo-${e.id}`,
          via: "CORREO",
          titulo: RESERVA_EMAIL_TIPO_LABELS[e.tipo],
          destinatario: e.destinatario,
          autor: autor(e),
          enviadoAt: e.enviadoAt,
          estado: null,
          fallido: false,
        })),
        ...mensajes.data.map((m): LineaComunicacion => ({
          id: `msg-${m.id}`,
          via: m.canal,
          titulo: TIPO_MENSAJERIA_LABEL[m.tipo] ?? m.tipo,
          destinatario: m.destinatario,
          autor: autorMensajeria(m),
          enviadoAt: m.enviadoAt,
          estado: ESTADO_LABEL[m.estado] ?? m.estado,
          fallido: m.estado === "FALLIDO",
        })),
      ].sort((a, b) => b.enviadoAt.localeCompare(a.enviadoAt));

      setCargado({ reservaId, lineas });
    });
    return () => {
      vigente = false;
    };
  }, [reservaId]);

  const cargando = cargado?.reservaId !== reservaId;
  const envios = cargando ? [] : (cargado?.lineas ?? []);

  const tz = empresaActual?.zonaHoraria;

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto} className="space-y-2">
      {/* Plegado por defecto: en la ficha lo que se consulta a diario es la
          reserva, no los correos. Se abre cuando hace falta comprobar qué se
          le ha mandado al cliente. El número va en la cabecera para saberlo
          sin desplegar. */}
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <span>Comunicaciones</span>
        {!cargando && envios.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {envios.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 transition-transform",
            abierto && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2">
      {cargando ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : envios.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no se ha enviado nada al cliente de esta reserva.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {envios.map((e) => (
            <li
              key={e.id}
              className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {e.via === "CORREO" ? (
                    <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : e.via === "WHATSAPP" ? (
                    <MessageCircle className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <Smartphone className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  {e.titulo}
                </span>
                <span className="text-muted-foreground">
                  {tz ? formatFechaHoraEnZona(e.enviadoAt, tz) : "—"}
                </span>
              </div>
              <div className="mt-0.5 text-muted-foreground">
                Enviado por{" "}
                <span className="font-medium text-foreground">{e.autor}</span>
                {e.destinatario ? ` · ${e.destinatario}` : ""}
                {/* El estado solo se pinta en WhatsApp y SMS: del correo no
                    sabemos si llegó, y decir "enviado" daría a entender que sí. */}
                {e.estado && (
                  <>
                    {" · "}
                    <span className={cn(e.fallido && "text-destructive")}>
                      {e.estado}
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      </CollapsibleContent>
    </Collapsible>
  );
}
