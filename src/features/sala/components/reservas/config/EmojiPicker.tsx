"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

/**
 * Iconos ofrecidos al etiquetar. Agrupados por lo que suele necesitar una
 * sala: celebraciones, servicio, alergias y avisos operativos.
 */
const EMOJI_CATALOG: string[] = [
  // Celebraciones
  "🎂", "🎉", "🎈", "🎁", "🥂", "🍾", "🍰", "🥳",
  "💍", "💖", "❤️", "👰", "🤵", "👶", "👨‍👩‍👧", "🎓",
  "🏆", "⭐", "🌟", "✨", "🎄", "🎃", "🦃", "🌹",
  // Mesa y servicio
  "🍽️", "🍷", "🍻", "☕", "🎵", "🎤", "🕺", "💃",
  "🪑", "🌳", "☀️", "🌙", "🚬", "🐕", "♿", "🅿️",
  // Alergias e intolerancias
  "🌾", "🥜", "🥛", "🥚", "🐟", "🦐", "🌰", "🫘",
  "🌶️", "🥬", "🚫", "⚕️",
  // Cliente y aviso
  "🏢", "💼", "🤝", "📅", "📌", "📍", "🔔", "📣",
  "👑", "💎", "🔥", "⚠️",
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Compacto para las filas inline de creación. */
  size?: "sm" | "md";
}

export function EmojiPicker({ value, onChange, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const compacto = size === "sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={
            compacto
              ? "h-6 w-12 justify-between gap-0.5 px-1 text-sm"
              : "h-8 w-14 justify-between gap-1 px-1.5 text-base"
          }
          title="Elegir icono"
        >
          <span className="leading-none">{value || "🏷️"}</span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-8 gap-1">
          {/* Primera opción: dejar la etiqueta sin icono. */}
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-md border text-[10px] text-muted-foreground transition-colors ${
              value === ""
                ? "border-primary bg-primary/10"
                : "border-transparent hover:bg-muted"
            }`}
            title="Sin icono"
          >
            —
          </button>
          {EMOJI_CATALOG.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onChange(e);
                setOpen(false);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-md border text-lg transition-colors ${
                e === value
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:bg-muted"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
