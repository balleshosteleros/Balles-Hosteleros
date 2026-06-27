import { useState } from "react";
import { type TemporadaStock, type ProductoStock, temporadasSolapan } from "@/features/logistica/data/stock";
import { createTemporada, updateTemporada, deleteTemporada } from "@/features/logistica/actions/temporadas-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, CalendarDays, Sun } from "lucide-react";
import { toast } from "sonner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

interface Props {
  temporadas: TemporadaStock[];
  setTemporadas: React.Dispatch<React.SetStateAction<TemporadaStock[]>>;
  productos: ProductoStock[];
  empresaId: string;
  temporadaActiva: TemporadaStock | null;
}

const emptyForm = (): Omit<TemporadaStock, "empresaId"> => ({
  id: "",
  nombre: "",
  fechaInicio: "",
  fechaFin: "",
  overrides: {},
});

export default function TemporadasConfig({ temporadas, setTemporadas, productos, empresaId, temporadaActiva }: Props) {
  const { confirm: confirmDelete, dialog: confirmDialog } = useConfirmDelete();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);

  const openNew = () => { setForm(emptyForm()); setEditId(null); setModalOpen(true); };
  const openEdit = (t: TemporadaStock) => {
    setForm({ id: t.id, nombre: t.nombre, fechaInicio: t.fechaInicio, fechaFin: t.fechaFin, overrides: { ...t.overrides } });
    setEditId(t.id);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.nombre || !form.fechaInicio || !form.fechaFin) { toast.error("Completa nombre y fechas"); return; }
    if (form.fechaFin < form.fechaInicio) { toast.error("La fecha de fin debe ser posterior a la de inicio"); return; }
    const check = { fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, id: editId || undefined };
    if (temporadasSolapan(check, temporadas)) { toast.error("Las fechas se solapan con otra temporada existente"); return; }

    if (editId) {
      const res = await updateTemporada(editId, { nombre: form.nombre, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, overrides: form.overrides });
      if (!res.ok) { toast.error(`Error al actualizar: ${res.error}`); return; }
      setTemporadas((prev) => prev.map((t) => t.id === editId ? { ...t, nombre: form.nombre, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, overrides: form.overrides } : t));
      toast.success("Temporada actualizada");
    } else {
      const res = await createTemporada({ nombre: form.nombre, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, overrides: form.overrides });
      if (!res.ok) { toast.error(`Error al crear: ${res.error}`); return; }
      const nueva: TemporadaStock = { ...form, id: res.id!, empresaId, overrides: form.overrides };
      setTemporadas((prev) => [...prev, nueva]);
      toast.success("Temporada creada");
    }
    setModalOpen(false);
  };

  const remove = async (t: TemporadaStock) => {
    const ok = await confirmDelete({
      title: "Eliminar temporada",
      description: `¿Eliminar la temporada «${t.nombre}» y sus reglas de stock?`,
    });
    if (!ok) return;
    const res = await deleteTemporada(t.id);
    if (!res.ok) { toast.error(`Error al eliminar: ${res.error}`); return; }
    setTemporadas((prev) => prev.filter((x) => x.id !== t.id));
    toast.success("Temporada eliminada");
  };

  const updateOverride = (prodId: string, field: "stockMaximo" | "stockSeguridad", val: number) => {
    setForm((prev) => {
      const ov = { ...prev.overrides };
      if (!ov[prodId]) {
        const prod = productos.find((p) => p.id === prodId);
        ov[prodId] = { stockMaximo: prod?.stockMaximo || 0, stockSeguridad: prod?.stockSeguridad || 0 };
      }
      ov[prodId] = { ...ov[prodId], [field]: val };
      return { ...prev, overrides: ov };
    });
  };

  const removeOverride = (prodId: string) => {
    setForm((prev) => {
      const ov = { ...prev.overrides };
      delete ov[prodId];
      return { ...prev, overrides: ov };
    });
  };

  const addProduct = (prodId: string) => {
    const prod = productos.find((p) => p.id === prodId);
    if (!prod || form.overrides[prodId]) return;
    updateOverride(prodId, "stockMaximo", prod.stockMaximo);
  };

  const availableProducts = productos.filter((p) => !form.overrides[p.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Temporadas</h2>
          {temporadaActiva && (
            <Badge className="bg-primary/10 text-primary border-primary/30 text-xs gap-1">
              <Sun className="h-3 w-3" /> Activa: {temporadaActiva.nombre}
            </Badge>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={openNew}><Plus className="h-4 w-4" />Nuevo</Button>
      </div>

      {temporadas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No hay temporadas configuradas. Los valores base se aplican todo el año.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {temporadas.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)).map((t) => {
            const isActiva = temporadaActiva?.id === t.id;
            return (
              <div key={t.id} className={`rounded-lg border p-4 space-y-2 ${isActiva ? "border-primary bg-primary/5" : "bg-card"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-foreground">{t.nombre}</p>
                    <p className="text-xs text-muted-foreground">{t.fechaInicio} → {t.fechaFin}</p>
                  </div>
                  <div className="flex gap-1">
                    {isActiva && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Activa</Badge>}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{Object.keys(t.overrides).length} producto(s) con valores especiales</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar temporada */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar temporada" : "Nueva temporada"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold">Nombre</Label>
                <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Verano" />
              </div>
              <div>
                <Label className="text-xs font-bold">Fecha inicio</Label>
                <Input type="date" value={form.fechaInicio} onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-bold">Fecha fin</Label>
                <Input type="date" value={form.fechaFin} onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))} />
              </div>
            </div>

            <Separator />
            <div>
              <Label className="text-xs font-bold mb-2 block">Valores especiales por producto</Label>
              <p className="text-xs text-muted-foreground mb-3">Define el stock máximo y seguridad que aplican durante esta temporada. Solo los productos añadidos aquí tendrán valores distintos.</p>

              {Object.keys(form.overrides).length > 0 && (
                <div className="space-y-2 mb-3">
                  {Object.entries(form.overrides).map(([prodId, ov]) => {
                    const prod = productos.find((p) => p.id === prodId);
                    if (!prod) return null;
                    return (
                      <div key={prodId} className="flex items-center gap-2 bg-muted/30 rounded-md p-2">
                        <span className="text-sm font-medium flex-1 truncate">{prod.nombre}</span>
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">Máx</Label>
                          <Input type="number" className="h-7 w-20 text-xs" value={ov.stockMaximo} onChange={(e) => updateOverride(prodId, "stockMaximo", +e.target.value)} />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">Seg</Label>
                          <Input type="number" className="h-7 w-20 text-xs" value={ov.stockSeguridad} onChange={(e) => updateOverride(prodId, "stockSeguridad", +e.target.value)} />
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeOverride(prodId)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {availableProducts.length > 0 && (
                <select
                  className="w-full rounded-md border bg-background text-sm px-3 py-2 text-foreground"
                  value=""
                  onChange={(e) => { if (e.target.value) addProduct(e.target.value); }}
                >
                  <option value="">+ Añadir producto…</option>
                  {availableProducts.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.categoria})</option>)}
                </select>
              )}
            </div>
          </div>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
