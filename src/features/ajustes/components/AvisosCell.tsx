"use client";

import { useState } from "react";
import { Monitor, Smartphone, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  pedirActivarAvisos,
  type EstadoPushUsuario,
} from "@/features/ajustes/actions/push-estado-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona, formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";

const SIN_DATOS: EstadoPushUsuario = {
  ordenador: { activo: false, ultimaVez: null },
  movil: { activo: false, ultimaVez: null },
};

/**
 * Estado de los avisos de un usuario: un icono por aparato (ordenador y móvil),
 * verde si le llegan y rojo si no, más un botón para pedirle que los active.
 *
 * El rojo se lee como "no consta que le lleguen", NO como "los ha bloqueado":
 * desde el servidor no se puede distinguir a quien pulsó "Bloquear" en su
 * navegador de quien simplemente aún no lo ha activado. Por eso el detalle al
 * pasar el ratón dice desde cuándo está activo (o que no consta) en vez de
 * afirmar un motivo que no sabemos.
 */
export function AvisosCell({
  estado,
  usuarioId,
  nombre,
}: {
  estado: EstadoPushUsuario | undefined;
  usuarioId: string | null;
  nombre: string;
}) {
  const { empresaActual } = useEmpresa();
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const e = estado ?? SIN_DATOS;
  const faltaAlguno = !e.ordenador.activo || !e.movil.activo;

  /**
   * Texto del globo al pasar el ratón. Dice en la PRIMERA línea lo único que
   * importa de un vistazo —si le llegan los avisos o no— y deja el matiz debajo.
   */
  const detalle = (
    label: string,
    d: { activo: boolean; ultimaVez: string | null },
  ): { titulo: string; nota: string } => {
    if (!d.activo) {
      return {
        titulo: `${label}: NO recibe avisos`,
        // El rojo NO puede afirmar "los ha bloqueado": desde el servidor no se
        // distingue a quien pulsó "Bloquear" de quien aún no lo ha activado.
        nota: "No consta ningún aparato dado de alta. Puede que aún no los haya activado o que los bloqueara en su navegador.",
      };
    }
    if (!d.ultimaVez) {
      return {
        titulo: `${label}: sí recibe avisos`,
        nota: "Aparato dado de alta y activo.",
      };
    }
    // Instante en la zona de la empresa (PRP-069), nunca en la del navegador.
    const tz = empresaActual.zonaHoraria ?? "";
    const fecha = formatFechaEnZona(d.ultimaVez, tz, { day: "numeric", month: "short" });
    return {
      titulo: `${label}: sí recibe avisos`,
      nota: `Visto por última vez el ${fecha} a las ${formatHoraEnZona(d.ultimaVez, tz)}.`,
    };
  };

  /** Icono con el globo de estado encima. */
  const Indicador = ({
    label,
    dato,
    Icono,
  }: {
    label: string;
    dato: { activo: boolean; ultimaVez: string | null };
    Icono: typeof Monitor;
  }) => {
    const { titulo, nota } = detalle(label, dato);
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">
            <Icono
              className={`h-4 w-4 ${dato.activo ? "text-emerald-600" : "text-red-500/70"}`}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[15rem]">
          <p className="font-medium">{titulo}</p>
          <p className="mt-0.5 text-xs opacity-80">{nota}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const onPedir = async () => {
    if (!usuarioId) return;
    setEnviando(true);
    try {
      const res = await pedirActivarAvisos({ usuarioId, nombre });
      if (res.ok) {
        toast.success(`Aviso enviado a ${nombre}`);
        setEnviado(true);
      } else {
        toast.error(res.error || "No se pudo enviar el aviso");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    // delayDuration bajo: el globo es la única forma de saber si el empleado
    // recibe los avisos, así que tiene que salir al posar el ratón, no tras la
    // espera larga del title nativo del navegador.
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1.5">
        <Indicador label="Ordenador" dato={e.ordenador} Icono={Monitor} />
        <Indicador label="Móvil" dato={e.movil} Icono={Smartphone} />
        {faltaAlguno && usuarioId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                disabled={enviando || enviado}
                onClick={onPedir}
              >
                {/* Icono de "enviar", NO una campana: en la app la campana ya es
                    el buzón de notificaciones y aquí confundía con ella. */}
                <SendHorizonal className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[15rem]">
              <p className="font-medium">
                {enviado ? "Aviso ya enviado" : "Pedirle que active los avisos"}
              </p>
              {!enviado && (
                <p className="mt-0.5 text-xs opacity-80">
                  Le llega a su campana dentro de la app.
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
