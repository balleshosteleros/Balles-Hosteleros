"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  getReclutamientoConfig,
  saveReclutamientoConfig,
  type ReclutamientoConfig,
} from "@/features/rrhh/actions/gestoria-actions";
import { GESTORIA_CAMPOS } from "@/features/rrhh/data/campos-gestoria";
import type { ConfigSectionHandle } from "./tipos";

export const GestoriaConfig = forwardRef<
  ConfigSectionHandle,
  { embedded?: boolean }
>(function GestoriaConfig({ embedded = false } = {}, ref) {
  const [config, setConfig] = useState<ReclutamientoConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const inicialRef = useRef<string>("");

  useEffect(() => {
    void getReclutamientoConfig().then((r) => {
      setConfig(r.data);
      inicialRef.current = JSON.stringify(r.data);
    });
  }, []);

  const guardar = async (): Promise<boolean> => {
    if (!config) return true;
    if (JSON.stringify(config) === inicialRef.current) return true;
    setSaving(true);
    try {
      const res = await saveReclutamientoConfig(config);
      if (res.ok) {
        inicialRef.current = JSON.stringify(config);
        return true;
      }
      toast.error(res.error ?? "No se pudo guardar el alta a la gestoría");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    guardar,
    hayCambios: () => !!config && JSON.stringify(config) !== inicialRef.current,
  }));

  if (!config) {
    return <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }

  const cuerpo = (
    <div className="space-y-6 max-w-lg">
      {/* El correo de la gestoría ya no se configura aquí: vive en Ajustes →
          Empresa → «Correos electrónicos» (Correo gestoría), fuente única. */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          El correo de la gestoría se toma de{" "}
          <span className="font-medium text-foreground">Ajustes → Empresa → «Correos electrónicos» (Correo gestoría)</span>.
          Cámbialo allí y se aplicará a las altas y recordatorios de contrato.
        </p>
      </div>

      {/* Toggle envío automático */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Enviar el alta automáticamente</Label>
          <p className="text-xs text-muted-foreground">
            Al contratar a un candidato, se envía el alta de contrato a la gestoría sin pasos manuales.
          </p>
        </div>
        <Switch
          checked={config.gestoria_envio_auto}
          onCheckedChange={(v) => setConfig((c) => c && { ...c, gestoria_envio_auto: v })}
        />
      </div>

      {/* Datos que se envían a la gestoría (todos OBLIGATORIOS, no configurables) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Datos que se envían a la gestoría</Label>
        <p className="text-xs text-muted-foreground">
          El alta y la baja se envían siempre con TODOS estos datos. Son obligatorios: si a un
          trabajador le falta alguno, el sistema no deja contratar ni dar de baja hasta completarlo,
          para que la gestoría reciba siempre la información completa.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1">
          {GESTORIA_CAMPOS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0"
              />
              <span className="text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recordatorio automático a la gestoría */}
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Recordatorio si no sube el contrato</Label>
            <p className="text-xs text-muted-foreground">
              Si la gestoría no sube el contrato, se le reenvía automáticamente el mismo enlace
              avisando de que está pendiente.
            </p>
          </div>
          <Switch
            checked={config.gestoria_recordatorio_activo}
            onCheckedChange={(v) => setConfig((c) => c && { ...c, gestoria_recordatorio_activo: v })}
          />
        </div>
        {config.gestoria_recordatorio_activo && (
          <div className="flex items-center gap-2 pl-1">
            <Label htmlFor="recordatorio-dias" className="text-sm text-foreground">
              Enviar recordatorio tras
            </Label>
            <Input
              id="recordatorio-dias"
              type="number"
              min={1}
              max={60}
              value={config.gestoria_recordatorio_dias}
              onChange={(e) =>
                setConfig((c) => c && { ...c, gestoria_recordatorio_dias: Number(e.target.value) })
              }
              className="w-20 h-9"
            />
            <span className="text-sm text-muted-foreground">día(s) sin subirse el contrato</span>
          </div>
        )}
      </div>

      {/* Notificaciones al departamento de RRHH (un tick por evento) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Avisar al departamento de RRHH cuando…</Label>
        <p className="text-xs text-muted-foreground">
          Notificaciones in-app para el equipo de RRHH en cada paso del proceso.
        </p>
        <div className="space-y-3 pt-1">
          {[
            { key: "notif_alta_gestoria", label: "Se envía el alta a la gestoría (primer correo)" },
            { key: "notif_recordatorio_gestoria", label: "Se envía el correo de recordatorio a la gestoría" },
            { key: "notif_contrato_subido", label: "La gestoría sube el contrato y se manda al trabajador" },
            { key: "notif_contrato_firmado", label: "El trabajador firma y queda en su carpeta de documentos" },
          ].map((item) => {
            const k = item.key as keyof ReclutamientoConfig;
            return (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <Label className="text-sm text-foreground font-normal">{item.label}</Label>
                <Switch
                  checked={config[k] as boolean}
                  onCheckedChange={(v) => setConfig((c) => c && { ...c, [k]: v })}
                />
              </div>
            );
          })}
        </div>
      </div>

      {!embedded && (
        <Button onClick={() => void guardar()} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…</> : "Guardar"}
        </Button>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Alta a la gestoría</h3>
          <p className="text-xs text-muted-foreground">
            Al contratar a un candidato, el alta de contrato se envía a estos correos.
            No se vinculan a ningún departamento ni persona.
          </p>
        </div>
        {cuerpo}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alta a la gestoría</CardTitle>
        <CardDescription>
          Al contratar a un candidato, el alta de contrato se envía a estos correos.
          No se vinculan a ningún departamento ni persona.
        </CardDescription>
      </CardHeader>
      <CardContent>{cuerpo}</CardContent>
    </Card>
  );
});
