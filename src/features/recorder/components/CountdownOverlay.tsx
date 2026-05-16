"use client";

import { useRecordingStore } from "../store/recording-store";

export function CountdownOverlay() {
  const { state, countdownValue } = useRecordingStore();

  if (state !== "countdown" || countdownValue <= 0) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/40 rounded-full blur-3xl animate-pulse" />
          <div
            key={countdownValue}
            className="relative w-48 h-48 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-2xl shadow-red-500/50 animate-in zoom-in-50 duration-500"
          >
            <span className="text-white text-8xl font-bold tabular-nums drop-shadow-lg">
              {countdownValue}
            </span>
          </div>
        </div>
        <p className="text-white text-lg font-semibold drop-shadow-lg tracking-wide">
          La grabación empieza en…
        </p>
      </div>
    </div>
  );
}
