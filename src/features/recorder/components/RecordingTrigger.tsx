"use client";

import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordingStore } from "../store/recording-store";
import { useRecorder } from "../contexts/recorder-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { cn } from "@/lib/utils";

export function RecordingTrigger() {
  const { setDrawerOpen, state } = useRecordingStore();
  const { pendingCount } = useRecorder();
  const { ajustes } = useEmpresa();
  const badgeActivo = ajustes.notificaciones.grabacion.badgeActivo;
  const isRecording = state === "recording";
  const badgeCount = pendingCount > 9 ? "9+" : pendingCount;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8"
      onClick={() => setDrawerOpen(true)}
      title="Grabar pantalla"
    >
      <Monitor className={cn("!h-[18px] !w-[18px]", isRecording ? "text-red-600" : "text-fuchsia-600")} />

      {isRecording ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
        </span>
      ) : badgeActivo && pendingCount > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-3.5 min-w-3.5 px-0.5 rounded-full text-white text-[8px] font-bold leading-none bg-red-500">
          {badgeCount}
        </span>
      ) : null}
    </Button>
  );
}
