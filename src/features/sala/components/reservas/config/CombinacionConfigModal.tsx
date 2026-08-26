"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/shared/components/NumberInput";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  COLORES_PASTEL_COMBINACIONES,
  TIPOS_MESA,
  TIPO_MESA_LABELS,
  type Mesa,
  type MesaCombinacion,
  type TipoMesa,
  type Zona,
} from "@/features/sala/planos/data/planos";
import {
  createCombinacion,
  deleteCombinacion,
  listComponentes,
  updateCombinacion,
} from "@/features/sala/planos/actions/combinaciones-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { SelectorMesasPlano } from "./SelectorMesasPlano";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  combinacion?: MesaCombinacion | null;
  localId: string;
  mesas: Mesa[];
  zonas: Zona[];
  onSaved?: () => void;
  onDeleted?: () => void;
}

export function CombinacionConfigModal({
  open,
  onOpenChange,
  combinacion,
  localId,
  mesas,
  zonas,
  onSaved,
  onDeleted,
}: Props) {
  const esEdicion = !!combinacion;
  const [mesaIds, setMesaIds] = useState<string[]>([]);
  const [capacidadAuto, setCapacidadAuto] = useState(true);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [zonaId, setZonaId] = useState<string>("");
  const [tipo, setTipo] = useState<TipoMesa | "">("");
  const [color, setColor] = useState(COLORES_PASTEL_COMBINACIONES[0]);
  const [saving, setSaving] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const mesasOrdenadas = useMemo(
    () => mesaIds.map((id) => mesas.find((m) => m.id === id)).filter((x): x is Mesa => !!x),
    [mesaIds, mesas],
  );
  const codigoPreview = mesasOrdenadas.map((m) => m.codigo).join("+") || "—";
  const sumMax = mesasOrdenadas.reduce((s, m) => s + m.capacidadMax, 0);
  /**
   * Mínimo sugerido: donde la combinación EMPIEZA a tener sentido.
   *
   * No es la suma de los mínimos — dos mesas de 2-4 darían 4, y un grupo de 4
   * cabe en una sola mesa. Es el máximo que se alcanza con una mesa menos, +1:
   * así la combinación arranca justo cuando el grupo ya no cabe en menos mesas.
   */
  const sumMin = useMemo(() => {
    if (mesasOrdenadas.length < 2) return 1;
    const maximos = mesasOrdenadas.map((m) => m.capacidadMax).sort((a, b) => a - b);
    return maximos.slice(1).reduce((s, v) => s + v, 0) + 1;
  }, [mesasOrdenadas]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (combinacion) {
        const r = await listComponentes(combinacion.id);
        const ids = r.ok ? r.data.map((c) => c.mesaId) : [];
        setMesaIds(ids);
        // Marca la firma como ya aplicada: al abrir una combinación existente
        // se respeta el aforo guardado en vez de recalcularlo.
        firmaAplicadaRef.current = ids.join("|");
        setCapacidadAuto(combinacion.capacidadAuto);
        setMin(combinacion.capacidadMin);
        setMax(combinacion.capacidadMax);
        setZonaId(combinacion.zonaId ?? "");
        setTipo(combinacion.tipo ?? "");
        setColor(combinacion.colorMarca);
      } else {
        setMesaIds([]);
        firmaAplicadaRef.current = "";
        setCapacidadAuto(true);
        setMin(1);
        setMax(100);
        setZonaId("");
        setTipo("");
        // Color rotatorio automático: índice por timestamp
        const idx = Math.floor(Date.now() / 1000) % COLORES_PASTEL_COMBINACIONES.length;
        setColor(COLORES_PASTEL_COMBINACIONES[idx]);
      }
    })();
  }, [open, combinacion]);

  // Al cambiar las mesas, el aforo se recalcula solo: el máximo suma los
  // máximos y el mínimo arranca donde el grupo deja de caber en una mesa
  // menos. Sigue siendo editable — lo que se escriba manda hasta que se
  // vuelvan a tocar las mesas.
  const firmaMesas = mesaIds.join("|");
  const firmaAplicadaRef = useRef<string>("");
  useEffect(() => {
    if (mesasOrdenadas.length < 2) return;
    if (firmaAplicadaRef.current === firmaMesas) return;
    firmaAplicadaRef.current = firmaMesas;
    setMin(Math.min(sumMin, 100));
    setMax(Math.min(sumMax, 100));
  }, [firmaMesas, sumMin, sumMax, mesasOrdenadas.length]);

  // Preselecciona zona/tipo si todas las componentes coinciden
  useEffect(() => {
    if (esEdicion) return;
    if (mesasOrdenadas.length < 2) return;
    const zonas = new Set(mesasOrdenadas.map((m) => m.zonaId));
    if (zonas.size === 1 && !zonaId) setZonaId([...zonas][0]);
    const tipos = new Set(mesasOrdenadas.map((m) => m.tipo));
    if (tipos.size === 1 && !tipo) setTipo([...tipos][0]);
  }, [mesasOrdenadas, esEdicion, zonaId, tipo]);

  const guardarBloqueado =
    mesaIds.length < 2 || min > max || min < 1 || max > 100 || saving;

  function toggleMesa(id: string) {
    setMesaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    if (guardarBloqueado) return;
    setSaving(true);
    try {
      if (esEdicion && combinacion) {
        const res = await updateCombinacion(combinacion.id, {
          mesaIds,
          capacidadAuto,
          capacidadMin: min,
          capacidadMax: max,
          zonaId: zonaId || null,
          tipo: tipo || null,
          colorMarca: color,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo actualizar");
          return;
        }
        toast.success("Combinación actualizada");
      } else {
        const res = await createCombinacion({
          localId,
          mesaIds,
          capacidadAuto,
          capacidadMin: min,
          capacidadMax: max,
          zonaId: zonaId || null,
          tipo: tipo || null,
          colorMarca: color,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear");
          return;
        }
        toast.success("Combinación creada");
      }
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!combinacion) return;
    const ok = await confirmDelete({
      title: `Borrar la combinación "${combinacion.codigo}"`,
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    const res = await deleteCombinacion(combinacion.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Combinación borrada");
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? `Combinación: ${combinacion?.codigo}` : "Nueva combinación"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selector de mesas (chips) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Mesas que se combinan (mínimo 2)</Label>
            {mesaIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/30">
                {mesasOrdenadas.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold border rounded px-2 py-0.5 bg-background"
                    style={{ borderColor: color }}
                  >
                    {m.codigo}
                    <button
                      type="button"
                      onClick={() => toggleMesa(m.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Código resultante: <span className="font-semibold">{codigoPreview}</span>
            </p>
            {mesas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1">
                No hay mesas creadas en este local.
              </p>
            ) : (
              <SelectorMesasPlano
                mesas={mesas}
                zonas={zonas}
                seleccionadas={mesaIds}
                onToggle={toggleMesa}
                color={color}
              />
            )}
          </div>

          {/* Capacidad */}
          <div className="space-y-2">
            <Label className="text-xs">Capacidad automática</Label>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Se calcula sola con los mínimos y máximos de las mesas
              seleccionadas. Si quieres, puedes cambiarla a mano.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mínimo</Label>
                <NumberInput
                  min={1}
                  max={max}
                  emptyValue={1}
                  decimales={false}
                  value={min}
                  onValueChange={setMin}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Máximo</Label>
                <NumberInput
                  min={min}
                  max={100}
                  emptyValue={100}
                  decimales={false}
                  value={max}
                  onValueChange={setMax}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Zona */}
          <div className="space-y-1.5">
            <Label className="text-xs">Zona (opcional)</Label>
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className="h-9 text-sm w-full rounded-md border border-input bg-background px-2"
            >
              <option value="">— Sin zona específica —</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de mesa (opcional)</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoMesa | "")}
              className="h-9 text-sm w-full rounded-md border border-input bg-background px-2"
            >
              <option value="">— Sin tipo específico —</option>
              {TIPOS_MESA.map((t) => (
                <option key={t} value={t}>
                  {TIPO_MESA_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Color de marca */}
          <div className="space-y-1.5">
            <Label className="text-xs">Color de marca visual</Label>
            <div className="grid grid-cols-10 gap-1.5">
              {COLORES_PASTEL_COMBINACIONES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 rounded-md border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
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
      {confirmDeleteDialog}
    </Dialog>
  );
}
