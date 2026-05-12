"use client";

import { useRecordingStore } from "../store/recording-store";
import { cn } from "@/lib/utils";

export function RecordingOverlay() {
  const { state } = useRecordingStore();
  
  if (state !== "recording") return null;

  return (
    <div className="fixed inset-0 border-[4px] border-red-500/60 z-[9999] pointer-events-none shadow-[inset_0_0_20px_rgba(239,68,68,0.3)] animate-in fade-in duration-300">
      <div className="absolute inset-0 border-[2px] border-red-500/80 animate-pulse" />
      
      {/* REC Indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/80 backdrop-blur-md text-white px-4 py-1.5 rounded-full border border-red-500/50 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]" />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Recording</span>
        </div>
        <div className="w-px h-3 bg-white/20" />
        <span className="text-[10px] font-medium text-white/70">ReelForge Recorder</span>
      </div>
    </div>
  );
}
