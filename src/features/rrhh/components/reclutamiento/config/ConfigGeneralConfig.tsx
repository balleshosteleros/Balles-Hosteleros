"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getReclutamientoConfigGeneral,
  saveReclutamientoConfigGeneral,
  type ReclutamientoConfigGeneral,
} from "@/features/rrhh/actions/gestoria-actions";
import type { ConfigSectionHandle } from "./tipos";

type BoolKey = {
  [K in keyof ReclutamientoConfigGeneral]: ReclutamientoConfigGeneral[K] extends boolean ? K : never;
}[keyof ReclutamientoConfigGeneral];

const EMAILS: { key: BoolKey; label: string }[] = [
  { key: "emails_auto_cambio_fase", label: "Activar emails automáticos al cambiar de fase" },
  { key: "emails_pedir_confirmacion", label: "Pedir confirmación antes de enviar cada email" },
  { key: "emails_copia_reclutador", label: "Enviar copia a quien gestiona el cambio (RRHH)" },
  { key: "emails_firma_corporativa", label: "Incluir firma corporativa en los emails" },
];

const GENERALES: { key: BoolKey; label: string }[] = [
  { key: "permitir_candidaturas_duplicadas", label: "Permitir candidaturas duplicadas (mismo email)" },
  { key: "archivar_vacantes_cerradas_30d", label: "Archivar automáticamente vacantes cerradas tras 30 días" },
  { key: "mostrar_contador_candidatos", label: "Mostrar contador de candidatos en la vista principal" },
  { key: "notificar_reclutador_nueva_candidatura", label: "Notificar al reclutador cuando llega una nueva candidatura" },
];

export const ConfigGeneralConfig = forwardRef<
  ConfigSectionHandle,
  { embedded?: boolean }
>(function ConfigGeneralConfig({ embedded = false }, ref) {
  const [config, setConfig] = useState<ReclutamientoConfigGeneral | null>(null);
  const [saving, setSaving] = useState(false);
  const inicialRef = useRef<string>("");

  useEffect(() => {
    void getReclutamientoConfigGeneral().then((r) => {
      setConfig(r.data);
      inicialRef.current = JSON.stringify(r.data);
    });
  }, []);

  const setBool = (key: BoolKey) => {
    setConfig((c) => (c ? { ...c, [key]: !c[key] } : c));
  };
  const setText = (key: "idioma_portal" | "formato_fecha", value: string) => {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  };

  const guardar = async (): Promise<boolean> => {
    if (!config) return true;
    if (JSON.stringify(config) === inicialRef.current) return true;
    setSaving(true);
    try {
      const res = await saveReclutamientoConfigGeneral(config);
      if (res.ok) {
        inicialRef.current = JSON.stringify(config);
        return true;
      }
      toast.error(res.error ?? "No se pudo guardar la configuración general");
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
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const seccionToggles = (
    titulo: string,
    descripcion: string | null,
    items: { key: BoolKey; label: string }[],
  ) => (
    <Card>
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm">{titulo}</h3>
        {descripcion && <p className="text-xs text-muted-foreground mt-0.5">{descripcion}</p>}
      </div>
      <CardContent className="p-5 space-y-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <Label className="text-sm text-foreground">{item.label}</Label>
            <Switch checked={config[item.key]} onCheckedChange={() => setBool(item.key)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-lg font-bold text-foreground">Configuración</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ajustes generales del sistema de reclutamiento
          </p>
        </div>
      )}

      {seccionToggles("Emails automáticos", "Controla cuándo se envían emails a los candidatos", EMAILS)}

      {/* Idioma y regional */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Idioma y ajustes regionales</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Idioma del portal de empleo</Label>
            <Select value={config.idioma_portal} onValueChange={(v) => setText("idioma_portal", v)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ca">Català</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Formato de fecha</Label>
            <Select value={config.formato_fecha} onValueChange={(v) => setText("formato_fecha", v)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dd/mm/yyyy">DD/MM/AAAA</SelectItem>
                <SelectItem value="mm/dd/yyyy">MM/DD/AAAA</SelectItem>
                <SelectItem value="yyyy-mm-dd">AAAA-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {seccionToggles("Ajustes generales", null, GENERALES)}

      {!embedded && (
        <div className="flex justify-end">
          <Button onClick={() => void guardar()} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…</> : "Guardar"}
          </Button>
        </div>
      )}
    </div>
  );
});
