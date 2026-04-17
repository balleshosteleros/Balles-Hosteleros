"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { listPartidas } from "@/features/cocina/actions/partidas-actions";
import type { FiltroDestino, FiltrosComandas } from "../types";

interface Partida {
  id: string;
  nombre: string;
}

interface Props {
  value: FiltrosComandas;
  onChange: (v: FiltrosComandas) => void;
}

const DESTINOS: Array<{ key: FiltroDestino; label: string }> = [
  { key: "TODOS", label: "Todos" },
  { key: "COCINA", label: "Cocina" },
  { key: "BARRA", label: "Barra" },
];

export function FiltrosBar({ value, onChange }: Props) {
  const [partidas, setPartidas] = useState<Partida[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listPartidas();
      if (!cancelled && res.ok) {
        setPartidas(
          (res.data as Array<{ id: string; nombre: string }>).map((p) => ({
            id: p.id,
            nombre: p.nombre,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
      <div className="flex gap-1">
        {DESTINOS.map((d) => (
          <Button
            key={d.key}
            size="sm"
            variant={value.destino === d.key ? "default" : "outline"}
            onClick={() => onChange({ ...value, destino: d.key })}
          >
            {d.label}
          </Button>
        ))}
      </div>

      {partidas.length > 0 && (
        <>
          <div className="h-5 w-px bg-border" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Partida
            <select
              value={value.partidaId ?? ""}
              onChange={(e) =>
                onChange({ ...value, partidaId: e.target.value || null })
              }
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value="">Todas</option>
              {partidas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
