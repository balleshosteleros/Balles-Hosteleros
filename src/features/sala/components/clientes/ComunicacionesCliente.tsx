"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Mail, MailOpen, MessageCircle, Smartphone } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  listClienteComunicaciones,
  type ClienteComunicacion,
} from "@/features/sala/actions/cliente-comunicaciones-actions";

/**
 * Comunicaciones del CLIENTE: las campañas que se le han mandado a él —el
 * correo del mes, la felicitación de su cumpleaños—, no las de una reserva.
 *
 * No confundir con `HistoricoEmailsReserva`, que enseña lo que se envió POR UNA
 * RESERVA (confirmación, recordatorio, cancelación) y cambia al abrir otra. Esto
 * acompaña a la persona: se ve igual se abra su ficha desde Clientes o desde
 * cualquiera de sus reservas.
 *
 * Solo lectura: es un registro histórico.
 */
export function ComunicacionesCliente({ clienteId }: { clienteId: string }) {
  const { empresaActual } = useEmpresa();
  // Se guarda de qué cliente son los datos que hay en mano: así "cargando" se
  // deduce y no hay que resetear estado en cada cambio de ficha.
  const [cargado, setCargado] = useState<{
    clienteId: string;
    filas: ClienteComunicacion[];
  } | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    listClienteComunicaciones(clienteId).then((r) => {
      if (vigente) setCargado({ clienteId, filas: r.data });
    });
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  const cargando = cargado?.clienteId !== clienteId;
  const filas = cargando ? [] : (cargado?.filas ?? []);
  const tz = empresaActual?.zonaHoraria;

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto} className="space-y-1">
      {/* Plegada por defecto, con el número en la cabecera: lo que se consulta
          a diario es la reserva, no la publicidad que ha recibido el cliente. */}
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <span>Comunicaciones</span>
        {!cargando && filas.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {filas.length}
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
        ) : filas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no se le ha enviado ninguna campaña.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filas.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    {c.via === "CORREO" ? (
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : c.via === "WHATSAPP" ? (
                      <MessageCircle className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <Smartphone className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    {c.titulo}
                  </span>
                  <span className="text-muted-foreground">
                    {c.enviadoAt && tz ? formatFechaHoraEnZona(c.enviadoAt, tz) : "—"}
                  </span>
                </div>
                {/* De qué campaña vino, en su propia línea: junto al asunto se
                    leían como una sola frase. */}
                {c.campana && c.campana !== c.titulo && (
                  <div className="mt-0.5 text-muted-foreground">{c.campana}</div>
                )}
                <div className="text-muted-foreground">
                  {c.destinatario}
                  {c.fallido && (
                    <>
                      {c.destinatario ? " · " : ""}
                      <span className="text-destructive">
                        No se entregó{c.error ? `: ${c.error}` : ""}
                      </span>
                    </>
                  )}
                </div>
                {c.abiertoAt && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                    <MailOpen className="h-3 w-3 shrink-0" />
                    Abierto {tz ? formatFechaHoraEnZona(c.abiertoAt, tz) : ""}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
