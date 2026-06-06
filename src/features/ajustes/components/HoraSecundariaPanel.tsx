"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { loadUserPref, saveUserPref } from "@/shared/io/user-preferences";
import {
  TZ_HORA_SECUNDARIA_KEY,
  TZ_SECUNDARIA_DEFECTO,
  TZ_OPCIONES,
  labelTZLocal,
  nombreZona,
} from "@/features/google-workspace/lib/timezones";

// Panel personal (por usuario): activa una segunda columna de horas en el
// Calendario y en Meet, con el huso que cada uno elija. La preferencia es
// independiente por usuario y se comparte con la clave que ya usa el drawer.
export function HoraSecundariaPanel() {
  const [tz, setTz] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    loadUserPref(TZ_HORA_SECUNDARIA_KEY).then((v) => {
      setTz(v);
      setCargado(true);
    });
  }, []);

  const activa = tz != null;

  const cambiar = (valor: string | null) => {
    setTz(valor);
    saveUserPref(TZ_HORA_SECUNDARIA_KEY, valor);
  };

  const toggle = (on: boolean) => cambiar(on ? TZ_SECUNDARIA_DEFECTO : null);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <Label
              htmlFor="hora-secundaria-switch"
              className="text-sm font-medium text-foreground"
            >
              Visualizar hora secundaria
            </Label>
            <p className="text-xs text-muted-foreground">
              Muestra una segunda columna de horas junto a la tuya. Es una
              preferencia personal: cada usuario elige la suya.
            </p>
          </div>
        </div>
        <Switch
          id="hora-secundaria-switch"
          checked={activa}
          disabled={!cargado}
          onCheckedChange={toggle}
        />
      </div>

      {activa && (
        <div className="ml-8 space-y-1.5">
          <Label
            htmlFor="hora-secundaria-zona"
            className="text-xs font-medium text-muted-foreground"
          >
            Zona horaria secundaria
          </Label>
          <select
            id="hora-secundaria-zona"
            value={tz ?? ""}
            onChange={(e) => cambiar(e.target.value)}
            className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TZ_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Verás dos columnas: {labelTZLocal()} (tu hora) y{" "}
            {nombreZona(tz ?? TZ_SECUNDARIA_DEFECTO)}.
          </p>
        </div>
      )}
    </div>
  );
}
