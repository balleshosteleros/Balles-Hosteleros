"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listaZonas,
  normTZ,
  nombreZona,
  offsetTZ,
  sinonimosZona,
  TZ_DESTACADAS,
} from "../lib/timezones";

// Selector de huso horario secundario (buscable). Botón de reloj que abre un
// popover con buscador. Compartido entre el Calendario y Meet.
export function SelectorTZ({
  tz,
  onChange,
}: {
  tz: string | null;
  onChange: (tz: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Zonas más usadas (con nombre amistoso) primero; luego el resto.
  const zonas = useMemo(() => {
    const full = listaZonas();
    const fav = TZ_DESTACADAS.map((d) => d.value).filter((v) =>
      full.includes(v),
    );
    const favSet = new Set(fav);
    return [...fav, ...full.filter((z) => !favSet.has(z))];
  }, []);
  const base = useMemo(() => new Date(), []);
  const filtradas = useMemo(() => {
    const term = normTZ(q.trim());
    const arr = term
      ? zonas.filter((z) =>
          sinonimosZona(z).some((s) => normTZ(s).includes(term)),
        )
      : zonas;
    return arr.slice(0, 50);
  }, [q, zonas]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "rounded-full p-3 transition-colors",
          tz ? "bg-blue-100 text-blue-700" : "text-[#5f6368] hover:bg-black/5",
        )}
        title={tz ? `Mostrando ${nombreZona(tz)}` : "Huso horario secundario"}
      >
        <Clock className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">
            Huso secundario
          </p>
          <div className="px-1 pb-1">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar ciudad o zona…"
              className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
              !tz && "font-semibold text-blue-700",
            )}
          >
            <span className="flex-1">Ninguno (sólo local)</span>
            {!tz && <Check className="h-3.5 w-3.5" />}
          </button>
          <div className="max-h-64 overflow-y-auto">
            {filtradas.map((z) => {
              const activo = z === tz;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    onChange(z);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                    activo && "font-semibold text-blue-700",
                  )}
                >
                  <span className="flex-1 truncate">{nombreZona(z)}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {offsetTZ(z, base)}
                  </span>
                  {activo && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
            {filtradas.length === 0 && (
              <p className="px-2 py-2 text-[11px] italic text-muted-foreground">
                Sin resultados
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
