"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  CheckCircle2,
  Package,
  ShoppingCart,
  Truck,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { getNecesidadCompra } from "@/features/logistica/actions/escandallos-actions";
import { createPedido } from "@/features/logistica/actions/pedidos-actions";
import type { NecesidadCompraRow } from "@/features/logistica/types/db";
import { toast } from "sonner";

interface SugerenciaItem extends NecesidadCompraRow {
  selected: boolean;
  cantidadFinal: number;
}

export function SugerenciasPedidoModal({
  open,
  onClose,
  onOrdersCreated,
}: {
  open: boolean;
  onClose: () => void;
  onOrdersCreated: () => void;
}) {
  const [items, setItems] = useState<SugerenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadSugerencias = async () => {
    setLoading(true);
    const res = await getNecesidadCompra();
    if (res.ok) {
      setItems(
        res.data.map((i) => ({
          ...i,
          selected: true,
          cantidadFinal: Math.ceil(i.necesidad),
        }))
      );
    } else {
      toast.error("Error al cargar sugerencias");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadSugerencias();
  }, [open]);

  const toggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.producto_id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const updateCantidad = (id: string, val: string) => {
    const num = parseFloat(val.replace(",", ".")) || 0;
    setItems((prev) =>
      prev.map((i) => (i.producto_id === id ? { ...i, cantidadFinal: num } : i))
    );
  };

  const selectedItems = items.filter((i) => i.selected);

  // Agrupar por proveedor
  const porProveedor = useMemo(() => {
    const groups: Record<string, SugerenciaItem[]> = {};
    selectedItems.forEach((i) => {
      const p = i.proveedor_nombre || "Sin proveedor asignado";
      if (!groups[p]) groups[p] = [];
      groups[p].push(i);
    });
    return groups;
  }, [selectedItems]);

  const handleCreateOrders = async () => {
    if (selectedItems.length === 0) {
      toast.error("Selecciona al menos un producto");
      return;
    }

    setCreating(true);
    let count = 0;
    let errors = 0;

    for (const [provName, group] of Object.entries(porProveedor)) {
      const res = await createPedido({
        proveedorNombre: provName,
        proveedorId: group[0].proveedor_preferido || undefined,
        lineas: group.map((item) => ({
          productoId: item.producto_id,
          productoNombre: item.nombre,
          cantidad: item.cantidadFinal,
          unidad: item.unidad,
          precioUnitario: item.precio_estimado || 0,
        })),
        notas: "Pedido generado automáticamente por sugerencia de stock.",
      });

      if (res.ok) count++;
      else errors++;
    }

    setCreating(false);
    if (count > 0) {
      toast.success(`${count} pedido(s) generado(s) como borrador`);
      onOrdersCreated();
      onClose();
    }
    if (errors > 0) {
      toast.error(`Error al generar ${errors} pedido(s)`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <ShoppingCart className="h-5 w-5 text-primary" />
            SUGERENCIAS DE COMPRA AUTOMÁTICA
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Productos con stock por debajo del mínimo. Ajusta cantidades y genera pedidos.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6 pt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium italic">Analizando stock y necesidades...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-muted/30 rounded-xl border border-dashed">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <div>
                <p className="font-bold text-foreground">¡Todo en orden!</p>
                <p className="text-sm text-muted-foreground">No hay productos que requieran reposición inmediata.</p>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Se han detectado <strong>{items.length} productos</strong> con necesidad de compra. 
                  Los pedidos se crearán en estado <strong>Borrador</strong> agrupados por proveedor.
                </p>
              </div>

              <ScrollArea className="flex-1 border rounded-lg bg-card">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 z-10">
                    <tr className="border-b text-xs font-bold text-muted-foreground">
                      <th className="px-4 py-3 text-left w-10">
                        <Checkbox 
                          checked={items.length > 0 && items.every(i => i.selected)} 
                          onCheckedChange={(v) => setItems(prev => prev.map(i => ({ ...i, selected: !!v })))} 
                        />
                      </th>
                      <th className="px-4 py-3 text-left">PRODUCTO</th>
                      <th className="px-4 py-3 text-left">PROVEEDOR</th>
                      <th className="px-4 py-3 text-right">STOCK</th>
                      <th className="px-4 py-3 text-right">NECESIDAD</th>
                      <th className="px-4 py-3 text-center w-32">CANT. PEDIR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.producto_id} className={`border-b hover:bg-muted/30 transition-colors ${!item.selected ? "opacity-50" : ""}`}>
                        <td className="px-4 py-2.5">
                          <Checkbox checked={item.selected} onCheckedChange={() => toggleSelect(item.producto_id)} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-foreground">{item.nombre}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{item.unidad}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs truncate max-w-[150px]">
                              {item.proveedor_nombre || "Sin proveedor"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {item.stock_actual} / {item.stock_objetivo}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">
                          {item.necesidad.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Input 
                            type="text" 
                            className="h-8 text-right font-bold" 
                            value={item.cantidadFinal}
                            onChange={(e) => updateCantidad(item.producto_id, e.target.value)}
                            disabled={!item.selected}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-muted/20">
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              {selectedItems.length} productos seleccionados &rarr; <strong>{Object.keys(porProveedor).length} pedidos</strong>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={creating}>Cancelar</Button>
              <Button 
                onClick={handleCreateOrders} 
                disabled={selectedItems.length === 0 || creating}
                className="gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                Generar {Object.keys(porProveedor).length} pedidos
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
