"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FocalPointPickerProps {
  src: string;
  focalX: number;
  focalY: number;
  onChange: (focalX: number, focalY: number) => void;
  /** Aspect ratio del marco real donde se renderiza la imagen. */
  aspect?: "video" | "card" | "square";
}

const ASPECT_CLASS: Record<NonNullable<FocalPointPickerProps["aspect"]>, string> = {
  video: "aspect-video",
  card: "aspect-[4/3]",
  square: "aspect-square",
};

export function FocalPointPicker({
  src,
  focalX,
  focalY,
  onChange,
  aspect = "video",
}: FocalPointPickerProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const clampedX = clamp(focalX);
  const clampedY = clamp(focalY);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      onChange(clamp(x), clamp(y));
    },
    [onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    function handleMove(e: PointerEvent) {
      e.preventDefault();
      updateFromPointer(e.clientX, e.clientY);
    }
    function handleUp() {
      setDragging(false);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragging, updateFromPointer]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Encuadre · arrastra para reposicionar
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={() => onChange(50, 50)}
          title="Restablecer al centro"
        >
          <RotateCcw className="h-3 w-3" /> Centrar
        </Button>
      </div>
      <div
        ref={frameRef}
        className={`relative w-full overflow-hidden rounded-md border bg-muted/40 ${ASPECT_CLASS[aspect]} select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDragging(true);
          updateFromPointer(e.clientX, e.clientY);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `${clampedX}% ${clampedY}%` }}
        />
        <div
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)] ring-2 ring-primary"
          style={{ left: `${clampedX}%`, top: `${clampedY}%` }}
        />
      </div>
    </div>
  );
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.min(100, Math.max(0, v));
}
