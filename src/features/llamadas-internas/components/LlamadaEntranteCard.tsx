"use client";

import { Phone, PhoneOff } from "lucide-react";
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

export function LlamadaEntranteCard({
  onAceptar,
  onRechazar,
}: {
  onAceptar: () => void;
  onRechazar: () => void;
}) {
  const llamada = useLlamadaStore((s) => s.llamada);
  if (!llamada) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-10 bg-background/95 backdrop-blur">
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-28 w-28 ring-4 ring-green-500/30">
          {llamada.peerAvatar && <AvatarImage src={llamada.peerAvatar} alt={llamada.peerNombre} />}
          <AvatarFallback className="text-3xl">{iniciales(llamada.peerNombre)}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-xl font-semibold">{llamada.peerNombre}</p>
          <p className="mt-1 animate-pulse text-sm text-muted-foreground">Llamada entrante…</p>
        </div>
      </div>

      <div className="flex items-center gap-12">
        <button
          type="button"
          onClick={onRechazar}
          aria-label="Rechazar llamada"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition active:scale-95"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
        <button
          type="button"
          onClick={onAceptar}
          aria-label="Aceptar llamada"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition active:scale-95"
        >
          <Phone className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
