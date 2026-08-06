"use client";

import { useState } from "react";
import { Monitor, Smartphone, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  const detalle = (label: string, d: { activo: boolean; ultimaVez: string | null }) => {
    if (!d.activo) return `${label}: sin avisos activos`;
    if (!d.ultimaVez) return `${label}: avisos activos`;
    // Instante en la zona de la empresa (PRP-069), nunca en la del navegador.
    const tz = empresaActual.zonaHoraria ?? "";
    const fecha = formatFechaEnZona(d.ultimaVez, tz, { day: "numeric", month: "short" });
    return `${label}: activo · visto por última vez ${fecha} · ${formatHoraEnZona(d.ultimaVez, tz)}`;
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
    <div className="flex items-center gap-1.5">
      <span title={detalle("Ordenador", e.ordenador)}>
        <Monitor
          className={`h-4 w-4 ${e.ordenador.activo ? "text-emerald-600" : "text-red-500/70"}`}
        />
      </span>
      <span title={detalle("Móvil", e.movil)}>
        <Smartphone
          className={`h-4 w-4 ${e.movil.activo ? "text-emerald-600" : "text-red-500/70"}`}
        />
      </span>
      {faltaAlguno && usuarioId && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title={
            enviado
              ? "Aviso ya enviado"
              : "Pedirle que active los avisos (le llega a su campana)"
          }
          disabled={enviando || enviado}
          onClick={onPedir}
        >
          {/* Icono de "enviar", NO una campana: en la app la campana ya es el
              buzón de notificaciones y aquí confundía con ella. */}
          <SendHorizonal className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
