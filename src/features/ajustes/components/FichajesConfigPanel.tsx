"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Clock, DoorClosed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getFichajePolicy, saveFichajePolicy } from "@/features/rrhh/actions/fichajes-policy-actions";
import { cerrarFichajesAbiertos } from "@/features/rrhh/actions/fichajes-actions";
import { FICHAJE_POLICY_DEFAULT, type FichajePolicy } from "@/features/rrhh/data/fichaje-policy";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

const MINUTOS_OPCIONES = [5, 10, 15, 20, 25, 30];
const REAVISO_OPCIONES = [1, 2, 3, 5, 10, 15];

/**
 * Configuración de margen de fichaje respecto a la hora del turno. Vive en
 * Ajustes → Departamentos → RRHH → submódulo "Fichajes". `embedded` quita el
 * marco propio para encajar en la fila del submódulo.
 */
export function FichajesConfigPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [policy, setPolicy] = useState<FichajePolicy>(FICHAJE_POLICY_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const { confirm, dialog } = useConfirmDelete();

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

  async function cerrarAbiertos() {
    const ok = await confirm({
      title: "¿Cerrar todos los fichajes abiertos?",
      description:
        "Se cerrarán todas las jornadas que sigan abiertas en esta empresa (por si alguien se dejó la suya abierta fuera de su turno). Cada una se cierra a su hora de salida prevista; las que no tengan horario se cierran a la hora actual y quedan marcadas para revisión.",
      confirmLabel: "Cerrar fichajes",
    });
    if (!ok) return;
    setCerrando(true);
    const res = await cerrarFichajesAbiertos();
    setCerrando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron cerrar los fichajes.");
      return;
    }
    const { cerrados, revisados } = res.data!;
    if (cerrados === 0) {
      toast.success("No había fichajes abiertos.");
    } else {
      toast.success(
        `${cerrados} fichaje${cerrados === 1 ? "" : "s"} cerrado${cerrados === 1 ? "" : "s"}` +
          (revisados > 0 ? ` (${revisados} marcado${revisados === 1 ? "" : "s"} para revisión).` : "."),
      );
    }
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

          {/* Aviso (pop-up) de fichar en la app móvil */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Aviso de fichar (app móvil)</Label>
              <p className="text-xs text-muted-foreground">
                Cuándo le salta al empleado el aviso para fichar en el móvil.
              </p>
            </div>

            <div className="flex items-center justify-between pl-1">
              <Label className="text-sm">Cuándo salta el aviso</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={policy.popupModo}
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    popupModo: e.target.value === "siempre" ? "siempre" : "ventana",
                  }))
                }
              >
                <option value="ventana">Solo a su hora (ventana)</option>
                <option value="siempre">Siempre que falte fichar</option>
              </select>
            </div>

            {policy.popupModo === "ventana" && (
              <>
                <div className="flex items-center justify-between pl-1">
                  <Label className="text-sm">Salta hasta X min antes de su hora</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={policy.popupMargenAntesMin}
                    onChange={(e) =>
                      setPolicy((p) => ({ ...p, popupMargenAntesMin: Number(e.target.value) }))
                    }
                  >
                    {MINUTOS_OPCIONES.map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between pl-1">
                  <Label className="text-sm">Sigue saltando hasta X min después</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={policy.popupMargenDespuesMin}
                    onChange={(e) =>
                      setPolicy((p) => ({ ...p, popupMargenDespuesMin: Number(e.target.value) }))
                    }
                  >
                    {MINUTOS_OPCIONES.map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 pl-1">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Reavisar mientras no fiche</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Vuelve a avisar (notificación push) dentro de la cortesía si aún no ha fichado.
                    </p>
                  </div>
                  <Switch
                    checked={policy.reavisoActivo}
                    onCheckedChange={(v) => setPolicy((p) => ({ ...p, reavisoActivo: v }))}
                  />
                </div>
                {policy.reavisoActivo && (
                  <div className="flex items-center justify-between pl-1">
                    <Label className="text-sm">Cada cuánto reavisar</Label>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={policy.reavisoIntervaloMin}
                      onChange={(e) =>
                        setPolicy((p) => ({ ...p, reavisoIntervaloMin: Number(e.target.value) }))
                      }
                    >
                      {REAVISO_OPCIONES.map((m) => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-between gap-4 pl-1">
              <Label className="text-sm">Sonar al avisar</Label>
              <Switch
                checked={policy.avisoSonido}
                onCheckedChange={(v) => setPolicy((p) => ({ ...p, avisoSonido: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4 pl-1">
              <Label className="text-sm">Vibrar al avisar</Label>
              <Switch
                checked={policy.avisoVibracion}
                onCheckedChange={(v) => setPolicy((p) => ({ ...p, avisoVibracion: v }))}
              />
            </div>
          </div>

          {/* Fichaje fuera de horario */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Permitir fichar fuera de horario</Label>
                <p className="text-xs text-muted-foreground">
                  Deja fichar aunque esté fuera de su ventana o sin turno asignado. En ese caso el
                  sistema NO auto-paraliza la jornada por horario (no sabría cuándo cerrarla).
                </p>
              </div>
              <Switch
                checked={policy.permitirFueraHorario}
                onCheckedChange={(v) => setPolicy((p) => ({ ...p, permitirFueraHorario: v }))}
              />
            </div>
          </div>

          {/* Auto-fichar salida */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Cerrar la jornada automáticamente</Label>
                <p className="text-xs text-muted-foreground">
                  Si un empleado no ficha salida, el sistema cierra su jornada a la hora de salida
                  prevista + margen y la guarda como un fichaje normal (no la marca para revisión).
                  Aplica a todo tipo de turnos: en horario fijo usa la hora de fin del turno; en
                  flexible, la hora de entrada + las horas previstas del día.
                </p>
              </div>
              <Switch
                checked={policy.autoSalidaActiva}
                onCheckedChange={(v) => setPolicy((p) => ({ ...p, autoSalidaActiva: v }))}
              />
            </div>
            {policy.autoSalidaActiva && (
              <div className="space-y-1 pl-1">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm">Margen tras la hora de salida</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={policy.autoSalidaMargenMin}
                    onChange={(e) =>
                      setPolicy((p) => ({ ...p, autoSalidaMargenMin: Number(e.target.value) }))
                    }
                  >
                    {MINUTOS_OPCIONES.map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tiempo de cortesía que el sistema espera tras la hora prevista antes de cerrar, por
                  si el empleado se queda unos minutos de más y ficha él mismo. A 0 min cierra justo a
                  la hora prevista.
                </p>
              </div>
            )}
          </div>

          {/* Multi-empresa: aviso de jornada que continúa en otra empresa */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Avisar cuando la jornada continúa en otra empresa</Label>
                <p className="text-xs text-muted-foreground">
                  Para empleados que trabajan en varias empresas en la misma jornada. Cuando su turno
                  pasa de una empresa a otra, no vuelven a fichar: el sistema les avisa de que su
                  jornada continúa en la otra empresa (en vez del recordatorio de fichar entrada).
                  Aplica a todos los empleados de esta empresa.
                </p>
              </div>
              <Switch
                checked={policy.avisoCambioEmpresa}
                onCheckedChange={(v) => setPolicy((p) => ({ ...p, avisoCambioEmpresa: v }))}
              />
            </div>
          </div>

          {/* Cierre manual de fichajes abiertos */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Cerrar todos los fichajes abiertos</Label>
                <p className="text-xs text-muted-foreground">
                  Por si algún empleado se dejó la jornada abierta fuera de su turno. Cierra ahora
                  todas las jornadas abiertas de esta empresa a su hora de salida prevista; las que no
                  tengan horario se cierran a la hora actual y quedan marcadas para revisión.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={cerrarAbiertos}
                disabled={cerrando}
                className="gap-2 shrink-0"
              >
                {cerrando ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Cerrando…</>
                ) : (
                  <><DoorClosed className="h-4 w-4" />Cerrar fichajes</>
                )}
              </Button>
            </div>
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
      {dialog}
    </div>
  );
}
