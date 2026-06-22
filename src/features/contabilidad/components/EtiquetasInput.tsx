"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface EtiquetasInputProps {
  value: string[];
  onChange: (etiquetas: string[]) => void;
  placeholder?: string;
}

/**
 * Editor simple de etiquetas (chips). Escribe y pulsa Enter o coma para añadir;
 * la X de cada chip lo elimina. Evita duplicados (ignora mayúsculas/espacios).
 */
export function EtiquetasInput({ value, onChange, placeholder }: EtiquetasInputProps) {
  const [texto, setTexto] = useState("");

  const añadir = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const existe = value.some((e) => e.toLowerCase() === t.toLowerCase());
    if (!existe) onChange([...value, t]);
    setTexto("");
  };

  const quitar = (etiqueta: string) => {
    onChange(value.filter((e) => e !== etiqueta));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      añadir(texto);
    } else if (e.key === "Backspace" && !texto && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="rounded-md border bg-background px-2 py-1.5 flex flex-wrap items-center gap-1.5">
      {value.map((e) => (
        <Badge key={e} variant="secondary" className="gap-1 text-[11px]">
          {e}
          <button
            type="button"
            onClick={() => quitar(e)}
            className="hover:text-destructive"
            aria-label={`Quitar ${e}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => añadir(texto)}
        placeholder={value.length === 0 ? (placeholder ?? "Escribe y pulsa Enter") : ""}
        className="h-7 flex-1 min-w-[8rem] border-0 shadow-none focus-visible:ring-0 px-1"
      />
    </div>
  );
}
