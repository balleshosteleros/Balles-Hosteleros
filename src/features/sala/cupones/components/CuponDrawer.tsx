"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2 } from "lucide-react";
import {
  CUPON_BENEFICIO_LABELS,
  CUPON_UNIDAD_STOCK_LABELS,
  CUPON_TURNOS_TODOS,
  CUPON_TURNO_LABELS,
  type Cupon,
  type CuponBeneficioTipo,
  type CuponInput,
  type CuponTurno,
  type CuponUnidadStock,
} from "@/features/sala/cupones/data/cupones";
import type { DiaSemanaKey } from "@/features/sala/data/reservas";
import {
  createCuponAction,
  updateCuponAction,
  deleteCuponAction,
} from "@/features/sala/cupones/actions/cupones-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

const DIAS: { key: DiaSemanaKey; label: string }[] = [
  { key: "lun", label: "Lun" },
  { key: "mar", label: "Mar" },
  { key: "mie", label: "Mié" },
  { key: "jue", label: "Jue" },
  { key: "vie", label: "Vie" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  cupon: Cupon | null; // null = crear
  onSaved: () => void;
}

export function CuponDrawer({ open, onClose, cupon, onSaved }: Props) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const isEdit = !!cupon;
  const [tituloInterno, setTituloInterno] = useState("");
  const [tituloCliente, setTituloCliente] = useState("");
  const [beneficioTipo, setBeneficioTipo] = useState<CuponBeneficioTipo>("porcentaje");
  const [beneficioValor, setBeneficioValor] = useState<string>("10");
  const [productoDescripcion, setProductoDescripcion] = useState("");
  const [unidadStock, setUnidadStock] = useState<CuponUnidadStock>("reservas");
  const [stockTotal, setStockTotal] = useState<string>("10");
  const [fechaCaducidad, setFechaCaducidad] = useState<string>("");
  const [diasSemana, setDiasSemana] = useState<DiaSemanaKey[]>(["lun","mar","mie","jue","vie","sab","dom"]);
  const [turnos, setTurnos] = useState<CuponTurno[]>(["COMIDA","CENA"]);
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cupon) {
      setTituloInterno(cupon.tituloInterno);
      setTituloCliente(cupon.tituloCliente ?? "");
      setBeneficioTipo(cupon.beneficioTipo);
      setBeneficioValor(cupon.beneficioValor != null ? String(cupon.beneficioValor) : "");
      setProductoDescripcion(cupon.productoDescripcion ?? "");
      setUnidadStock(cupon.unidadStock);
      setStockTotal(String(cupon.stockTotal));
      setFechaCaducidad(cupon.fechaCaducidad ?? "");
      setDiasSemana(cupon.diasSemana);
      setTurnos(cupon.turnos);
      setActivo(cupon.activo);
    } else {
      setTituloInterno("");
      setTituloCliente("");
      setBeneficioTipo("porcentaje");
      setBeneficioValor("10");
      setProductoDescripcion("");
      setUnidadStock("reservas");
      setStockTotal("10");
      setFechaCaducidad("");
      setDiasSemana(["lun","mar","mie","jue","vie","sab","dom"]);
      setTurnos(["COMIDA","CENA"]);
      setActivo(true);
    }
  }, [cupon, open]);

  function toggleDia(d: DiaSemanaKey) {
    setDiasSemana(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }
  function toggleTurno(t: CuponTurno) {
    setTurnos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const valorNum = beneficioValor ? Number(beneficioValor) : null;
      const input: CuponInput = {
        tituloInterno,
        tituloCliente: tituloCliente.trim() || null,
        beneficioTipo,
        beneficioValor: beneficioTipo === "producto_gratis" ? null : valorNum,
        productoDescripcion: beneficioTipo === "producto_gratis" ? productoDescripcion : null,
        unidadStock,
        stockTotal: Number(stockTotal),
        fechaCaducidad: fechaCaducidad || null,
        diasSemana,
        turnos,
        activo,
      };
      const res = isEdit
        ? await updateCuponAction(cupon!.id, input)
        : await createCuponAction(input);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success(isEdit ? "Cupón actualizado" : "Cupón creado");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!cupon) return;
    const ok = await confirmDelete({
      title: "Borrar cupón",
      description: `¿Borrar el cupón ${cupon.codigo}? No se puede deshacer.`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    const res = await deleteCuponAction(cupon.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Cupón borrado");
    onSaved();
    onClose();
  }

  function copyCodigo() {
    if (!cupon) return;
    navigator.clipboard.writeText(cupon.codigo);
    toast.success("Código copiado");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {confirmDeleteDialog}
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cupón" : "Nuevo cupón"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Código</Label>
              <div className="flex items-center gap-2">
                <Badge className="font-mono text-base px-3 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40">
                  {cupon!.codigo}
                </Badge>
                <Button type="button" size="sm" variant="outline" onClick={copyCodigo} className="h-7">
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {cupon!.stockConsumido}/{cupon!.stockTotal} consumido
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Se genera automáticamente y no se puede modificar.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ti">Título interno *</Label>
            <Input id="ti" value={tituloInterno} onChange={e => setTituloInterno(e.target.value)} placeholder="Ej: Promo cumple julio 2026" maxLength={120} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tc">Título para el cliente</Label>
            <Input id="tc" value={tituloCliente} onChange={e => setTituloCliente(e.target.value)} placeholder="Si lo dejas vacío, el cliente verá el título interno" maxLength={120} />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de beneficio *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CUPON_BENEFICIO_LABELS) as CuponBeneficioTipo[]).map(t => (
                <Button
                  key={t}
                  type="button"
                  variant={beneficioTipo === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBeneficioTipo(t)}
                  className="h-9"
                >
                  {CUPON_BENEFICIO_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>

          {beneficioTipo === "porcentaje" && (
            <div className="space-y-1.5">
              <Label htmlFor="bv">Porcentaje de descuento *</Label>
              <div className="flex items-center gap-2">
                <Input id="bv" type="number" min={1} max={100} value={beneficioValor} onChange={e => setBeneficioValor(e.target.value)} className="w-32" />
                <span className="text-sm text-muted-foreground">% (entre 1 y 100)</span>
              </div>
            </div>
          )}
          {beneficioTipo === "importe" && (
            <div className="space-y-1.5">
              <Label htmlFor="bv">Importe *</Label>
              <div className="flex items-center gap-2">
                <Input id="bv" type="number" min={0} step="0.01" value={beneficioValor} onChange={e => setBeneficioValor(e.target.value)} className="w-32" />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
            </div>
          )}
          {beneficioTipo === "producto_gratis" && (
            <div className="space-y-1.5">
              <Label htmlFor="pd">Descripción del producto *</Label>
              <Textarea id="pd" rows={2} value={productoDescripcion} onChange={e => setProductoDescripcion(e.target.value)} placeholder="Ej: Botella de cava 75 cl" maxLength={200} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stock se cuenta por *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CUPON_UNIDAD_STOCK_LABELS) as CuponUnidadStock[]).map(u => (
                  <Button
                    key={u}
                    type="button"
                    variant={unidadStock === u ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUnidadStock(u)}
                    className="h-9"
                  >
                    {CUPON_UNIDAD_STOCK_LABELS[u]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st">Stock total *</Label>
              <Input id="st" type="number" min={1} value={stockTotal} onChange={e => setStockTotal(e.target.value)} />
            </div>
          </div>
          {unidadStock === "personas" && (
            <p className="text-xs text-muted-foreground -mt-2">
              El stock se descontará en función del número de personas de cada reserva.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fc">Fecha de caducidad</Label>
            <Input id="fc" type="date" value={fechaCaducidad} onChange={e => setFechaCaducidad(e.target.value)} className="w-44" />
            <p className="text-xs text-muted-foreground">Si la dejas vacía, el cupón no caduca.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Días permitidos</Label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map(d => (
                <Button
                  key={d.key}
                  type="button"
                  variant={diasSemana.includes(d.key) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDia(d.key)}
                  className="h-8 w-12"
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Turnos permitidos</Label>
            <div className="flex gap-2">
              {CUPON_TURNOS_TODOS.map(t => (
                <Button
                  key={t}
                  type="button"
                  variant={turnos.includes(t) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleTurno(t)}
                  className="h-8"
                >
                  {CUPON_TURNO_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <Label htmlFor="activo" className="cursor-pointer">Cupón activo</Label>
            <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          {isEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Borrar
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear cupón"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
