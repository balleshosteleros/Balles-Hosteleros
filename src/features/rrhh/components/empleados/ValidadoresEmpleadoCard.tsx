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
import {
  listValidadoresElegibles,
  setValidadoresEmpleado,
  type AreaEmpleado,
  type ValidadorElegible,
} from "@/features/rrhh/actions/validadores-actions";

type Props = {
  empleadoId: string;
  validadorTrabajoId: string | null;
  validadorAusenciasId: string | null;
  onSaved?: () => Promise<void> | void;
};

const AREA_LABEL: Record<AreaEmpleado, string> = {
  OPERATIVA: "operativa",
  ADMINISTRATIVA: "administrativa",
};

/**
 * Configura los dos validadores del empleado: quién aprueba sus solicitudes de
 * trabajo y quién las de ausencias. Los candidatos son los empleados del
 * departamento que valida al área de este empleado (configurable en
 * Ajustes → RRHH). Ambos son obligatorios al guardar.
 */
export function ValidadoresEmpleadoCard({
  empleadoId,
  validadorTrabajoId,
  validadorAusenciasId,
  onSaved,
}: Props) {
  const [candidatos, setCandidatos] = useState<ValidadorElegible[]>([]);
  const [area, setArea] = useState<AreaEmpleado | null>(null);
  const [departamentoNombre, setDepartamentoNombre] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajoId, setTrabajoId] = useState<string>(validadorTrabajoId ?? "");
  const [ausenciasId, setAusenciasId] = useState<string>(validadorAusenciasId ?? "");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setTrabajoId(validadorTrabajoId ?? "");
    setAusenciasId(validadorAusenciasId ?? "");
  }, [validadorTrabajoId, validadorAusenciasId]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    listValidadoresElegibles({ empleadoId }).then((res) => {
      if (!activo) return;
      setCandidatos(res.ok ? res.data : []);
      setArea(res.area);
      setDepartamentoNombre(res.departamentoNombre);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [empleadoId]);

  async function guardar() {
    if (!trabajoId || !ausenciasId) {
      toast.error("Asigna un validador de trabajo y uno de ausencias.");
      return;
    }
    setGuardando(true);
    const res = await setValidadoresEmpleado({
      empleadoId,
      validadorTrabajoId: trabajoId,
      validadorAusenciasId: ausenciasId,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudieron guardar los validadores.");
      return;
    }
    toast.success("Validadores guardados.");
    await onSaved?.();
  }

  const sinCandidatos = !cargando && candidatos.length === 0;

  return (
    <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Validadores</h3>
          <p className="text-sm text-muted-foreground">
            Quién aprueba las solicitudes de este empleado.{" "}
            {area && departamentoNombre ? (
              <>
                Al ser de área <strong className="text-foreground">{AREA_LABEL[area]}</strong>,
                pueden validarle quienes tengan acceso a{" "}
                <strong className="text-foreground">{departamentoNombre}</strong> en su rol.
              </>
            ) : (
              <>El departamento validador se configura en Ajustes → RRHH.</>
            )}
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando candidatos…</p>
      ) : sinCandidatos ? (
        <p className="text-sm text-rose-600">
          {!area
            ? "Este empleado no tiene departamento asignado, así que no se puede determinar su área. Asígnale un departamento primero."
            : departamentoNombre
              ? `No hay ningún empleado activo con acceso a ${departamentoNombre} en su rol. Da acceso a ${departamentoNombre} a algún rol, o cambia el departamento validador en Ajustes → RRHH.`
              : "No hay ningún departamento validador configurado para esta área. Configúralo en Ajustes → RRHH."}
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Validador de trabajo</Label>
              <Select value={trabajoId} onValueChange={setTrabajoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un validador" />
                </SelectTrigger>
                <SelectContent>
                  {candidatos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombreCompleto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Validador de ausencias</Label>
              <Select value={ausenciasId} onValueChange={setAusenciasId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un validador" />
                </SelectTrigger>
                <SelectContent>
                  {candidatos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombreCompleto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
