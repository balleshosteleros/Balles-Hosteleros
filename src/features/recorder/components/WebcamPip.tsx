"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRecorder } from "../contexts/recorder-context";
import { useRecordingStore } from "../store/recording-store";

const SIZE = 176;

export function WebcamPip() {
  const { cameraStream } = useRecorder();
  const { state } = useRecordingStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPos({
      x: window.innerWidth - SIZE - 24,
      y: window.innerHeight - SIZE - 24,
    });
  }, []);

  const visible = cameraStream && (state === "recording" || state === "paused");

  // Asigna el stream al <video>. Depende de `visible` además de `cameraStream`
  // porque el <video> NO existe en el DOM hasta que la burbuja es visible (durante
  // el countdown está desmontado). Sin esta dependencia, el efecto corría cuando
  // aún no había elemento y no volvía a correr al montarse → burbuja en negro.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (cameraStream) {
      if (video.srcObject !== cameraStream) {
        video.srcObject = cameraStream;
      }
      const play = video.play();
      if (play && typeof play.catch === "function") play.catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [cameraStream, visible]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pos) return;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return;
    const next = {
      x: Math.max(8, Math.min(window.innerWidth - SIZE - 8, e.clientX - dragOffset.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - SIZE - 8, e.clientY - dragOffset.current.y)),
    };
    setPos(next);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragOffset.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  if (!visible || !pos) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
      className="fixed z-[10000] cursor-grab active:cursor-grabbing select-none touch-none"
    >
      <div className="relative w-full h-full rounded-full overflow-hidden border-[3px] border-red-500 shadow-2xl ring-4 ring-red-500/25 bg-black">
        <video
          ref={(el) => {
            videoRef.current = el;
            // Asigna el stream en el instante en que el <video> se monta, no solo
            // cuando cambia cameraStream — así la burbuja nunca queda en negro.
            if (el && cameraStream && el.srcObject !== cameraStream) {
              el.srcObject = cameraStream;
              const play = el.play();
              if (play && typeof play.catch === "function") play.catch(() => {});
            }
          }}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <span className={`w-1.5 h-1.5 rounded-full ${state === "recording" ? "bg-red-500 animate-pulse" : "bg-amber-400"}`} />
          <span className="text-[9px] font-bold text-white tracking-widest uppercase">
            {state === "recording" ? "REC" : "Pausa"}
          </span>
        </div>
      </div>
    </div>
  );
}
