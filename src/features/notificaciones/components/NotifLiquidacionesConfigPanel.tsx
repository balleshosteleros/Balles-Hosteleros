"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  getNotifLiquidacionesConfig,
  setNotifLiquidacionesConfig,
  type NotifLiquidacionesConfig,
} from "@/features/notificaciones/actions/notif-config-actions";

const TEXTO_DEFAULT = "Las liquidaciones se emiten siempre el primer miércoles del mes.";

// Panel de ajustes de notificaciones de liquidación (general de empresa).
// Se reutiliza en Pagos (⚙️) y en Ajustes → Departamentos → RRHH → Pagos.
export function NotifLiquidacionesConfigPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [cfg, setCfg] = useState<NotifLiquidacionesConfig | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getNotifLiquidacionesConfig().then(setCfg);
  }, []);

  if (!cfg) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const set = <K extends keyof NotifLiquidacionesConfig>(k: K, v: NotifLiquidacionesConfig[K]) =>
    setCfg((prev) => (prev ? { ...prev, [k]: v } : prev));

  const guardar = async () => {
    setGuardando(true);
    const res = await setNotifLiquidacionesConfig(cfg);
    setGuardando(false);
    if (res.ok) toast.success("Ajustes de liquidaciones guardados.");
    else toast.error("No se pudieron guardar los ajustes.");
  };

  return (
    <div className={embedded ? "space-y-3" : "space-y-4"}>
      {!embedded && (
        <h3 className="text-base font-semibold">Notificaciones de liquidación</h3>
      )}

      <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Avisar al emitir liquidaciones</Label>
          <p className="text-xs text-muted-foreground">
            Cada vez que se envíen liquidaciones, el empleado recibe una notificación en su app.
          </p>
        </div>
        <Switch checked={cfg.activo} onCheckedChange={(v) => set("activo", v)} />
      </div>

      {cfg.activo && (
        <>
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Exigir aprobación del empleado (LIQUIDAR)</Label>
              <p className="text-xs text-muted-foreground">
                El empleado debe pulsar LIQUIDAR para aprobar que su liquidación es correcta.
                Hasta entonces no se puede marcar como pagada.
              </p>
            </div>
            <Switch
              checked={cfg.requiereAprobacion}
              onCheckedChange={(v) => set("requiereAprobacion", v)}
            />
          </div>

          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
            <Label className="text-sm">Texto del aviso al pulsar LIQUIDAR</Label>
            <Textarea
              value={cfg.textoLiquidar}
              onChange={(e) => set("textoLiquidar", e.target.value)}
              placeholder={TEXTO_DEFAULT}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Es lo que ve el empleado en el pop-up al aprobar su liquidación.
            </p>
          </div>
        </>
      )}

      <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Avisar al marcar como Pagado</Label>
          <p className="text-xs text-muted-foreground">
            Cuando RRHH marca la liquidación como pagada, el empleado recibe una notificación.
          </p>
        </div>
        <Switch checked={cfg.pagadoActivo} onCheckedChange={(v) => set("pagadoActivo", v)} />
      </div>

      <div className="flex justify-end">
        <Button onClick={guardar} disabled={guardando} className="gap-2">
          {guardando ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</>
          ) : (
            <><Save className="h-4 w-4" />Guardar</>
          )}
        </Button>
      </div>
    </div>
  );
}
