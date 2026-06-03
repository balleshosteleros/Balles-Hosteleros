"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DURACION_RESERVA_DEFAULT_MINUTOS,
  DURACION_RESERVA_MAX_MINUTOS,
  DURACION_RESERVA_MIN_MINUTOS,
  RECONFIRMACION_DIAS_MAX,
  RECONFIRMACION_DIAS_MIN,
  type EmpresaReservasConfig,
} from "@/features/sala/data/reservas";
import {
  getReservasConfig,
  upsertReservasConfig,
} from "@/features/sala/actions/reservas-config-actions";
import { LimitesReglas } from "./LimitesReglas";
import { HorariosAperturaPanel } from "./HorariosAperturaPanel";
import { PreferenciasMotorPanelButton } from "./PreferenciasMotorPanel";
import { ReglasIntervaloPanel } from "./ReglasIntervaloPanel";

export function ConfigTabReservas() {
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    const c = await getReservasConfig();
    if (c.ok) setConfig(c.data);
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
      <div className="flex items-center justify-end">
        <PreferenciasMotorPanelButton config={config} onChange={handleConfigChange} />
      </div>

      <HorariosAperturaPanel config={config} onChange={handleConfigChange} />

      <Separator />

      <LimitesReglas />

      <Separator />

      <ReglasIntervaloPanel />

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Duración de la reserva</h4>
        <p className="text-xs text-muted-foreground -mt-2">
          Tiempo que una mesa queda ocupada por cada reserva. Aplica a todos los planos y a todas las reservas: el sistema no aceptará una reserva nueva en una mesa que ya tenga otra dentro de esta ventana.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1.5">
            <Label className="text-xs">Duración por reserva (minutos)</Label>
            <Input
              type="number"
              min={DURACION_RESERVA_MIN_MINUTOS}
              max={DURACION_RESERVA_MAX_MINUTOS}
              step={5}
              value={config.duracionReservaMin}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const n = Number.isFinite(raw)
                  ? Math.min(DURACION_RESERVA_MAX_MINUTOS, Math.max(DURACION_RESERVA_MIN_MINUTOS, Math.round(raw)))
                  : DURACION_RESERVA_DEFAULT_MINUTOS;
                handleConfigChange({ duracionReservaMin: n });
              }}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Mínimo {DURACION_RESERVA_MIN_MINUTOS} min · máximo {DURACION_RESERVA_MAX_MINUTOS} min (6 h) · por defecto {DURACION_RESERVA_DEFAULT_MINUTOS}.
            </p>
          </div>
        </div>
      </div>

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

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Reconfirmación</h4>
        <p className="text-xs text-muted-foreground -mt-2">
          Correo automático para que el cliente reconfirme su asistencia antes
          del servicio.
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1.5">
            <Label className="text-xs">Enviar reconfirmación</Label>
            <Select
              value={String(config.reconfirmacionDiasAntes)}
              onValueChange={(v) => {
                const n = Math.min(
                  RECONFIRMACION_DIAS_MAX,
                  Math.max(RECONFIRMACION_DIAS_MIN, Number(v) || 1),
                );
                handleConfigChange({ reconfirmacionDiasAntes: n });
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(
                  { length: RECONFIRMACION_DIAS_MAX - RECONFIRMACION_DIAS_MIN + 1 },
                  (_, i) => i + RECONFIRMACION_DIAS_MIN,
                ).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d === 1 ? "1 día antes" : `${d} días antes`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              El correo se envía a la misma hora de la reserva. El mínimo de
              antelación es 24 h, por eso la opción más cercana es 1 día antes.
            </p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-md border p-3 max-w-md">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium" htmlFor="reconf-lt24h">
              Reconfirmar reservas con menos de 24 h
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Si está activo, las reservas creadas con menos de 24 h de
              antelación reciben el correo de reconfirmación inmediatamente
              después del de confirmación. Si está desactivado, no reciben
              correo de reconfirmación. Las reservas con 24 h o más se envían
              siempre según la configuración de arriba.
            </p>
          </div>
          <Switch
            id="reconf-lt24h"
            checked={config.reconfirmacionLt24hInmediata}
            onCheckedChange={(v) =>
              handleConfigChange({ reconfirmacionLt24hInmediata: Boolean(v) })
            }
          />
        </div>
      </div>

    </div>
  );
}
