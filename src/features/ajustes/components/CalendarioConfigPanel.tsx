"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/shared/components/NumberInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { COMUNIDADES_AUTONOMAS } from "@/features/rrhh/actions/festivos-types";
import {
  getDiasVacacionesAnio,
  setDiasVacacionesAnio,
  getComunidadAutonoma,
  setComunidadAutonoma,
} from "@/features/rrhh/actions/calendario-config-actions";

/**
 * Normas de empresa del calendario: los días de vacaciones al año y la
 * comunidad autónoma de la que salen los festivos.
 *
 * Vive en Ajustes → Departamentos → RRHH → submódulo "Calendarios", no en el
 * engranaje de la vista: las dos deciden el saldo y los festivos de TODA la
 * plantilla, así que son del nivel protegido. `embedded` quita el marco propio
 * para encajar en la fila del submódulo, que ya aporta su tarjeta.
 */
export function CalendarioConfigPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const { empresaVisible } = useEmpresa();
  const empresaId = empresaVisible.id;

  const [dias, setDias] = useState<number | null>(null);
  const [comunidad, setComunidad] = useState("");
  // La de partida, para saber al guardar si hay que rehacer los festivos.
  const [comunidadInicial, setComunidadInicial] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([
      getDiasVacacionesAnio(empresaId),
      getComunidadAutonoma(empresaId),
    ]).then(([resDias, resCom]) => {
      if (!activo) return;
      setDias(resDias.dias);
      setComunidad(resCom.comunidad);
      setComunidadInicial(resCom.comunidad);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [empresaId]);

  async function guardar() {
    if (dias == null || !Number.isFinite(dias) || dias < 1) {
      toast.error("Escribe cuántos días de vacaciones al año.");
      return;
    }
    setGuardando(true);
    const res = await setDiasVacacionesAnio(empresaId, Math.round(dias));
    if (!res.ok) {
      setGuardando(false);
      toast.error(res.error ?? "No se pudo guardar.");
      return;
    }
    // Solo se rehacen los festivos si la comunidad ha cambiado de verdad:
    // regenerar por costumbre borraría y reescribiría festivos sin motivo.
    if (comunidad && comunidad !== comunidadInicial) {
      const resCom = await setComunidadAutonoma(empresaId, comunidad);
      setGuardando(false);
      if (!resCom.ok) {
        toast.error(resCom.error ?? "No se pudo guardar la comunidad autónoma.");
        return;
      }
      setComunidadInicial(comunidad);
      toast.success("Guardado. Festivos actualizados.");
      return;
    }
    setGuardando(false);
    toast.success("Guardado.");
  }

  return (
    <div className={embedded ? "space-y-5" : "rounded-lg border bg-card p-4 md:p-6 space-y-5 max-w-2xl"}>
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Calendario de la empresa</h3>
          <p className="text-sm text-muted-foreground">
            Se aplica a toda la empresa y a todos los empleados.
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="space-y-1.5 rounded-lg border bg-card p-4">
            <Label htmlFor="dias-vac">Días de vacaciones al año</Label>
            <NumberInput
              id="dias-vac"
              value={dias}
              onValueChange={setDias}
              min={1}
              max={366}
              decimales={false}
              disabled={guardando}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Los días que le corresponden a cada empleado por año completo. De
              aquí sale el saldo que ven en su panel y RRHH en la ficha.
            </p>
          </div>

          <div className="space-y-1.5 rounded-lg border bg-card p-4">
            <Label htmlFor="comunidad">Comunidad autónoma</Label>
            <Select value={comunidad} onValueChange={setComunidad} disabled={guardando}>
              <SelectTrigger id="comunidad" className="max-w-sm">
                <SelectValue placeholder="Elige una comunidad" />
              </SelectTrigger>
              <SelectContent>
                {COMUNIDADES_AUTONOMAS.map((com) => (
                  <SelectItem key={com} value={com}>{com}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Decide los festivos autonómicos que ven los empleados. Al cambiarla
              se rehacen los festivos de este año y del siguiente; los locales,
              que añades tú, se conservan.
            </p>
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
