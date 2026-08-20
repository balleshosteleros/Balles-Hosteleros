"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  type EmpresaReservasRegla,
  type MetricaRegla,
  type ReglaInput,
  type TurnoRegla,
  type VigenciaSpec,
  reglaToVigencia,
} from "../data/reglas";
import { TurnoToggle } from "./TurnoToggle";
import { VigenciaSelector } from "./VigenciaSelector";
import {
  createReglaReserva,
  updateReglaReserva,
} from "../actions/reglas-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrica: MetricaRegla;
  /** Si viene, modo edición. Si no, modo creación. */
  regla?: EmpresaReservasRegla | null;
  /** Label que acompaña al valor. Ej: "personas", "comensales". */
  unidad?: string;
  /**
   * Turnos que el local abre. Un turno cerrado no admite reservas, así que no se
   * ofrece: configurar un tope para él seria configurar algo que nunca se aplica.
   */
  turnosAbiertos?: TurnoRegla[];
  onSaved: () => void;
}

const TURNO_DEFAULT: TurnoRegla = "AMBOS";
const VIGENCIA_DEFAULT: VigenciaSpec = { modo: "todos_los_dias" };

export function ReglaModal({
  open,
  onOpenChange,
  metrica,
  regla,
  unidad = "personas",
  turnosAbiertos,
  onSaved,
}: Props) {
  const [valor, setValor] = useState<string>("");
  const [turno, setTurno] = useState<TurnoRegla>(TURNO_DEFAULT);
  const [vigencia, setVigencia] = useState<VigenciaSpec>(VIGENCIA_DEFAULT);
  const [saving, setSaving] = useState(false);

  // Solo los turnos abiertos. Si estamos editando una regla de un turno que
  // luego se cerró, se conserva su opción para no cambiarla sin querer.
  const opcionesTurno = useMemo<TurnoRegla[]>(() => {
    const base = turnosAbiertos && turnosAbiertos.length > 0
      ? turnosAbiertos
      : (["COMIDA", "CENA", "AMBOS"] as TurnoRegla[]);
    if (regla && !base.includes(regla.turno)) return [...base, regla.turno];
    return base;
  }, [turnosAbiertos, regla]);

  useEffect(() => {
    if (!open) return;
    if (regla) {
      setValor(String(regla.valor));
      setTurno(regla.turno);
      setVigencia(reglaToVigencia(regla));
    } else {
      setValor("");
      // Por defecto, el primer turno realmente disponible (si solo abre cenas,
      // "AMBOS" no existe y seleccionarlo dejaría la regla en un turno cerrado).
      setTurno(opcionesTurno.includes(TURNO_DEFAULT) ? TURNO_DEFAULT : opcionesTurno[0]!);
      setVigencia(VIGENCIA_DEFAULT);
    }
  }, [open, regla]);

  async function handleGuardar() {
    const v = Number(valor);
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Indica un número válido.");
      return;
    }
    const input: ReglaInput = {
      metrica,
      valor: v,
      turno,
      vigencia,
    };
    setSaving(true);
    try {
      const res = regla
        ? await updateReglaReserva(regla.id, input)
        : await createReglaReserva(input);
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

  const titulo = regla
    ? "Editar regla"
    : metrica === "cupo"
      ? "Nueva regla de aforo"
      : "Nueva regla de tamaño máximo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">
              {metrica === "cupo" ? `Aforo (${unidad})` : `Tamaño máximo (${unidad})`}
            </Label>
            <Input
              type="number"
              min={0}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="100"
              autoFocus
            />
          </div>

          <TurnoToggle value={turno} onChange={setTurno} options={opcionesTurno} />
          {opcionesTurno.length < 3 && (
            <p className="text-[11px] text-muted-foreground">
              {opcionesTurno.length === 1
                ? `Solo se muestra ${opcionesTurno[0] === "COMIDA" ? "la comida" : "la cena"}: el otro turno está cerrado en el horario de apertura.`
                : "Algunos turnos no aparecen porque están cerrados en el horario de apertura."}
            </p>
          )}

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
