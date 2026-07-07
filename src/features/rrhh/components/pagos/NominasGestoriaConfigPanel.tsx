"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import {
  getNominasGestoriaConfig,
  setNominasGestoriaConfig,
  enviarNominasGestoriaAhora,
  type NominasGestoriaConfig,
} from "@/features/rrhh/actions/nominas-gestoria-config-actions";

// Ajustes del envío automático de nóminas a la gestoría (general de empresa).
// La gestoría recibe un correo el día configurado con un enlace para subir las
// nóminas del mes; la IA las lee y vuelca al sistema automáticamente.
export function NominasGestoriaConfigPanel() {
  const [cfg, setCfg] = useState<NominasGestoriaConfig | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getNominasGestoriaConfig().then(setCfg);
  }, []);

  if (!cfg) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const set = <K extends keyof NominasGestoriaConfig>(k: K, v: NominasGestoriaConfig[K]) =>
    setCfg((prev) => (prev ? { ...prev, [k]: v } : prev));

  const guardar = async () => {
    setGuardando(true);
    const res = await setNominasGestoriaConfig(cfg);
    setGuardando(false);
    if (res.ok) toast.success("Ajustes de envío a gestoría guardados.");
    else toast.error("No se pudieron guardar los ajustes.");
  };

  const enviarAhora = async () => {
    if (!cfg.email.trim()) {
      toast.error("Añade primero el correo de la gestoría.");
      return;
    }
    setEnviando(true);
    const res = await enviarNominasGestoriaAhora();
    setEnviando(false);
    if (res.ok) toast.success("Correo enviado a la gestoría con el enlace para subir las nóminas.");
    else toast.error(res.error ?? "No se pudo enviar el correo.");
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Envío de nóminas a la gestoría</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Un día fijo del mes se envía a la gestoría un correo con un enlace para subir las
          nóminas. Al adjuntarlas, la IA las lee y vuelca los datos al sistema automáticamente.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Activar el envío automático</Label>
          <p className="text-xs text-muted-foreground">
            Cada mes, el día indicado, la gestoría recibe el enlace para subir las nóminas.
          </p>
        </div>
        <Switch checked={cfg.activo} onCheckedChange={(v) => set("activo", v)} />
      </div>

      {cfg.activo && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Correo de la gestoría</Label>
              <Input
                type="email"
                value={cfg.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="gestoria@ejemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Copia a (opcional)</Label>
              <Input
                type="email"
                value={cfg.emailCc}
                onChange={(e) => set("emailCc", e.target.value)}
                placeholder="copia@ejemplo.com"
              />
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
            <Label className="text-sm">Día del mes en el que se envía</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={28}
                value={cfg.diaEnvio}
                onChange={(e) => set("diaEnvio", Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">de cada mes (1 a 28)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              La hora es la del envío del sistema (por la mañana). Se limita al día 28 para que
              exista en todos los meses.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Avisar a RRHH cuando la gestoría suba nóminas</Label>
              <p className="text-xs text-muted-foreground">
                Al volcarse las nóminas, RRHH recibe una notificación con el resumen (volcadas,
                ya existentes y sin empleado).
              </p>
            </div>
            <Switch checked={cfg.notifRrhh} onCheckedChange={(v) => set("notifRrhh", v)} />
          </div>

          {cfg.ultimoEnvio && (
            <p className="text-xs text-muted-foreground">
              Último envío automático: {cfg.ultimoEnvio}.
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {cfg.activo && (
          <Button variant="outline" onClick={enviarAhora} disabled={enviando} className="gap-2">
            {enviando ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Enviando…</>
            ) : (
              <><Send className="h-4 w-4" />Enviar ahora</>
            )}
          </Button>
        )}
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
