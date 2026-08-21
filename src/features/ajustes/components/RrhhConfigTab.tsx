"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listDepartamentos } from "@/features/rrhh/actions/empleados-actions";
import { getRrhhConfig, saveRrhhConfig } from "@/features/rrhh/actions/rrhh-config-actions";
import {
  DIAS_SEMANA_OPCIONES,
  VACACIONES_REGLAS_DEFAULT,
  nombreDiaISO,
} from "@/features/mi-panel/lib/vacaciones-reglas";

type DepartamentoOpt = { id: string; nombre: string };

/**
 * Configuración de RRHH a nivel de empresa: de qué departamento salen los
 * validadores de cada área. Empleados de área operativa son validados por el
 * departamento que se elija aquí (default RRHH), y los de área administrativa
 * por el que se elija (default Dirección). Aplica a las dos columnas de
 * validador (trabajo y ausencias).
 *
 * Vive como bloque dentro de Ajustes → Departamentos → RRHH → submódulo
 * "Solicitudes". El prop `embedded` quita el marco/ancho propios para que
 * encaje dentro de la fila del submódulo (que ya aporta su tarjeta).
 */
export function ValidadoresSolicitudesConfig({ embedded = false }: { embedded?: boolean } = {}) {
  const [departamentos, setDepartamentos] = useState<DepartamentoOpt[]>([]);
  const [operativaId, setOperativaId] = useState<string>("");
  const [administrativaId, setAdministrativaId] = useState<string>("");
  const [tareasActivo, setTareasActivo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Reglas de vacaciones. El día de inicio se puede apagar: apagado significa
  // que el empleado empieza sus vacaciones el día que quiera. Se guarda el
  // último día elegido aunque esté apagado, para no perderlo al reactivarlo.
  const [diaInicioActivo, setDiaInicioActivo] = useState(true);
  const [diaInicio, setDiaInicio] = useState<number>(VACACIONES_REGLAS_DEFAULT.diaInicio ?? 1);
  const [diasMin, setDiasMin] = useState<string>(String(VACACIONES_REGLAS_DEFAULT.diasMin ?? 7));
  const [diasMax, setDiasMax] = useState<string>(String(VACACIONES_REGLAS_DEFAULT.diasMax ?? 7));

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([listDepartamentos(), getRrhhConfig()]).then(([depRes, cfgRes]) => {
      if (!activo) return;
      setDepartamentos((depRes.data ?? []) as DepartamentoOpt[]);
      if (cfgRes.ok && cfgRes.data) {
        setOperativaId(cfgRes.data.validadorDeptoOperativaId ?? "");
        setAdministrativaId(cfgRes.data.validadorDeptoAdministrativaId ?? "");
        setTareasActivo(cfgRes.data.tareasValidadorActivo);
        setDiaInicioActivo(cfgRes.data.vacacionesDiaInicio != null);
        if (cfgRes.data.vacacionesDiaInicio != null) {
          setDiaInicio(cfgRes.data.vacacionesDiaInicio);
        }
        setDiasMin(cfgRes.data.vacacionesDiasMin != null ? String(cfgRes.data.vacacionesDiasMin) : "");
        setDiasMax(cfgRes.data.vacacionesDiasMax != null ? String(cfgRes.data.vacacionesDiasMax) : "");
      }
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, []);

  // Un máximo por debajo del mínimo dejaría a la plantilla sin poder pedir
  // vacaciones, así que se avisa aquí y se bloquea el guardado.
  const minNum = diasMin.trim() === "" ? null : Number(diasMin);
  const maxNum = diasMax.trim() === "" ? null : Number(diasMax);
  const rangoInvalido =
    minNum != null && maxNum != null && Number.isFinite(minNum) && Number.isFinite(maxNum)
      ? maxNum < minNum
      : false;

  async function guardar() {
    if (rangoInvalido) {
      toast.error("El máximo de días de vacaciones no puede ser menor que el mínimo.");
      return;
    }
    setGuardando(true);
    const res = await saveRrhhConfig({
      validadorDeptoOperativaId: operativaId || null,
      validadorDeptoAdministrativaId: administrativaId || null,
      tareasValidadorActivo: tareasActivo,
      // Apagado = null = el empleado puede empezar cualquier día.
      vacacionesDiaInicio: diaInicioActivo ? diaInicio : null,
      vacacionesDiasMin: minNum != null && Number.isFinite(minNum) ? minNum : null,
      vacacionesDiasMax: maxNum != null && Number.isFinite(maxNum) ? maxNum : null,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar la configuración.");
      return;
    }
    toast.success("Configuración guardada.");
  }

  return (
    <div className={embedded ? "space-y-5" : "rounded-lg border bg-card p-4 md:p-6 space-y-5 max-w-2xl"}>
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Quién valida las solicitudes</h3>
          <p className="text-sm text-muted-foreground">
            Elige de qué departamento salen los validadores según el área del
            empleado. Aplica tanto al validador de trabajo como al de ausencias.
            Si el departamento no tiene empleados, no habrá validadores
            disponibles y deberás crear uno en ese departamento.
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Validador del área operativa</Label>
              <Select value={operativaId} onValueChange={setOperativaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Por defecto: Recursos humanos.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Validador del área administrativa</Label>
              <Select value={administrativaId} onValueChange={setAdministrativaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Por defecto: Dirección.</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Tarea de validación para el validador</Label>
              <p className="text-xs text-muted-foreground">
                Si se activa, al validador le aparece una tarea en su panel mientras
                tenga solicitudes pendientes de aprobar o denegar. Se muestra cada día
                hasta que la resuelve.
              </p>
            </div>
            <Switch checked={tareasActivo} onCheckedChange={setTareasActivo} />
          </div>

          {/* Reglas con las que la plantilla pide vacaciones. */}
          <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Palmtree className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">Cómo se piden las vacaciones</h4>
                <p className="text-sm text-muted-foreground">
                  Estas reglas se aplican al formulario del empleado: si no las
                  cumple, no puede enviar la solicitud y se le explica por qué.
                  Los días se cuentan naturales, así que de lunes a domingo son 7.
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Día fijo para empezar las vacaciones</Label>
                <p className="text-xs text-muted-foreground">
                  {diaInicioActivo
                    ? `Las vacaciones solo pueden empezar en ${nombreDiaISO(diaInicio)}.`
                    : "Desactivado: el empleado puede empezar sus vacaciones cualquier día."}
                </p>
              </div>
              <Switch checked={diaInicioActivo} onCheckedChange={setDiaInicioActivo} />
            </div>

            {diaInicioActivo && (
              <div className="space-y-1.5">
                <Label>Día de la semana</Label>
                <Select value={String(diaInicio)} onValueChange={(v) => setDiaInicio(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un día" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA_OPCIONES.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Por defecto: lunes.</p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vacDiasMin">Mínimo de días por solicitud</Label>
                <Input
                  id="vacDiasMin"
                  type="number"
                  min={1}
                  max={366}
                  value={diasMin}
                  onChange={(e) => setDiasMin(e.target.value)}
                  placeholder="Sin mínimo"
                />
                <p className="text-xs text-muted-foreground">
                  Déjalo vacío para no exigir un mínimo. Por defecto: 7.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vacDiasMax">Máximo de días por solicitud</Label>
                <Input
                  id="vacDiasMax"
                  type="number"
                  min={1}
                  max={366}
                  value={diasMax}
                  onChange={(e) => setDiasMax(e.target.value)}
                  placeholder="Sin máximo"
                  aria-invalid={rangoInvalido}
                />
                <p className="text-xs text-muted-foreground">
                  Déjalo vacío para no poner tope. Por defecto: 7.
                </p>
              </div>
              {rangoInvalido && (
                <p className="md:col-span-2 text-xs font-medium text-rose-600">
                  El máximo no puede ser menor que el mínimo: nadie podría pedir
                  vacaciones.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={guardar} disabled={guardando || rangoInvalido} className="gap-2">
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
