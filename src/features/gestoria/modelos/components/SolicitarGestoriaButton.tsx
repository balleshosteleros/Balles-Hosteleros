"use client";

import { useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reenviarSolicitudGestoria } from "../actions/solicitud-gestoria-actions";

/**
 * Botón para (RE)ENVIAR a la gestoría el correo con el enlace de subida de los
 * modelos del periodo. El envío normal es automático (cron, al día siguiente
 * del último día de presentación); esto sirve para reenviarlo manualmente.
 *
 * Va dentro del <Link> de la card / dentro del editor: detiene la propagación.
 * `solicitado` cambia solo la etiqueta ("Reenviar" vs "Solicitar").
 */
export function SolicitarGestoriaButton({
  modeloId,
  solicitado,
  className,
}: {
  modeloId: string;
  solicitado: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await reenviarSolicitudGestoria(modeloId);
      if (res.ok) {
        toast.success(
          res.destino
            ? `Correo enviado a la gestoría (${res.destino}).`
            : "Correo enviado a la gestoría.",
        );
      } else {
        toast.error(res.error ?? "No se pudo enviar el correo.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        className ??
        "inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
      }
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      {solicitado ? "Reenviar a gestoría" : "Solicitar a gestoría"}
    </button>
  );
}
