"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Eye, Mail, MessageCircle, Smartphone } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  getReservaEmailCuerpo,
  listReservaEmailEnvios,
  type ReservaEmailEnvio,
} from "@/features/sala/actions/reserva-email-envios-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** Solo en correo: cuándo se abrió, o null si no consta. */
  abiertoAt: string | null;
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
  // Correo que se está viendo en el visor. `cargando` mientras llega el cuerpo,
  // para que el diálogo abra al instante y no parezca que no responde.
  const [viendo, setViendo] = useState<{
    titulo: string;
    destinatario: string | null;
    html: string | null;
    cargando: boolean;
  } | null>(null);

  async function verCorreo(linea: LineaComunicacion) {
    const envioId = linea.id.replace(/^correo-/, "");
    setViendo({
      titulo: linea.titulo,
      destinatario: linea.destinatario,
      html: null,
      cargando: true,
    });
    const res = await getReservaEmailCuerpo(envioId);
    setViendo({
      titulo: linea.titulo,
      destinatario: linea.destinatario,
      html: res.ok ? (res.html ?? null) : null,
      cargando: false,
    });
  }

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
          abiertoAt: e.abiertoAt,
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
          abiertoAt: null,
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
                {/* En WhatsApp y SMS, el estado de entrega que da la pasarela. */}
                {e.estado && (
                  <>
                    {" · "}
                    <span className={cn(e.fallido && "text-destructive")}>
                      {e.estado}
                    </span>
                  </>
                )}
                {/* En correo, si el cliente lo ha abierto. Lo marca el píxel
                    del propio correo: que conste es señal de que llegó a un
                    buzón real. */}
                {e.via === "CORREO" && (
                  <>
                    {" · "}
                    <span
                      className={cn(
                        e.abiertoAt
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {e.abiertoAt ? "Abierto" : "Sin abrir"}
                    </span>
                  </>
                )}
              </div>
              {/* Ver el correo tal cual le llegó al cliente. Solo en correo:
                  de WhatsApp y SMS no se guarda cuerpo. */}
              {e.via === "CORREO" && (
                <button
                  type="button"
                  onClick={() => void verCorreo(e)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Eye className="h-3 w-3 shrink-0" />
                  Ver correo
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      </CollapsibleContent>

      {/* Visor del correo. El HTML va dentro de un iframe con `sandbox`: es
          contenido con estilos propios (tablas, anchos fijos, colores) que
          fuera de un marco se comería el diseño de la ficha, y el sandbox
          impide que ejecute nada. */}
      <Dialog open={viendo !== null} onOpenChange={(v) => !v && setViendo(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {viendo?.titulo}
              {viendo?.destinatario ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {viendo.destinatario}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {viendo?.cargando ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Cargando…
            </p>
          ) : viendo?.html ? (
            <iframe
              title="Correo enviado al cliente"
              sandbox=""
              srcDoc={viendo.html}
              className="h-[70vh] w-full rounded-md border border-border bg-white"
            />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              De este correo no se guardó una copia: se envió antes de que el
              software empezara a guardarlas.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
