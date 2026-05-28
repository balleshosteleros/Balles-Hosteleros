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
  ReservaTipo,
} from "@/features/sala/data/reservas";
import {
  getReservasConfig,
  upsertReservasConfig,
} from "@/features/sala/actions/reservas-config-actions";
import { listReservasExcepciones } from "@/features/sala/actions/reservas-excepciones-actions";
import { listReservaTipos } from "@/features/sala/actions/reserva-tipos-actions";
import { LimitesMatriz } from "./LimitesMatriz";
import { ExcepcionesTabla } from "./ExcepcionesTabla";
import { TiposReservaList } from "./TiposReservaList";

export function ConfigTabReservas() {
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [excepciones, setExcepciones] = useState<EmpresaReservasExcepcion[]>([]);
  const [tipos, setTipos] = useState<ReservaTipo[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    const [c, e, t] = await Promise.all([
      getReservasConfig(),
      listReservasExcepciones(),
      listReservaTipos(),
    ]);
    if (c.ok) setConfig(c.data);
    if (e.ok) setExcepciones(e.data);
    if (t.ok) setTipos(t.data);
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
            <Label className="text-xs">Antelación mínima (horas)</Label>
            <Input
              type="number"
              min={0}
              value={config.antelacionMinHoras}
              onChange={(e) =>
                handleConfigChange({ antelacionMinHoras: Number(e.target.value) || 0 })
              }
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Antelación máxima (días)</Label>
            <Input
              type="number"
              min={1}
              value={config.antelacionMaxDias}
              onChange={(e) =>
                handleConfigChange({ antelacionMaxDias: Number(e.target.value) || 90 })
              }
              className="h-8"
            />
          </div>
        </div>
      </div>

      <Separator />

      <TiposReservaList tipos={tipos} onChange={cargar} />

      <Separator />

      <ExcepcionesTabla excepciones={excepciones} onChange={cargar} />
    </div>
  );
}
