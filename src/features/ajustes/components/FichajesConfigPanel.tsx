"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getFichajePolicy, saveFichajePolicy } from "@/features/rrhh/actions/fichajes-policy-actions";
import { FICHAJE_POLICY_DEFAULT, type FichajePolicy } from "@/features/rrhh/data/fichaje-policy";

const MINUTOS_OPCIONES = [5, 10, 15, 20, 25, 30];

/**
 * Configuración de margen de fichaje respecto a la hora del turno. Vive en
 * Ajustes → Departamentos → RRHH → submódulo "Fichajes". `embedded` quita el
 * marco propio para encajar en la fila del submódulo.
 */
export function FichajesConfigPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [policy, setPolicy] = useState<FichajePolicy>(FICHAJE_POLICY_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    getFichajePolicy().then((res) => {
      if (!activo) return;
      if (res.ok) setPolicy(res.data);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, []);

  async function guardar() {
    setGuardando(true);
    const res = await saveFichajePolicy(policy);
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron guardar las reglas de fichaje.");
      return;
    }
    toast.success("Reglas de fichaje guardadas.");
  }

  return (
    <div className={embedded ? "space-y-5" : "rounded-lg border bg-card p-4 md:p-6 space-y-5 max-w-2xl"}>
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Clock className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Margen de fichaje respecto al turno</h3>
          <p className="text-sm text-muted-foreground">
            Define cuánto puede fichar el empleado antes o después de la hora de inicio de su turno.
            Fuera de ese margen no podrá fichar; podrá pedir que se validen sus horas.
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {/* Antes de la hora */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Permitir fichar antes de la hora</Label>
                <p className="text-xs text-muted-foreground">El empleado puede fichar antes del inicio del turno.</p>
              </div>
              <Switch
                checked={policy.permitirAntes}
                onCheckedChange={(v) => setPolicy((p) => ({ ...p, permitirAntes: v }))}
              />
            </div>
            {policy.permitirAntes && (
              <>
                <div className="flex items-center justify-between pl-1">
                  <Label className="text-sm">Hasta cuántos minutos antes</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={policy.margenAntesMin}
                    onChange={(e) => setPolicy((p) => ({ ...p, margenAntesMin: Number(e.target.value) }))}
                  >
                    {MINUTOS_OPCIONES.map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between pl-1">
                  <Label className="text-sm">Redondear a la hora exacta del turno</Label>
                  <Switch
                    checked={policy.redondearAntes}
                    onCheckedChange={(v) => setPolicy((p) => ({ ...p, redondearAntes: v }))}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground pl-1">
                  Si está activado y llega antes, se registra la hora exacta del turno; si no, la hora real de fichaje.
                </p>
              </>
            )}
          </div>

          {/* Después de la hora (llega tarde) */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Permitir fichar después de la hora (llega tarde)</Label>
                <p className="text-xs text-muted-foreground">El empleado puede fichar pasada la hora de inicio del turno.</p>
              </div>
              <Switch
                checked={policy.permitirDespues}
                onCheckedChange={(v) => setPolicy((p) => ({ ...p, permitirDespues: v }))}
              />
            </div>
            {policy.permitirDespues && (
              <>
                <div className="flex items-center justify-between pl-1">
                  <Label className="text-sm">Hasta cuántos minutos después</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={policy.margenDespuesMin}
                    onChange={(e) => setPolicy((p) => ({ ...p, margenDespuesMin: Number(e.target.value) }))}
                  >
                    {MINUTOS_OPCIONES.map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between pl-1">
                  <Label className="text-sm">Redondear a la hora exacta del turno</Label>
                  <Switch
                    checked={policy.redondearDespues}
                    onCheckedChange={(v) => setPolicy((p) => ({ ...p, redondearDespues: v }))}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground pl-1">
                  Si está activado y llega tarde, se registra la hora exacta del turno; si no, la hora real de fichaje.
                </p>
              </>
            )}
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
        </>
      )}
    </div>
  );
}
