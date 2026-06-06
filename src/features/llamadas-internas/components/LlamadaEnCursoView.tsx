"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLlamadaStore } from "@/features/llamadas-internas/store/llamada-store";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatear(seg: number) {
  const m = Math.floor(seg / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seg % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function LlamadaEnCursoView({
  muted,
  onToggleMute,
  onColgar,
}: {
  muted: boolean;
  onToggleMute: () => void;
  onColgar: () => void;
}) {
  const llamada = useLlamadaStore((s) => s.llamada);
  const fase = useLlamadaStore((s) => s.fase);
  const [elapsed, setElapsed] = useState(0);

  const conectadaEn = llamada?.conectadaEn ?? null;
  useEffect(() => {
    if (fase !== "en_curso" || !conectadaEn) return;
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.round((Date.now() - conectadaEn) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [fase, conectadaEn]);

  if (!llamada) return null;

  const estadoTexto =
    fase === "saliente" ? "Llamando…" : fase === "conectando" ? "Conectando…" : formatear(elapsed);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-between bg-background/95 py-16 backdrop-blur">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Avatar className="h-28 w-28">
          {llamada.peerAvatar && <AvatarImage src={llamada.peerAvatar} alt={llamada.peerNombre} />}
          <AvatarFallback className="text-3xl">{iniciales(llamada.peerNombre)}</AvatarFallback>
        </Avatar>
        <p className="text-xl font-semibold">{llamada.peerNombre}</p>
        <p className="text-sm tabular-nums text-muted-foreground">{estadoTexto}</p>
      </div>

      <div className="flex items-center gap-10">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Activar micrófono" : "Silenciar micrófono"}
          className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-foreground transition active:scale-95"
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <button
          type="button"
          onClick={onColgar}
          aria-label="Colgar"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition active:scale-95"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
