"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { TurnoRegla, VigenciaSpec } from "@/features/sala/reglas/data/reglas";
import { reglaToVigencia } from "@/features/sala/reglas/data/reglas";
import {
  type EmpresaReservasIntervaloRegla,
  type IntervaloReglaInput,
  type MetricaIntervalo,
  METRICA_INTERVALO_LABELS,
  METRICA_INTERVALO_UNIDADES,
  normalizarHora,
} from "@/features/sala/reglas/data/reglas-intervalo";
import { TurnoToggle } from "@/features/sala/reglas/components/TurnoToggle";
import { VigenciaSelector } from "@/features/sala/reglas/components/VigenciaSelector";
import {
  createReglaIntervalo,
  updateReglaIntervalo,
} from "@/features/sala/reglas/actions/reglas-intervalo-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrica: MetricaIntervalo;
  /** Si viene, modo edición. */
  regla?: EmpresaReservasIntervaloRegla | null;
  onSaved: () => void;
}

const TURNO_DEFAULT: TurnoRegla = "AMBOS";
const VIGENCIA_DEFAULT: VigenciaSpec = { modo: "todos_los_dias" };

export function ReglaIntervaloModal({ open, onOpenChange, metrica, regla, onSaved }: Props) {
  const [valor, setValor] = useState<string>("");
  const [horaInicio, setHoraInicio] = useState<string>("13:00");
  const [horaFin, setHoraFin] = useState<string>("16:00");
  const [turno, setTurno] = useState<TurnoRegla>(TURNO_DEFAULT);
  const [vigencia, setVigencia] = useState<VigenciaSpec>(VIGENCIA_DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (regla) {
      setValor(String(regla.valor));
      setHoraInicio(regla.horaInicio);
      setHoraFin(regla.horaFin);
      setTurno(regla.turno);
      setVigencia(reglaToVigencia(regla));
    } else {
      setValor("");
      setHoraInicio("13:00");
      setHoraFin("16:00");
      setTurno(TURNO_DEFAULT);
      setVigencia(VIGENCIA_DEFAULT);
    }
  }, [open, regla]);

  async function handleGuardar() {
    const v = Number(valor);
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Indica un número válido.");
      return;
    }
    const hi = normalizarHora(horaInicio);
    const hf = normalizarHora(horaFin);
    if (!hi || !hf) {
      toast.error("Rango horario inválido.");
      return;
    }
    if (hi > hf) {
      toast.error("La hora de fin debe ser igual o posterior a la de inicio.");
      return;
    }
    const input: IntervaloReglaInput = {
      metrica,
      valor: v,
      horaInicio: hi,
      horaFin: hf,
      turno,
      vigencia,
    };
    setSaving(true);
    try {
      const res = regla
        ? await updateReglaIntervalo(regla.id, input)
        : await createReglaIntervalo(input);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success(regla ? "Regla actualizada" : "Regla creada");
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const unidad = METRICA_INTERVALO_UNIDADES[metrica];
  const titulo = regla
    ? "Editar regla de intervalo"
    : `Nueva regla — ${METRICA_INTERVALO_LABELS[metrica].toLowerCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Cuántas {unidad} como máximo</Label>
            <Input
              type="number"
              min={0}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={metrica === "max_personas" ? "20" : "5"}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Horas a aplicar</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">a</span>
              <Input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="w-32"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Rango inclusivo: la última hora también es reservable.
            </p>
          </div>

          <TurnoToggle value={turno} onChange={setTurno} />

          <VigenciaSelector value={vigencia} onChange={setVigencia} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleGuardar} disabled={saving || !valor.trim()}>
              {regla ? "Guardar" : "Crear regla"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
