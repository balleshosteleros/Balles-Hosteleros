"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listDepartamentos } from "@/features/rrhh/actions/empleados-actions";
import { getRrhhConfig, saveRrhhConfig } from "@/features/rrhh/actions/rrhh-config-actions";

type DepartamentoOpt = { id: string; nombre: string };

/**
 * Configuración de RRHH a nivel de empresa: de qué departamento salen los
 * validadores de cada área. Empleados de área operativa son validados por el
 * departamento que se elija aquí (default RRHH), y los de área administrativa
 * por el que se elija (default Dirección). Aplica a las dos columnas de
 * validador (trabajo y ausencias).
 */
export function RrhhConfigTab() {
  const [departamentos, setDepartamentos] = useState<DepartamentoOpt[]>([]);
  const [operativaId, setOperativaId] = useState<string>("");
  const [administrativaId, setAdministrativaId] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([listDepartamentos(), getRrhhConfig()]).then(([depRes, cfgRes]) => {
      if (!activo) return;
      setDepartamentos((depRes.data ?? []) as DepartamentoOpt[]);
      if (cfgRes.ok && cfgRes.data) {
        setOperativaId(cfgRes.data.validadorDeptoOperativaId ?? "");
        setAdministrativaId(cfgRes.data.validadorDeptoAdministrativaId ?? "");
      }
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, []);

  async function guardar() {
    setGuardando(true);
    const res = await saveRrhhConfig({
      validadorDeptoOperativaId: operativaId || null,
      validadorDeptoAdministrativaId: administrativaId || null,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar la configuración.");
      return;
    }
    toast.success("Configuración de validadores guardada.");
  }

  return (
    <div className="rounded-lg border bg-card p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Validadores de solicitudes</h3>
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
