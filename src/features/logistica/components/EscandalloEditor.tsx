"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChefHat, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  listEscandallosConPrecios,
  addEscandallo,
  removeEscandallo,
  getCosteEscandallo,
} from "@/features/logistica/actions/escandallos-actions";
import { listProductos } from "@/features/logistica/actions/producto-actions";

type EscandalloLinea = {
  id: string;
  ingredienteId: string;
  ingredienteNombre: string;
  ingredienteUnidad: string;
  cantidad: number;
  mermaPct: number;
  precioUnitario: number;
  subtotal: number;
};

type Ingrediente = { id: string; nombre: string; unidad: string };

export function EscandalloEditor({
  productoVentaId,
  precioVenta,
  onChanged,
}: {
  productoVentaId: string;
  precioVenta?: string | number;
  onChanged?: () => void;
}) {
  const [lineas, setLineas] = useState<EscandalloLinea[]>([]);
  const [costeTotal, setCosteTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selIng, setSelIng] = useState<string>("");
  const [cantidad, setCantidad] = useState("");
  const [merma, setMerma] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    const [escandalloRes, costeRes] = await Promise.all([
      listEscandallosConPrecios(productoVentaId),
      getCosteEscandallo(productoVentaId),
    ]);
    if (escandalloRes.ok) setLineas(escandalloRes.data);
    if (costeRes.ok) setCosteTotal(costeRes.coste);
    setLoading(false);
  }, [productoVentaId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([listProductos("compra"), listProductos("elaboracion")]).then(
      ([compra, elab]) => {
        const items = [...compra, ...elab]
          .map((p) => ({
            id: p.id,
            nombre: p.tipo === "elaboracion" ? `[Elab.] ${p.nombre}` : p.nombre,
            unidad: p.medida,
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setIngredientes(items);
      },
    );
  }, []);

  const handleAdd = async () => {
    if (!selIng) {
      toast.error("Selecciona un ingrediente");
      return;
    }
    const c = parseFloat(cantidad.replace(",", "."));
    if (isNaN(c) || c <= 0) {
      toast.error("Cantidad inválida");
      return;
    }
    const m = parseFloat(merma.replace(",", ".")) || 0;
    const res = await addEscandallo({
      productoVentaId,
      ingredienteId: selIng,
      cantidad: c,
      mermaPct: m,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Error al añadir");
      return;
    }
    toast.success("Ingrediente añadido");
    setAddOpen(false);
    setSelIng("");
    setCantidad("");
    setMerma("0");
    await load();
    onChanged?.();
  };

  const handleRemove = async (id: string) => {
    const res = await removeEscandallo(id);
    if (!res.ok) {
      toast.error("Error al eliminar");
      return;
    }
    await load();
    onChanged?.();
  };

  const pvNum =
    typeof precioVenta === "number"
      ? precioVenta
      : parseFloat(String(precioVenta ?? "").replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
  const margen = pvNum > 0 && costeTotal > 0 ? ((pvNum - costeTotal) / pvNum) * 100 : null;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ChefHat className="h-4 w-4" /> ESCANDALLO
          <Badge variant="secondary" className="text-[10px]">
            {lineas.length}
          </Badge>
        </CardTitle>
        <Button size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Añadir ingrediente
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner className="py-6" />
        ) : lineas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Este plato no tiene escandallo. Añade ingredientes para definirlo.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-bold">INGREDIENTE</th>
                    <th className="text-right py-2 font-bold">CANTIDAD</th>
                    <th className="text-right py-2 font-bold">MERMA %</th>
                    <th className="text-right py-2 font-bold">REAL</th>
                    <th className="text-right py-2 font-bold">COSTE MERMA</th>
                    <th className="text-right py-2 font-bold">PRECIO/U</th>
                    <th className="text-right py-2 font-bold">SUBTOTAL</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const real = l.cantidad * (1 + l.mermaPct / 100);
                    const costeMerma =
                      l.mermaPct > 0 && l.subtotal > 0
                        ? l.subtotal * (l.mermaPct / (100 + l.mermaPct))
                        : 0;
                    return (
                      <tr key={l.id} className="border-b">
                        <td className="py-2 font-medium">{l.ingredienteNombre}</td>
                        <td className="py-2 text-right">
                          {l.cantidad} {l.ingredienteUnidad}
                        </td>
                        <td className="py-2 text-right">{l.mermaPct}%</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {real.toFixed(3)} {l.ingredienteUnidad}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {costeMerma > 0 ? `${costeMerma.toFixed(3)} €` : "—"}
                        </td>
                        <td className="py-2 text-right">
                          {l.precioUnitario > 0 ? (
                            <span className="text-muted-foreground">
                              {l.precioUnitario.toFixed(2)} €
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">sin precio</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {l.subtotal > 0 ? `${l.subtotal.toFixed(3)} €` : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRemove(l.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {costeTotal > 0 && (
              <div className="flex flex-wrap gap-3 pt-1 border-t">
                <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-1.5">
                  <ChefHat className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-muted-foreground">Food cost:</span>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    {costeTotal.toFixed(2)} €
                  </span>
                </div>
                {pvNum > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">P.V.P:</span>
                    <span className="text-sm font-bold">{pvNum.toFixed(2)} €</span>
                  </div>
                )}
                {margen !== null && (
                  <div
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 border ${
                      margen >= 65
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700"
                        : margen >= 50
                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                    }`}
                  >
                    <span className="text-xs text-muted-foreground">Margen:</span>
                    <span
                      className={`text-sm font-bold ${
                        margen >= 65
                          ? "text-emerald-700 dark:text-emerald-300"
                          : margen >= 50
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {margen.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir ingrediente al escandallo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">Ingrediente *</Label>
              <Select value={selIng} onValueChange={setSelIng}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ingrediente" />
                </SelectTrigger>
                <SelectContent>
                  {ingredientes.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nombre} ({i.unidad})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Cantidad *</Label>
                <Input
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0,250"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">Merma %</Label>
                <Input
                  value={merma}
                  onChange={(e) => setMerma(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd}>Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
