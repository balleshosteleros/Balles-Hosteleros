"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type {
  EmpresaReservasConfig,
  EmpresaReservasExcepcion,
} from "@/features/sala/data/reservas";
import {
  getReservasConfig,
  upsertReservasConfig,
} from "@/features/sala/actions/reservas-config-actions";
import { listReservasExcepciones } from "@/features/sala/actions/reservas-excepciones-actions";
import { LimitesMatriz } from "./LimitesMatriz";
import { ExcepcionesTabla } from "./ExcepcionesTabla";

export function ConfigTabReservas() {
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [excepciones, setExcepciones] = useState<EmpresaReservasExcepcion[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    const [c, e] = await Promise.all([
      getReservasConfig(),
      listReservasExcepciones(),
    ]);
    if (c.ok) setConfig(c.data);
    if (e.ok) setExcepciones(e.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function handleConfigChange(parche: Partial<EmpresaReservasConfig>) {
    setConfig((prev) => (prev ? ({ ...prev, ...parche } as EmpresaReservasConfig) : prev));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await upsertReservasConfig(parche);
      if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
    }, 500);
  }

  if (loading || !config) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LimitesMatriz config={config} onChange={handleConfigChange} />

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Antelación</h4>
        <p className="text-xs text-muted-foreground -mt-2">
          Solo valor general (no se diferencia por día).
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1.5">
            <Label className="text-xs">Antelación mínima (minutos)</Label>
            <Input
              type="number"
              min={0}
              max={1440}
              value={config.antelacionMinMinutos}
              onChange={(e) => {
                const n = Math.min(1440, Math.max(0, Number(e.target.value) || 0));
                handleConfigChange({ antelacionMinMinutos: n });
              }}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Máximo 1.440 min (24 h). Ej.: 15, 30, 60, 120.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Antelación máxima (días)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={config.antelacionMaxDias}
              onChange={(e) => {
                const n = Math.min(365, Math.max(1, Number(e.target.value) || 90));
                handleConfigChange({ antelacionMaxDias: n });
              }}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Máximo 365 días (1 año).
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <ExcepcionesTabla excepciones={excepciones} onChange={cargar} />
    </div>
  );
}
