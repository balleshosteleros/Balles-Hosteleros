"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botón uniforme "Rellenar con IA" para esquina superior derecha de cada
 * pestaña del estudio de apertura.
 *
 * Estilo: outline + Sparkles ámbar. Tamaño `sm` para no robar protagonismo
 * a la pestaña pero suficientemente visible.
 */
export function BotonRellenarIA({
  onClick,
  disabled,
  label = "Rellenar con IA",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-400"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
