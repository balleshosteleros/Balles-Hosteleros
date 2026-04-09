import { useState } from "react";
import { type Conteo, type LineaConteo } from "@/data/inventarios";
import { type ProductoStock } from "@/data/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

interface Props {
  conteos: Conteo[];
  onConteosChange: (conteos: Conteo[]) => void;
  productos: ProductoStock[];
  readOnly: boolean;
}

export default function ConteoSection({ conteos, onConteosChange, productos, readOnly }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConteoId, setEditingConteoId] = useState<string | null>(null);
  const [conteoNombre, setConteoNombre] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(conteos[0]?.id || null);

  const openNew = () => {
    setEditingConteoId(null);
    setConteoNombre("");
    setModalOpen(true);
  };

  const openEdit = (c: Conteo) => {
    setEditingConteoId(c.id);
    setConteoNombre(c.nombre);
    setModalOpen(true);
  };

  const saveConteo = () => {
    if (!conteoNombre.trim()) return;
    if (editingConteoId) {
      onConteosChange(conteos.map((c) => c.id === editingConteoId ? { ...c, nombre: conteoNombre } : c));
    } else {
      const newConteo: Conteo = {
        id: `cnt-${Date.now()}`,
        nombre: conteoNombre,
        lineas: [],
      };
      onConteosChange([...conteos, newConteo]);
    }
    setModalOpen(false);
    toast.success(editingConteoId ? "Conteo actualizado" : "Conteo creado");
  };

  const deleteConteo = (id: string) => {
    onConteosChange(conteos.filter((c) => c.id !== id));
    toast.success("Conteo eliminado");
  };

  const addProductoToConteo = (conteoId: string, productoId: string) => {
    const prod = productos.find((p) => p.id === productoId);
    if (!prod) return;
    onConteosChange(
      conteos.map((c) => {
        if (c.id !== conteoId) return c;
        if (c.lineas.some((l) => l.productoId === productoId)) {
          toast.info("Producto ya añadido");
          return c;
        }
        return {
          ...c,
          lineas: [...c.lineas, { productoId: prod.id, producto: prod.nombre, unidad: prod.unidad, cantidadReal: 0 }],
        };
      })
    );
  };

  const updateCantidad = (conteoId: string, productoId: string, cantidad: number) => {
    onConteosChange(
      conteos.map((c) => {
        if (c.id !== conteoId) return c;
        return {
          ...c,
          lineas: c.lineas.map((l) => l.productoId === productoId ? { ...l, cantidadReal: cantidad } : l),
        };
      })
    );
  };

  const removeLinea = (conteoId: string, productoId: string) => {
    onConteosChange(
      conteos.map((c) => {
        if (c.id !== conteoId) return c;
        return { ...c, lineas: c.lineas.filter((l) => l.productoId !== productoId) };
      })
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">CONTEOS</h3>
        {!readOnly && (
          <Button size="sm" variant="outline" className="gap-1" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Añadir conteo
          </Button>
        )}
      </div>

      {conteos.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No hay conteos. Crea uno para empezar.</p>
      )}

      {conteos.map((c) => (
        <div key={c.id} className="border rounded-lg bg-card">
          <div
            className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/30"
            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{c.nombre}</span>
              <Badge variant="secondary" className="text-[10px]">{c.lineas.length} productos</Badge>
            </div>
            {!readOnly && (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteConteo(c.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            )}
          </div>

          {expandedId === c.id && (
            <div className="px-4 pb-3 border-t">
              {!readOnly && (
                <div className="flex gap-2 py-2">
                  <Select onValueChange={(v) => addProductoToConteo(c.id, v)}>
                    <SelectTrigger className="w-[280px] h-8 text-xs">
                      <SelectValue placeholder="Añadir producto…" />
                    </SelectTrigger>
                    <SelectContent>
                      {productos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre} ({p.unidad})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {c.lineas.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Sin productos. Añade uno desde el selector.</p>
              ) : (
                <table className="w-full text-xs mt-1">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 font-bold text-muted-foreground">Producto</th>
                      <th className="text-left py-1.5 font-bold text-muted-foreground w-16">Unidad</th>
                      <th className="text-left py-1.5 font-bold text-muted-foreground w-28">Cantidad real</th>
                      {!readOnly && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {c.lineas.map((l) => (
                      <tr key={l.productoId} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">{l.producto}</td>
                        <td className="py-1.5 text-muted-foreground">{l.unidad}</td>
                        <td className="py-1.5">
                          {readOnly ? (
                            <span className="font-semibold">{l.cantidadReal}</span>
                          ) : (
                            <Input
                              type="number"
                              className="h-7 w-24 text-xs"
                              value={l.cantidadReal}
                              min={0}
                              step="any"
                              onChange={(e) => updateCantidad(c.id, l.productoId, parseFloat(e.target.value) || 0)}
                            />
                          )}
                        </td>
                        {!readOnly && (
                          <td className="py-1.5">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeLinea(c.id, l.productoId)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Modal nombre conteo */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingConteoId ? "Editar conteo" : "Nuevo conteo"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs font-bold">Nombre del conteo</Label>
            <Input value={conteoNombre} onChange={(e) => setConteoNombre(e.target.value)} placeholder="Ej: Conteo barra" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveConteo}>{editingConteoId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
