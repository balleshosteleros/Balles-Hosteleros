"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/shared/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMUNIDADES_AUTONOMAS } from "@/features/rrhh/actions/festivos-types";
import {
  getDiasVacacionesAnio,
  setDiasVacacionesAnio,
  getComunidadAutonoma,
  setComunidadAutonoma,
} from "@/features/rrhh/actions/calendario-config-actions";

/**
 * Configuración del submódulo Calendario.
 *
 * De momento un solo ajuste: los días de vacaciones al año, que son los mismos
 * para toda la empresa. No cuelgan de ningún "calendario" porque aquí hay uno
 * solo, donde se registran las ausencias y los festivos de todos.
 */
export function ConfigCalendarioDialog({
  empresaId,
  open,
  onOpenChange,
}: {
  empresaId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [dias, setDias] = useState<number | null>(null);
  const [comunidad, setComunidad] = useState("");
  // La de partida, para saber al guardar si hay que rehacer los festivos.
  const [comunidadInicial, setComunidadInicial] = useState("");
  const [cargando, setCargando] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    Promise.all([
      getDiasVacacionesAnio(empresaId),
      getComunidadAutonoma(empresaId),
    ]).then(([resDias, resCom]) => {
      setDias(resDias.dias);
      setComunidad(resCom.comunidad);
      setComunidadInicial(resCom.comunidad);
      setCargando(false);
    });
  }, [open, empresaId]);

  function guardar() {
    if (dias == null || !Number.isFinite(dias) || dias < 1) {
      toast.error("Escribe cuántos días de vacaciones al año");
      return;
    }
    startTransition(async () => {
      const res = await setDiasVacacionesAnio(empresaId, Math.round(dias));
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      // Solo se rehacen los festivos si la comunidad ha cambiado de verdad:
      // regenerar por costumbre borraría y reescribiría festivos sin motivo.
      if (comunidad && comunidad !== comunidadInicial) {
        const resCom = await setComunidadAutonoma(empresaId, comunidad);
        if (!resCom.ok) {
          toast.error(resCom.error ?? "No se pudo guardar la comunidad autónoma");
          return;
        }
        setComunidadInicial(comunidad);
        toast.success("Guardado. Festivos actualizados");
        onOpenChange(false);
        return;
      }
      toast.success("Guardado");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuración del calendario</DialogTitle>
          <DialogDescription>
            Se aplica a toda la empresa y a todos los empleados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="dias-vac">Días de vacaciones al año</Label>
          <NumberInput
            id="dias-vac"
            value={dias}
            onValueChange={setDias}
            min={1}
            max={366}
            decimales={false}
            disabled={cargando || pending}
            className="w-32"
          />
          <p className="text-[11px] text-muted-foreground">
            Los días que le corresponden a cada empleado por año completo. De
            aquí sale el saldo que ven en su panel y RRHH en la ficha.
          </p>
        </div>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="comunidad">Comunidad autónoma</Label>
          <Select
            value={comunidad}
            onValueChange={setComunidad}
            disabled={cargando || pending}
          >
            <SelectTrigger id="comunidad" className="w-full">
              <SelectValue placeholder="Elige una comunidad" />
            </SelectTrigger>
            <SelectContent>
              {COMUNIDADES_AUTONOMAS.map((com) => (
                <SelectItem key={com} value={com}>{com}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Decide los festivos autonómicos que ven los empleados. Al cambiarla
            se rehacen los festivos de este año y del siguiente; los locales,
            que añades tú, se conservan.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={cargando || pending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
