"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getReclutamientoConfigOnboarding,
  saveReclutamientoConfigOnboarding,
  type ReclutamientoConfigOnboarding,
  type PruebaAvisoCanal,
} from "@/features/rrhh/actions/gestoria-actions";

const CANALES: { value: PruebaAvisoCanal; label: string }[] = [
  { value: "notificacion", label: "Notificación" },
  { value: "email", label: "Email" },
  { value: "ambos", label: "Ambos" },
];

export function OnboardingPruebaConfig({ embedded = false }: { embedded?: boolean } = {}) {
  const [config, setConfig] = useState<ReclutamientoConfigOnboarding | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getReclutamientoConfigOnboarding().then((r) => setConfig(r.data));
  }, []);

  const guardar = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await saveReclutamientoConfigOnboarding(config);
      if (res.ok) toast.success("Configuración guardada");
      else toast.error(res.error ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }

  const avisoActivo = config.prueba_aviso_activo;

  const cuerpo = (
    <div className="space-y-6 max-w-lg">
      {/* Formación */}
      <div className="space-y-2">
        <Label htmlFor="formacion-url" className="text-sm font-medium">
          URL de la formación
        </Label>
        <Input
          id="formacion-url"
          type="url"
          value={config.formacion_url}
          onChange={(e) => setConfig((c) => c && { ...c, formacion_url: e.target.value })}
          placeholder="https://…"
        />
        <p className="text-xs text-muted-foreground">
          Es el enlace al que apunta el botón «Acceder a la formación» del email que recibe el nuevo empleado.
        </p>
      </div>

      {/* Periodo de prueba */}
      <div className="space-y-4 rounded-lg border border-border p-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Periodo de prueba</Label>
          <p className="text-xs text-muted-foreground">
            Duración del periodo de prueba y aviso a RRHH antes de que finalice.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="prueba-duracion" className="text-sm text-foreground">
            Duración del periodo de prueba (días)
          </Label>
          <Input
            id="prueba-duracion"
            type="number"
            min={1}
            max={365}
            value={config.prueba_duracion_dias}
            onChange={(e) =>
              setConfig((c) => c && { ...c, prueba_duracion_dias: Number(e.target.value) })
            }
            className="w-20 h-9"
          />
        </div>

        {/* Toggle aviso */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Activar aviso de periodo de prueba</Label>
            <p className="text-xs text-muted-foreground">
              Avisa a RRHH cuando se acerque el final del periodo de prueba.
            </p>
          </div>
          <Switch
            checked={config.prueba_aviso_activo}
            onCheckedChange={(v) => setConfig((c) => c && { ...c, prueba_aviso_activo: v })}
          />
        </div>

        <div className={cn("flex items-center gap-2", !avisoActivo && "opacity-50")}>
          <Label htmlFor="prueba-aviso-dias" className="text-sm text-foreground">
            Avisar a RRHH cuando hayan pasado
          </Label>
          <Input
            id="prueba-aviso-dias"
            type="number"
            min={1}
            max={365}
            disabled={!avisoActivo}
            value={config.prueba_aviso_dias}
            onChange={(e) =>
              setConfig((c) => c && { ...c, prueba_aviso_dias: Number(e.target.value) })
            }
            className="w-20 h-9"
          />
          <span className="text-sm text-muted-foreground">día(s)</span>
        </div>

        {/* Canal del aviso */}
        <div className={cn("space-y-1.5", !avisoActivo && "opacity-50")}>
          <Label className="text-sm text-foreground">Canal del aviso</Label>
          <div className="flex flex-wrap gap-2">
            {CANALES.map(({ value, label }) => {
              const activo = config.prueba_aviso_canal === value;
              return (
                <Button
                  key={value}
                  type="button"
                  variant={activo ? "default" : "outline"}
                  size="sm"
                  disabled={!avisoActivo}
                  onClick={() => setConfig((c) => c && { ...c, prueba_aviso_canal: value })}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <Button onClick={guardar} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…</> : "Guardar"}
      </Button>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Onboarding y periodo de prueba</h3>
          <p className="text-xs text-muted-foreground">
            Enlace a la formación inicial y aviso a RRHH cuando finaliza el periodo de prueba del nuevo empleado.
          </p>
        </div>
        {cuerpo}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Onboarding y periodo de prueba</CardTitle>
        <CardDescription>
          Enlace a la formación inicial y aviso a RRHH cuando finaliza el periodo de prueba del nuevo empleado.
        </CardDescription>
      </CardHeader>
      <CardContent>{cuerpo}</CardContent>
    </Card>
  );
}
