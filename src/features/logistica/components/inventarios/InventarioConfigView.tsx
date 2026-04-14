import { useState } from "react";
import { type TipoInventario, type PlantillaInventario } from "@/features/logistica/data/inventarios";
import { type ProductoStock } from "@/features/logistica/data/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Settings, FileText, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tipos: TipoInventario[];
  onTiposChange: (tipos: TipoInventario[]) => void;
  plantillas: PlantillaInventario[];
  onPlantillasChange: (plantillas: PlantillaInventario[]) => void;
  productos: ProductoStock[];
  empresaId: string;
  onBack: () => void;
}

export default function InventarioConfigView({
  tipos, onTiposChange, plantillas, onPlantillasChange, productos, empresaId, onBack,
}: Props) {
  // ── Tipos state ──
  const [tipoModal, setTipoModal] = useState(false);
  const [editTipoId, setEditTipoId] = useState<string | null>(null);
  const [tipoNombre, setTipoNombre] = useState("");

  const openNewTipo = () => { setEditTipoId(null); setTipoNombre(""); setTipoModal(true); };
  const openEditTipo = (t: TipoInventario) => { setEditTipoId(t.id); setTipoNombre(t.nombre); setTipoModal(true); };
  const saveTipo = () => {
    if (!tipoNombre.trim()) return;
    if (editTipoId) {
      onTiposChange(tipos.map((t) => t.id === editTipoId ? { ...t, nombre: tipoNombre } : t));
    } else {
      onTiposChange([...tipos, { id: `tipo-${Date.now()}`, nombre: tipoNombre, empresaId }]);
    }
    setTipoModal(false);
    toast.success(editTipoId ? "Tipo actualizado" : "Tipo creado");
  };
  const deleteTipo = (id: string) => {
    onTiposChange(tipos.filter((t) => t.id !== id));
    toast.success("Tipo eliminado");
  };

  // ── Plantillas state ──
  const [plantillaModal, setPlantillaModal] = useState(false);
  const [editPlantillaId, setEditPlantillaId] = useState<string | null>(null);
  const [plantillaNombre, setPlantillaNombre] = useState("");
  const [plantillaProductos, setPlantillaProductos] = useState<Set<string>>(new Set());

  const openNewPlantilla = () => {
    setEditPlantillaId(null);
    setPlantillaNombre("");
    setPlantillaProductos(new Set());
    setPlantillaModal(true);
  };
  const openEditPlantilla = (p: PlantillaInventario) => {
    setEditPlantillaId(p.id);
    setPlantillaNombre(p.nombre);
    setPlantillaProductos(new Set(p.productosIds));
    setPlantillaModal(true);
  };
  const savePlantilla = () => {
    if (!plantillaNombre.trim()) return;
    if (plantillaProductos.size === 0) { toast.error("Selecciona al menos un producto"); return; }
    const data: PlantillaInventario = {
      id: editPlantillaId || `plt-${Date.now()}`,
      nombre: plantillaNombre,
      empresaId,
      productosIds: [...plantillaProductos],
    };
    if (editPlantillaId) {
      onPlantillasChange(plantillas.map((p) => p.id === editPlantillaId ? data : p));
    } else {
      onPlantillasChange([...plantillas, data]);
    }
    setPlantillaModal(false);
    toast.success(editPlantillaId ? "Plantilla actualizada" : "Plantilla creada");
  };
  const deletePlantilla = (id: string) => {
    onPlantillasChange(plantillas.filter((p) => p.id !== id));
    toast.success("Plantilla eliminada");
  };

  const toggleProducto = (pid: string) => {
    setPlantillaProductos((prev) => {
      const n = new Set(prev);
      n.has(pid) ? n.delete(pid) : n.add(pid);
      return n;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>← Volver</Button>
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Configuración de inventarios</h2>
      </div>

      <Tabs defaultValue="tipos">
        <TabsList>
          <TabsTrigger value="tipos" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Tipos de inventario</TabsTrigger>
          <TabsTrigger value="plantillas" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Plantillas prefijadas</TabsTrigger>
        </TabsList>

        {/* ── Tipos ── */}
        <TabsContent value="tipos" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Define los tipos de inventario disponibles.</p>
            <Button variant="primary" size="sm" onClick={openNewTipo}><Plus className="h-4 w-4" />Nuevo</Button>
          </div>
          <div className="border rounded-lg bg-card divide-y">
            {tipos.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Sin tipos. Crea uno.</p>}
            {tipos.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-medium text-foreground">{t.nombre}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTipo(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTipo(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Plantillas ── */}
        <TabsContent value="plantillas" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Las plantillas definen qué productos deben contarse obligatoriamente.</p>
            <Button variant="primary" size="sm" onClick={openNewPlantilla}><Plus className="h-4 w-4" />Nuevo</Button>
          </div>
          <div className="border rounded-lg bg-card divide-y">
            {plantillas.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Sin plantillas.</p>}
            {plantillas.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium text-foreground">{p.nombre}</span>
                  <Badge variant="secondary" className="ml-2 text-[10px]">{p.productosIds.length} productos</Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPlantilla(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deletePlantilla(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modal tipo ── */}
      <Dialog open={tipoModal} onOpenChange={setTipoModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editTipoId ? "Editar tipo" : "Nuevo tipo de inventario"}</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs font-bold">Nombre</Label>
            <Input value={tipoNombre} onChange={(e) => setTipoNombre(e.target.value)} placeholder="Ej: Inventario semanal" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipoModal(false)}>Cancelar</Button>
            <Button onClick={saveTipo}>{editTipoId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal plantilla ── */}
      <Dialog open={plantillaModal} onOpenChange={setPlantillaModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editPlantillaId ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold">Nombre de la plantilla</Label>
              <Input value={plantillaNombre} onChange={(e) => setPlantillaNombre(e.target.value)} placeholder="Ej: Plantilla cocina completa" />
            </div>
            <div>
              <Label className="text-xs font-bold mb-2 block">Productos obligatorios ({plantillaProductos.size} seleccionados)</Label>
              <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y">
                {productos.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                    <Checkbox checked={plantillaProductos.has(p.id)} onCheckedChange={() => toggleProducto(p.id)} />
                    <span className="text-sm">{p.nombre}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{p.unidad}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlantillaModal(false)}>Cancelar</Button>
            <Button onClick={savePlantilla}>{editPlantillaId ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
