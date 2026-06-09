"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Palette, Loader2, Check } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  listDepartamentoColores,
  updateDepartamentoColor,
  type DepartamentoColor,
} from "@/features/rrhh/actions/departamento-colores-actions";
import { pillStyleDepartamento } from "@/features/rrhh/data/horarios";

// Paleta sugerida (clics rápidos). El usuario puede elegir cualquier hex con el
// selector nativo; estas son las teclas que cubren bien el catálogo canónico.
const PALETA_SUGERIDA = [
  "#4f46e5", "#7c3aed", "#a855f7", "#db2777", "#e11d48",
  "#ea580c", "#f59e0b", "#84cc16", "#10b981", "#0d9488",
  "#0284c7", "#64748b", "#57534e", "#6b7280",
];

const AREA_LABEL: Record<DepartamentoColor["area"], string> = {
  OPERATIVA: "Operativa",
  ADMINISTRATIVA: "Administrativa",
};

export function ColoresDepartamentoSection({ empresaId }: { empresaId: string }) {
  const [departamentos, setDepartamentos] = useState<DepartamentoColor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  useGlobalLoadingSync(cargando);

  const refrescar = useCallback(async () => {
    setCargando(true);
    const res = await listDepartamentoColores(empresaId);
    if (res.ok) setDepartamentos(res.data);
    setCargando(false);
  }, [empresaId]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const guardar = useCallback(
    async (id: string, color: string) => {
      // Optimista: pinta ya y revierte si falla.
      const previo = departamentos.find((d) => d.id === id)?.color;
      setDepartamentos((prev) =>
        prev.map((d) => (d.id === id ? { ...d, color } : d)),
      );
      setGuardandoId(id);
      const res = await updateDepartamentoColor(id, color);
      setGuardandoId(null);
      if (!res.ok) {
        toast.error(res.error || "No se pudo guardar el color");
        if (previo) {
          setDepartamentos((prev) =>
            prev.map((d) => (d.id === id ? { ...d, color: previo } : d)),
          );
        }
      }
    },
    [departamentos],
  );

  const grupos = useMemo(() => {
    const ops = departamentos.filter((d) => d.area === "OPERATIVA");
    const adm = departamentos.filter((d) => d.area === "ADMINISTRATIVA");
    return [
      { area: "OPERATIVA" as const, items: ops },
      { area: "ADMINISTRATIVA" as const, items: adm },
    ].filter((g) => g.items.length > 0);
  }, [departamentos]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Colores de departamento
        </h2>
        <p className="text-sm text-muted-foreground">
          El color de cada departamento es el tinte de todos sus turnos en el
          cuadrante. Al crear un turno ya no se elige color: lo hereda de su
          departamento.
        </p>
      </div>

      {cargando ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
        </Card>
      ) : departamentos.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          No hay departamentos en esta empresa.
        </Card>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <div key={g.area} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {AREA_LABEL[g.area]}
              </p>
              <Card className="divide-y overflow-hidden">
                {g.items.map((d) => (
                  <FilaDepartamento
                    key={d.id}
                    departamento={d}
                    guardando={guardandoId === d.id}
                    onChange={(color) => guardar(d.id, color)}
                  />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilaDepartamento({
  departamento,
  guardando,
  onChange,
}: {
  departamento: DepartamentoColor;
  guardando: boolean;
  onChange: (color: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const color = departamento.color;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Pastilla de muestra con el código de ejemplo del turno. */}
      <span
        className="inline-flex h-7 min-w-[52px] items-center justify-center rounded-full px-2.5 text-[11px] font-semibold tracking-wide"
        style={pillStyleDepartamento(color)}
      >
        {departamento.nombre.slice(0, 3).toUpperCase()}
      </span>
      <span className="text-sm font-medium flex-1 truncate">
        {departamento.nombre}
      </span>

      {/* Selector nativo de color (cualquier hex). */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative h-8 w-8 shrink-0 rounded-md border shadow-sm transition-transform hover:scale-105"
        style={{ backgroundColor: color }}
        title="Elegir color personalizado"
        aria-label={`Color de ${departamento.nombre}`}
      >
        <input
          ref={inputRef}
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          tabIndex={-1}
        />
      </button>

      {/* Paleta de clics rápidos. */}
      <div className="hidden sm:flex items-center gap-1">
        {PALETA_SUGERIDA.map((c) => {
          const activo = c.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border transition-transform hover:scale-110",
                activo ? "border-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: c }}
              title={c}
              aria-label={`Usar ${c}`}
            >
              {activo && <Check className="h-3 w-3 text-white" />}
            </button>
          );
        })}
      </div>

      <span className="w-4 shrink-0">
        {guardando && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </span>
    </div>
  );
}
