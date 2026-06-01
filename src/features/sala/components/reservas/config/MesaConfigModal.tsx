"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  MESA_CODIGO_PREFIJO_REGEX,
  MESA_CODIGO_REGEX,
  TIPOS_MESA,
  TIPO_MESA_LABELS,
  type Mesa,
  type TipoMesa,
  type Zona,
} from "@/features/sala/planos/data/planos";
import { createMesa, updateMesa, deleteMesa } from "@/features/sala/planos/actions/mesas-actions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Si se pasa, modo edición. Si no, modo creación. */
  mesa?: Mesa | null;
  localId: string;
  zonas: Zona[];
  /** Zona preseleccionada al crear (opcional). */
  defaultZonaId?: string;
  onSaved?: () => void;
  onDeleted?: () => void;
}

export function MesaConfigModal({
  open,
  onOpenChange,
  mesa,
  localId,
  zonas,
  defaultZonaId,
  onSaved,
  onDeleted,
}: Props) {
  const esEdicion = !!mesa;
  const [codigo, setCodigo] = useState("");
  const [codigoBlur, setCodigoBlur] = useState(false);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(4);
  const [zonaId, setZonaId] = useState("");
  const [tipo, setTipo] = useState<TipoMesa>("BAJA");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCodigo(mesa?.codigo ?? "");
      setMin(mesa?.capacidadMin ?? 1);
      setMax(mesa?.capacidadMax ?? 4);
      setZonaId(mesa?.zonaId ?? defaultZonaId ?? zonas[0]?.id ?? "");
      setTipo(mesa?.tipo ?? "BAJA");
      setCodigoBlur(false);
    }
  }, [open, mesa, defaultZonaId, zonas]);

  const codigoNormalizado = codigo.toUpperCase();
  const prefijoOk = MESA_CODIGO_PREFIJO_REGEX.test(codigoNormalizado);
  const valido = MESA_CODIGO_REGEX.test(codigoNormalizado);
  const muestraErrorCodigo = codigoBlur && codigo.length > 0 && !valido;
  const muestraErrorTyping = !prefijoOk && codigo.length > 0;
  const guardarBloqueado = !valido || !zonaId || min > max || saving;

  async function handleSave() {
    if (guardarBloqueado) return;
    setSaving(true);
    try {
      if (esEdicion && mesa) {
        const res = await updateMesa(mesa.id, {
          zonaId,
          codigo: codigoNormalizado,
          capacidadMin: min,
          capacidadMax: max,
          tipo,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo actualizar");
          return;
        }
        toast.success("Mesa actualizada");
      } else {
        const res = await createMesa({
          localId,
          zonaId,
          codigo: codigoNormalizado,
          capacidadMin: min,
          capacidadMax: max,
          tipo,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear");
          return;
        }
        toast.success("Mesa creada");
      }
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!mesa) return;
    if (!confirm(`¿Borrar la mesa ${mesa.codigo}? Esta acción no se puede deshacer.`)) return;
    const res = await deleteMesa(mesa.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Mesa borrada");
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{esEdicion ? `Mesa: ${mesa?.codigo}` : "Nueva mesa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre mesa</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              onBlur={() => setCodigoBlur(true)}
              placeholder="Ej: A5, TE12, CR3"
              className={
                muestraErrorCodigo || muestraErrorTyping
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Empieza por letra; solo letras y números, hasta 6 caracteres.
            </p>
            {muestraErrorCodigo && (
              <p className="text-[11px] text-red-500">
                Formato inválido. Ejemplos válidos: A5, TE12, CR3, BARRA1.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CapInput label="Max" value={max} onChange={setMax} min={min} max={100} />
            <CapInput label="Min" value={min} onChange={setMin} min={1} max={max} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Zona</Label>
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className="h-9 text-sm w-full rounded-md border border-input bg-background px-2"
            >
              {zonas.length === 0 && <option value="">— No hay zonas creadas —</option>}
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de mesa</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoMesa)}
              className="h-9 text-sm w-full rounded-md border border-input bg-background px-2"
            >
              {TIPOS_MESA.map((t) => (
                <option key={t} value={t}>
                  {TIPO_MESA_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            {esEdicion ? (
              <Button variant="destructive" size="sm" onClick={handleDelete} type="button">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Borrar
              </Button>
            ) : (
              <div />
            )}
            <Button size="sm" onClick={handleSave} disabled={guardarBloqueado}>
              {esEdicion ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CapInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
          className="h-9 text-sm flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
