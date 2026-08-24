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

  // Reglas de permiso: mín/máx de días por solicitud. En blanco = sin límite,
  // que es como se comporta un permiso mientras la empresa no configure nada.
  const [permisoMin, setPermisoMin] = useState<string>("");
  const [permisoMax, setPermisoMax] = useState<string>("");

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
        setPermisoMin(cfgRes.data.permisoDiasMin != null ? String(cfgRes.data.permisoDiasMin) : "");
        setPermisoMax(cfgRes.data.permisoDiasMax != null ? String(cfgRes.data.permisoDiasMax) : "");
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

  const permisoMinNum = permisoMin.trim() === "" ? null : Number(permisoMin);
  const permisoMaxNum = permisoMax.trim() === "" ? null : Number(permisoMax);
  const permisoRangoInvalido =
    permisoMinNum != null &&
    permisoMaxNum != null &&
    Number.isFinite(permisoMinNum) &&
    Number.isFinite(permisoMaxNum)
      ? permisoMaxNum < permisoMinNum
      : false;

  // Una sola fuente para la tabla de límites: añadir un tipo aquí lo pinta,
  // en vez de duplicar el par mínimo/máximo en otro bloque de la pantalla.
  const LIMITES_POR_TIPO = [
    {
      clave: "vacaciones",
      label: "Vacaciones",
      min: diasMin,
      max: diasMax,
      setMin: setDiasMin,
      setMax: setDiasMax,
      invalido: rangoInvalido,
    },
    {
      clave: "permiso",
      label: "Permisos",
      min: permisoMin,
      max: permisoMax,
      setMin: setPermisoMin,
      setMax: setPermisoMax,
      invalido: permisoRangoInvalido,
    },
  ];

  async function guardar() {
    if (rangoInvalido) {
      toast.error("El máximo de días de vacaciones no puede ser menor que el mínimo.");
      return;
    }
    if (permisoRangoInvalido) {
      toast.error("El máximo de días de permiso no puede ser menor que el mínimo.");
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
      // En blanco = null = sin límite.
      permisoDiasMin:
        permisoMinNum != null && Number.isFinite(permisoMinNum) ? permisoMinNum : null,
      permisoDiasMax:
        permisoMaxNum != null && Number.isFinite(permisoMaxNum) ? permisoMaxNum : null,
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

          {/* Días por solicitud: una sola tabla para todos los tipos, en vez
              de repetir "mínimo / máximo" en un bloque por cada uno. */}
          <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Palmtree className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  Cuántos días puede pedir de una vez
                </h4>
                <p className="text-sm text-muted-foreground">
                  Se aplica al formulario del empleado: si no lo cumple, no puede
                  enviar la solicitud y se le explica por qué. Los días son
                  naturales, así que de lunes a domingo son 7. Deja un campo
                  vacío para no poner ese límite.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="hidden md:grid grid-cols-[1fr_auto_auto] gap-3 px-1 text-xs font-medium text-muted-foreground">
                <span>Tipo</span>
                <span className="w-24 text-center">Mínimo</span>
                <span className="w-24 text-center">Máximo</span>
              </div>

              {LIMITES_POR_TIPO.map((t) => (
                <div
                  key={t.clave}
                  className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-3 rounded-lg border bg-card p-3"
                >
                  <span className="text-sm font-medium">{t.label}</span>
                  <div className="grid grid-cols-2 gap-2 md:contents">
                    <Input
                      type="number"
                      min={1}
                      max={366}
                      value={t.min}
                      onChange={(e) => t.setMin(e.target.value)}
                      placeholder="Sin mín."
                      aria-label={`Mínimo de días por solicitud de ${t.label.toLowerCase()}`}
                      aria-invalid={t.invalido}
                      className="md:w-24"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={366}
                      value={t.max}
                      onChange={(e) => t.setMax(e.target.value)}
                      placeholder="Sin máx."
                      aria-label={`Máximo de días por solicitud de ${t.label.toLowerCase()}`}
                      aria-invalid={t.invalido}
                      className="md:w-24"
                    />
                  </div>
                  {t.invalido && (
                    <p className="text-xs font-medium text-rose-600 md:col-span-3">
                      El máximo no puede ser menor que el mínimo: nadie podría
                      pedir {t.label.toLowerCase()}.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Día fijo para empezar las vacaciones</Label>
                <p className="text-xs text-muted-foreground">
                  {diaInicioActivo
                    ? `Las vacaciones solo pueden empezar en ${nombreDiaISO(diaInicio)}. Los permisos pueden empezar cualquier día.`
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

            <p className="text-xs text-muted-foreground">
              El máximo de días al año se configura aparte, en RRHH → Horarios →
              Tipos de ausencia, en el campo «Límite de días al año» de cada tipo.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={guardar}
              disabled={guardando || rangoInvalido || permisoRangoInvalido}
              className="gap-2"
            >
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
