"use client";

import { Button } from "@/components/ui/button";
import { useRecordingStore } from "../store/recording-store";
import { useRecorder } from "../contexts/recorder-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { cn } from "@/lib/utils";
import { HERRAMIENTA, toolTextColor } from "@/features/layout/data/herramientas";

export function RecordingTrigger() {
  const { setDrawerOpen, state } = useRecordingStore();
  const { pendingCount, newCount } = useRecorder();
  const { ajustes } = useEmpresa();
  const badgeActivo = ajustes.notificaciones.grabacion.badgeActivo;
  const isRecording = state === "recording";
  // Prioridad del badge: pendientes de subir (rojo, acción del usuario) por
  // encima de "grabaciones nuevas" de otros (informativo). Ambos se suman para
  // el número mostrado; el estilo lo marca si hay algo pendiente de subir.
  const hayPendientes = pendingCount > 0;
  const totalBadge = pendingCount + newCount;
  const badgeCount = totalBadge > 9 ? "9+" : totalBadge;
  const mostrarBadge = badgeActivo && totalBadge > 0;
  const { Icon: GrabacionIcon, colorKey } = HERRAMIENTA.grabacion;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8"
      onClick={() => setDrawerOpen(true)}
      title="Grabar pantalla"
    >
      <GrabacionIcon className={cn("!h-[18px] !w-[18px]", isRecording ? "text-red-600" : toolTextColor(colorKey))} />

      {isRecording ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
        </span>
      ) : mostrarBadge ? (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex items-center justify-center h-3.5 min-w-3.5 px-0.5 rounded-full text-white text-[8px] font-bold leading-none",
            hayPendientes ? "bg-red-500" : "bg-blue-500",
          )}
        >
          {badgeCount}
        </span>
      ) : null}
    </Button>
  );
}
