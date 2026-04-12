import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ALMACENES, type Pedido, type LineaPedido, calcLineaTotal } from "@/features/logistica/data/pedidos";
import { listProveedores } from "@/features/logistica/actions/proveedores-actions";
import { Trash2, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (p: Pedido) => void;
  item: Pedido | null;
  empresaId: string;
  empresaNombre: string;
}

const emptyLinea = (): LineaPedido => ({
  id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productoId: "", producto: "", cantidad: 1, unidad: "kg", servida: 0,
  precioUC: 0, impuesto: 10, dtoPct: 0, dtoEur: 0, total: 0,
});

export function PedidoModal({ open, onClose, onSave, item, empresaId, empresaNombre }: Props) {
  const isEdit = !!item;
  const almacenes = ALMACENES[empresaId] || ALMACENES.habana || ["COCINA", "BARRA"];
  const [proveedoresList, setProveedoresList] = useState<string[]>([]);

  useEffect(() => {
    listProveedores().then((res) => {
      if (res.ok) {
        const names = (res.data as unknown as Array<Record<string, unknown>>)
          .map((r) => (r.nombre_comercial as string) ?? (r.nombre as string) ?? "")
          .filter((n) => !!n)
          .sort();
        setProveedoresList(names);
      }
    });
  }, []);

  const [form, setForm] = useState(() => item ? { ...item } : {
    id: `ped-${Date.now()}`, numero: `PED-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    empresaId, empresa: empresaNombre, proveedor: "", docProveedor: "",
    almacen: almacenes[0] ?? "", fecha: new Date().toISOString().slice(0, 10),
    fechaEntrega: "", estado: "Borrador" as const,
    lineas: [emptyLinea()], dtoPct: 0, dtoEur: 0, notas: "",
    albaranId: null, creador: "Usuario actual", ultimaActualizacion: new Date().toISOString().slice(0, 10),
  });

  const setField = (f: string, v: string | number) => setForm((p) => ({ ...p, [f]: v }));

  const updateLinea = (idx: number, field: string, val: string | number) => {
    setForm((prev) => {
      const lineas = [...prev.lineas];
      const l = { ...lineas[idx], [field]: val };
      l.total = calcLineaTotal(l);
      lineas[idx] = l;
      return { ...prev, lineas };
    });
  };

  const addLinea = () => setForm((p) => ({ ...p, lineas: [...p.lineas, emptyLinea()] }));
  const removeLinea = (idx: number) => setForm((p) => ({ ...p, lineas: p.lineas.filter((_, i) => i !== idx) }));

  const handleSave = () => {
    const updated = { ...form, ultimaActualizacion: new Date().toISOString().slice(0, 10) };
    onSave(updated as Pedido);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{isEdit ? `Editar Pedido ${form.numero}` : "Nuevo Pedido"}</DialogTitle>
        </DialogHeader>

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><Label className="text-xs font-semibold">Proveedor</Label>
            <Select value={form.proveedor} onValueChange={(v) => setField("proveedor", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{proveedoresList.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs font-semibold">Doc. Proveedor</Label><Input value={form.docProveedor} onChange={(e) => setField("docProveedor", e.target.value)} /></div>
          <div><Label className="text-xs font-semibold">Almacén</Label>
            <Select value={form.almacen} onValueChange={(v) => setField("almacen", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{almacenes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs font-semibold">Fecha</Label><Input type="date" value={form.fecha} onChange={(e) => setField("fecha", e.target.value)} /></div>
          <div><Label className="text-xs font-semibold">Fecha Entrega</Label><Input type="date" value={form.fechaEntrega} onChange={(e) => setField("fechaEntrega", e.target.value)} /></div>
        </div>

        {/* Lineas */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-foreground">PRODUCTOS</h3>
            <Button size="sm" variant="outline" onClick={addLinea} className="gap-1"><Plus className="h-3 w-3" /> Añadir línea</Button>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-muted/50 border-b">
                {["Producto", "Cant.", "Ud.", "Precio U.C.", "% Imp.", "Dto %", "Dto €", "Total €", ""].map((h) => (
                  <th key={h || "act"} className="px-2 py-2 text-left font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {form.lineas.map((l, i) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-2 py-1"><Input className="h-8 text-xs" value={l.producto} onChange={(e) => updateLinea(i, "producto", e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-16" type="number" value={l.cantidad} onChange={(e) => updateLinea(i, "cantidad", +e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-14" value={l.unidad} onChange={(e) => updateLinea(i, "unidad", e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-20" type="number" step="0.01" value={l.precioUC} onChange={(e) => updateLinea(i, "precioUC", +e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-14" type="number" value={l.impuesto} onChange={(e) => updateLinea(i, "impuesto", +e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-14" type="number" value={l.dtoPct} onChange={(e) => updateLinea(i, "dtoPct", +e.target.value)} /></td>
                    <td className="px-2 py-1"><Input className="h-8 text-xs w-16" type="number" step="0.01" value={l.dtoEur} onChange={(e) => updateLinea(i, "dtoEur", +e.target.value)} /></td>
                    <td className="px-2 py-1 font-semibold text-foreground">{calcLineaTotal(l).toFixed(2)}</td>
                    <td className="px-2 py-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLinea(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div><Label className="text-xs font-semibold">Dto % global</Label><Input type="number" value={form.dtoPct} onChange={(e) => setField("dtoPct", +e.target.value)} /></div>
          <div><Label className="text-xs font-semibold">Dto € global</Label><Input type="number" step="0.01" value={form.dtoEur} onChange={(e) => setField("dtoEur", +e.target.value)} /></div>
        </div>
        <div><Label className="text-xs font-semibold">Notas</Label><Textarea value={form.notas} onChange={(e) => setField("notas", e.target.value)} rows={2} /></div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{isEdit ? "Guardar cambios" : "Crear pedido"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
