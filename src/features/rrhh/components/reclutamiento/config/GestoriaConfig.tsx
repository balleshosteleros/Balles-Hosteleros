"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  getReclutamientoConfig,
  saveReclutamientoConfig,
  type ReclutamientoConfig,
} from "@/features/rrhh/actions/gestoria-actions";
import {
  GESTORIA_CAMPOS,
  type GestoriaCamposConfig,
} from "@/features/rrhh/data/campos-gestoria";

export function GestoriaConfig({ embedded = false }: { embedded?: boolean } = {}) {
  const [config, setConfig] = useState<ReclutamientoConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getReclutamientoConfig().then((r) => setConfig(r.data));
  }, []);

  const guardar = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await saveReclutamientoConfig(config);
      if (res.ok) toast.success("Configuración guardada");
      else toast.error(res.error ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }

  const setCampo = (key: keyof GestoriaCamposConfig, value: boolean) =>
    setConfig((c) => (c ? { ...c, gestoria_campos: { ...c.gestoria_campos, [key]: value } } : c));

  const todos = GESTORIA_CAMPOS.every(({ key }) => config.gestoria_campos[key]);
  const toggleTodos = () => {
    const nuevo = !todos;
    setConfig((c) => {
      if (!c) return c;
      const campos = { ...c.gestoria_campos };
      for (const { key } of GESTORIA_CAMPOS) campos[key] = nuevo;
      return { ...c, gestoria_campos: campos };
    });
  };

  const cuerpo = (
    <div className="space-y-6 max-w-lg">
      {/* Correos destino */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="gest-email">Email de la gestoría</Label>
          <Input id="gest-email" type="email" value={config.gestoria_email}
            onChange={(e) => setConfig((c) => c && { ...c, gestoria_email: e.target.value })}
            placeholder="gestoria@asesoria.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gest-email-cc">Segundo contacto (opcional)</Label>
          <Input id="gest-email-cc" type="email" value={config.gestoria_email_cc}
            onChange={(e) => setConfig((c) => c && { ...c, gestoria_email_cc: e.target.value })}
            placeholder="otro.contacto@asesoria.com" />
        </div>
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

      {/* Checklist de campos a enviar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Datos que se envían a la gestoría</Label>
          <button type="button" onClick={toggleTodos}
            className="text-xs text-primary hover:underline">
            {todos ? "Desmarcar todos" : "Marcar todos"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Marca qué datos del trabajador se incluyen en el correo. Por defecto, todos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1">
          {GESTORIA_CAMPOS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={config.gestoria_campos[key]}
                onCheckedChange={(v) => setCampo(key, v === true)}
              />
              <span className="text-foreground">{label}</span>
            </label>
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

      <Button onClick={guardar} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…</> : "Guardar"}
      </Button>
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
}
