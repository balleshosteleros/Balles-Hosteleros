"use client";

import { Monitor, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordingStore } from "../store/recording-store";
import { cn } from "@/lib/utils";

export function RecordingTrigger() {
  const { setDrawerOpen, state } = useRecordingStore();
  const isRecording = state === "recording";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-9 w-9 rounded-full transition-all duration-300 relative group",
        isRecording ? "bg-red-50 hover:bg-red-100 shadow-sm" : "hover:bg-red-50"
      )}
      onClick={() => setDrawerOpen(true)}
      title={isRecording ? "Grabación activa" : "Grabar pantalla"}
    >
      <div className="relative">
        <Monitor className={cn("h-5 w-5 transition-colors", isRecording ? "text-red-600" : "text-red-500 group-hover:text-red-600")} />
        <div className={cn(
          "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
          isRecording ? "bg-red-600 animate-pulse" : "bg-red-500 shadow-sm"
        )} />
      </div>
      
      {isRecording && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        </span>
      )}
    </Button>
  );
}
