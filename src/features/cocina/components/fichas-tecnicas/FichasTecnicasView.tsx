"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  crearFichaVacia, calcularMargen,
  generateShareToken, registerSharedFicha, unregisterSharedFicha,
  type FichaTecnica, type CategoriaFicha, type EstadoFicha, type ConfigFichas,
  ESTADO_FICHA_LABELS, DEFAULT_ALERGENOS, DEFAULT_RECOMENDACIONES, DEFAULT_PARTIDAS, DEFAULT_MENAJE,
} from "@/features/cocina/data/fichas-tecnicas";
import { getEmpleadosPorEmpresa } from "@/features/rrhh/data/rrhh";
import {
  listFichas, createFicha, updateFicha, deleteFicha,
} from "@/features/cocina/actions/fichas-tecnicas-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Plus, List, LayoutGrid, Settings, ChefHat, Euro, Percent,
  Copy, Archive, Trash2, GripVertical, Printer, Download,
  Share2, Link2, LinkIcon, ImageIcon, Upload, X, FileDown, Check,
} from "lucide-react";
import { toast } from "sonner";

// ─── Estado colors ─────────────────────────────────────────────
const ESTADO_COLORS: Record<EstadoFicha, string> = {
  activa: "bg-emerald-100 text-emerald-700 border-emerald-200",
  borrador: "bg-amber-100 text-amber-700 border-amber-200",
  archivada: "bg-muted text-muted-foreground border-border",
};

// ─── Generic Config List Editor ────────────────────────────────
function ConfigListEditor({ title, items, onChange }: { title: string; items: string[]; onChange: (items: string[]) => void }) {
  const [nuevo, setNuevo] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  const add = () => {
    if (!nuevo.trim() || items.includes(nuevo.trim())) return;
    onChange([...items, nuevo.trim()]);
    setNuevo("");
    toast.success(`${title}: valor añadido`);
  };

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
    toast.success(`${title}: valor eliminado`);
  };

  const startEdit = (idx: number) => { setEditIdx(idx); setEditVal(items[idx]); };

  const saveEdit = () => {
    if (editIdx === null || !editVal.trim()) return;
    onChange(items.map((v, i) => i === editIdx ? editVal.trim() : v));
    setEditIdx(null);
    setEditVal("");
  };

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">{title}</h3>
      <div className="flex gap-2">
        <Input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder={`Nuevo valor...`} className="max-w-xs h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button size="sm" onClick={add} className="gap-1 h-8 text-xs"><Plus className="h-3.5 w-3.5" /> Añadir</Button>
      </div>
      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between px-3 py-1.5 rounded-lg border bg-card text-sm">
            {editIdx === idx ? (
              <div className="flex items-center gap-2 flex-1">
                <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} className="h-7 text-sm flex-1"
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()} autoFocus />
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveEdit}>OK</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditIdx(null)}>✕</Button>
              </div>
            ) : (
              <>
                <span className="text-foreground">{item}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(idx)}>
                    <span className="text-xs">✎</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(idx)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Config Panel ──────────────────────────────────────────────
function ConfigPanel({
  categorias, onCatChange, config, onConfigChange,
}: {
  categorias: CategoriaFicha[]; onCatChange: (cats: CategoriaFicha[]) => void;
  config: ConfigFichas; onConfigChange: (cfg: ConfigFichas) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [configTab, setConfigTab] = useState("categorias");

  const addCat = () => {
    if (!nombre.trim()) return;
    const nueva: CategoriaFicha = {
      id: `cat-${Date.now()}`, nombre: nombre.toUpperCase().trim(),
      orden: categorias.length + 1, activa: true,
    };
    onCatChange([...categorias, nueva]);
    setNombre("");
    toast.success("Categoría creada");
  };

  return (
    <div className="space-y-4">
      <Tabs value={configTab} onValueChange={setConfigTab}>
        <TabsList className="h-8">
          <TabsTrigger value="categorias" className="text-xs">Categorías</TabsTrigger>
          <TabsTrigger value="alergenos" className="text-xs">Alérgenos</TabsTrigger>
          <TabsTrigger value="partidas" className="text-xs">Partidas</TabsTrigger>
          <TabsTrigger value="menaje" className="text-xs">Menaje</TabsTrigger>
          <TabsTrigger value="recomendaciones" className="text-xs">Recomendaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-4 space-y-4">
          <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">Categorías</h3>
          <div className="flex gap-2">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nueva categoría..." className="max-w-xs h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addCat()} />
            <Button size="sm" onClick={addCat} className="gap-1 h-8 text-xs"><Plus className="h-3.5 w-3.5" /> Añadir</Button>
          </div>
          <div className="space-y-1">
            {categorias.sort((a, b) => a.orden - b.orden).map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  <span className="text-sm font-medium text-foreground">{cat.nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Activa</Label>
                  <Switch checked={cat.activa} onCheckedChange={(v) => onCatChange(categorias.map((c) => c.id === cat.id ? { ...c, activa: v } : c))} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alergenos" className="mt-4">
          <ConfigListEditor title="Alérgenos" items={config.alergenos} onChange={(v) => onConfigChange({ ...config, alergenos: v })} />
        </TabsContent>
        <TabsContent value="partidas" className="mt-4">
          <ConfigListEditor title="Partidas" items={config.partidas} onChange={(v) => onConfigChange({ ...config, partidas: v })} />
        </TabsContent>
        <TabsContent value="menaje" className="mt-4">
          <ConfigListEditor title="Menaje" items={config.menaje} onChange={(v) => onConfigChange({ ...config, menaje: v })} />
        </TabsContent>
        <TabsContent value="recomendaciones" className="mt-4">
          <ConfigListEditor title="Recomendaciones" items={config.recomendaciones} onChange={(v) => onConfigChange({ ...config, recomendaciones: v })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Photo Uploader ────────────────────────────────────────────
function FotoUploader({ foto, onChange }: { foto?: string; onChange: (url?: string) => void }) {
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold">Foto del plato</Label>
      {foto ? (
        <div className="relative w-full max-w-[200px]">
          <img src={foto} alt="Foto del plato" className="w-full h-40 object-cover rounded-lg border" />
          <div className="absolute top-1 right-1 flex gap-1">
            <label className="h-7 w-7 flex items-center justify-center rounded-md bg-background/80 backdrop-blur cursor-pointer hover:bg-background border">
              <Upload className="h-3.5 w-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
            <Button size="icon" variant="ghost" className="h-7 w-7 bg-background/80 backdrop-blur border" onClick={() => onChange(undefined)}>
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full max-w-[200px] h-40 rounded-lg border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:border-primary/40 transition-colors">
          <ImageIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <span className="text-xs text-muted-foreground">Subir imagen</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      )}
    </div>
  );
}

// ─── Detail / Edit Dialog ──────────────────────────────────────
function FichaDetalle({
  ficha, open, onClose, categorias, onSave, config, empresaId,
}: {
  ficha: FichaTecnica | null; open: boolean; onClose: () => void;
  categorias: CategoriaFicha[]; onSave: (f: FichaTecnica) => void;
  config: ConfigFichas; empresaId: string;
}) {
  const [form, setForm] = useState<FichaTecnica | null>(null);
  useMemo(() => { if (ficha) setForm({ ...ficha }); }, [ficha]);
  if (!form) return null;

  const empleados = getEmpleadosPorEmpresa(empresaId);
  const margen = calcularMargen(form.pvp, form.costeTotal);
  const costePct = form.pvp > 0 ? ((form.costeTotal / form.pvp) * 100).toFixed(2) : "0.00";

  const update = (partial: Partial<FichaTecnica>) => setForm((prev) => prev ? { ...prev, ...partial } : prev);
  const toggleArray = (arr: string[], item: string) => arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const addIngrediente = () => {
    update({ ingredientes: [...form.ingredientes, { id: `i-${Date.now()}`, ingrediente: "", unidad: "g", cantidad: 0 }] });
  };
  const removeIngrediente = (id: string) => {
    update({ ingredientes: form.ingredientes.filter((i) => i.id !== id) });
  };

  const handleSave = () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    onSave({ ...form, fechaActualizacion: new Date().toISOString().slice(0, 10) });
    toast.success("Ficha guardada correctamente");
    onClose();
  };

  const handlePrint = () => window.print();

  const handleShare = () => {
    const token = form.shareToken || generateShareToken();
    const catNombre = categorias.find((c) => c.id === form.categoriaId)?.nombre || "";
    const updated = { ...form, shareToken: token, shareEnabled: true };
    registerSharedFicha(updated, catNombre);
    update({ shareToken: token, shareEnabled: true });
    const url = `${window.location.origin}/ficha-publica/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado al portapapeles");
  };

  const handleDisableShare = () => {
    if (form.shareToken) unregisterSharedFicha(form.shareToken);
    update({ shareEnabled: false });
    toast.info("Enlace desactivado");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-6">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <ChefHat className="h-5 w-5 text-primary" />
                  {form.id.startsWith("ft-new") ? "Nueva ficha técnica" : "Editar ficha técnica"}
                </DialogTitle>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={handlePrint}>
                    <Printer className="h-3.5 w-3.5" /> Imprimir
                  </Button>
                  {form.shareEnabled ? (
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={handleDisableShare}>
                      <LinkIcon className="h-3.5 w-3.5 text-destructive" /> Desactivar enlace
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={handleShare}>
                      <Share2 className="h-3.5 w-3.5" /> Compartir
                    </Button>
                  )}
                </div>
              </div>
              {form.shareEnabled && form.shareToken && (
                <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-muted/50 border text-xs">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground truncate flex-1">
                    {window.location.origin}/ficha-publica/{form.shareToken}
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/ficha-publica/${form.shareToken}`);
                    toast.success("Enlace copiado");
                  }}>
                    Copiar
                  </Button>
                </div>
              )}
            </DialogHeader>

            {/* Photo + General */}
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide border-b pb-1">Datos generales</h4>
              <div className="flex gap-6">
                <FotoUploader foto={form.foto} onChange={(url) => update({ foto: url })} />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Nombre del plato *</Label>
                    <Input value={form.nombre} onChange={(e) => update({ nombre: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoría</Label>
                    <Select value={form.categoriaId} onValueChange={(v) => update({ categoriaId: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categorias.filter((c) => c.activa).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Estado</Label>
                    <Select value={form.estado} onValueChange={(v) => update({ estado: v as EstadoFicha })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ESTADO_FICHA_LABELS) as EstadoFicha[]).map((e) => (
                          <SelectItem key={e} value={e}>{ESTADO_FICHA_LABELS[e]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Creador</Label>
                    <Select value={form.responsable} onValueChange={(v) => update({ responsable: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                      <SelectContent>
                        {empleados.map((emp) => (
                          <SelectItem key={emp.id} value={`${emp.nombre} ${emp.apellidos}`}>
                            {emp.nombre} {emp.apellidos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox checked={form.delicatessen} onCheckedChange={(v) => update({ delicatessen: !!v })} />
                    <Label className="text-xs">Delicatessen / Especial</Label>
                  </div>
                </div>
              </div>
            </section>

            {/* Ingredientes */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1">
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Ingredientes</h4>
                <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={addIngrediente}>
                  <Plus className="h-3 w-3" /> Añadir
                </Button>
              </div>
              {form.ingredientes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Ingrediente</TableHead>
                      <TableHead className="text-xs w-24">Unidad</TableHead>
                      <TableHead className="text-xs w-24">Cantidad</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.ingredientes.map((ing) => (
                      <TableRow key={ing.id}>
                        <TableCell>
                          <Input className="h-8 text-sm" value={ing.ingrediente} onChange={(e) =>
                            update({ ingredientes: form.ingredientes.map((i) => i.id === ing.id ? { ...i, ingrediente: e.target.value } : i) })} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={ing.unidad} onChange={(e) =>
                            update({ ingredientes: form.ingredientes.map((i) => i.id === ing.id ? { ...i, unidad: e.target.value } : i) })} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" type="number" value={ing.cantidad} onChange={(e) =>
                            update({ ingredientes: form.ingredientes.map((i) => i.id === ing.id ? { ...i, cantidad: +e.target.value } : i) })} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeIngrediente(ing.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sin ingredientes. Pulsa "Añadir" para empezar.</p>
              )}
            </section>

            {/* Elaboración y presentación */}
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide border-b pb-1">Elaboración y presentación</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Partida</Label>
                  <Select value={form.partida} onValueChange={(v) => update({ partida: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar partida" /></SelectTrigger>
                    <SelectContent>
                      {config.partidas.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Guarnición</Label>
                  <Input value={form.guarnicion} onChange={(e) => update({ guarnicion: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Elaboración / Receta</Label>
                  <Textarea rows={4} value={form.elaboracion} onChange={(e) => update({ elaboracion: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Decoración</Label>
                  <Input value={form.decoracion} onChange={(e) => update({ decoracion: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Menaje</Label>
                  <Select value={form.menaje} onValueChange={(v) => update({ menaje: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar menaje" /></SelectTrigger>
                    <SelectContent>
                      {config.menaje.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Presentación en mesa</Label>
                  <Textarea rows={2} value={form.presentacionMesa} onChange={(e) => update({ presentacionMesa: e.target.value })} />
                </div>
              </div>
            </section>

            {/* Alérgenos */}
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide border-b pb-1">Alérgenos</h4>
              <div className="flex flex-wrap gap-2">
                {config.alergenos.map((a) => {
                  const checked = form.alergenos.includes(a);
                  return (
                    <button key={a} onClick={() => update({ alergenos: toggleArray(form.alergenos, a) })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${checked ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}>
                      {a}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Recomendaciones */}
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide border-b pb-1">Recomendaciones</h4>
              <div className="flex flex-wrap gap-2">
                {config.recomendaciones.map((r) => {
                  const checked = form.recomendaciones.includes(r);
                  return (
                    <button key={r} onClick={() => update({ recomendaciones: toggleArray(form.recomendaciones, r) })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${checked ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}>
                      {r}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Datos económicos */}
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide border-b pb-1">Datos económicos</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border bg-card">
                  <CardContent className="p-4 text-center">
                    <Euro className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Coste</p>
                    <Input className="mt-1 text-center font-bold h-9" type="number" step="0.01"
                      value={form.costeTotal} onChange={(e) => update({ costeTotal: +e.target.value })} />
                  </CardContent>
                </Card>
                <Card className="border bg-card">
                  <CardContent className="p-4 text-center">
                    <Percent className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Coste %</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{costePct}%</p>
                  </CardContent>
                </Card>
                <Card className="border bg-card">
                  <CardContent className="p-4 text-center">
                    <Euro className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">PVP</p>
                    <Input className="mt-1 text-center font-bold h-9" type="number" step="0.01"
                      value={form.pvp} onChange={(e) => update({ pvp: +e.target.value })} />
                  </CardContent>
                </Card>
                <Card className="border bg-card">
                  <CardContent className="p-4 text-center">
                    <Percent className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                    <p className="text-xs text-muted-foreground">Margen</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{margen}%</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Escandallo */}
            {form.desglose.length > 0 && (
              <section className="space-y-3">
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wide border-b pb-1">Escandallo</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Ingrediente</TableHead>
                        <TableHead className="text-[10px]">Cant/Ud</TableHead>
                        <TableHead className="text-[10px] text-right">Coste bruto</TableHead>
                        <TableHead className="text-[10px] text-right">Merma %</TableHead>
                        <TableHead className="text-[10px] text-right">Coste merma</TableHead>
                        <TableHead className="text-[10px] text-right">Coste neto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.desglose.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-sm">{d.ingrediente}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{d.cantidadUnidad}</TableCell>
                          <TableCell className="text-sm text-right">{d.costeBruto.toFixed(2)}€</TableCell>
                          <TableCell className="text-sm text-right">{d.mermaPct}%</TableCell>
                          <TableCell className="text-sm text-right">{d.costeMerma.toFixed(2)}€</TableCell>
                          <TableCell className="text-sm text-right font-medium">{d.costeNeto.toFixed(2)}€</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSave}>Guardar ficha</Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export function FichasTecnicasView() {
  const { empresaActual } = useEmpresa();

  const [fichas, setFichas] = useState<Record<string, FichaTecnica[]>>({});
  const [categorias, setCategorias] = useState<Record<string, CategoriaFicha[]>>({});
  const [configs, setConfigs] = useState<Record<string, ConfigFichas>>({});
  const [loading, setLoading] = useState(true);

  // --- Helper: map DB row → FichaTecnica ---
  const mapDbToFicha = useCallback((row: Record<string, unknown>): FichaTecnica => {
    return {
      id: row.id as string,
      nombre: (row.nombre as string) ?? "",
      categoriaId: (row.categoria as string) ?? "",
      estado: ((row.estado as string) ?? "borrador") as EstadoFicha,
      responsable: (row.created_by as string) ?? "",
      fechaCreacion: (row.created_at as string)?.slice(0, 10) ?? "",
      fechaActualizacion: (row.updated_at as string)?.slice(0, 10) ?? "",
      foto: (row.foto as string) ?? undefined,
      delicatessen: (row.delicatessen as boolean) ?? false,
      ingredientes: Array.isArray(row.ingredientes) ? row.ingredientes : [],
      elaboracion: (row.elaboracion as string) ?? "",
      partida: (row.partida as string) ?? "",
      guarnicion: (row.guarnicion as string) ?? "",
      decoracion: (row.decoracion as string) ?? "",
      menaje: (row.menaje as string) ?? "",
      presentacionMesa: (row.presentacion_mesa as string) ?? "",
      alergenos: Array.isArray(row.alergenos) ? row.alergenos : [],
      recomendaciones: Array.isArray(row.recomendaciones) ? row.recomendaciones : [],
      costeTotal: (row.coste_total as number) ?? 0,
      pvp: (row.pvp as number) ?? 0,
      desglose: Array.isArray(row.desglose) ? row.desglose : [],
      empresaId: (row.empresa_id as string) ?? "",
      shareToken: (row.share_token as string) ?? undefined,
      shareEnabled: (row.share_enabled as boolean) ?? false,
    };
  }, []);

  // --- Load fichas from server ---
  const loadFichas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFichas();
      if (res.ok) {
        const mapped = (res.data as Record<string, unknown>[]).map(mapDbToFicha);
        setFichas((prev) => ({ ...prev, [empresaActual.id]: mapped }));
      } else {
        toast.error("Error al cargar fichas técnicas");
      }
    } catch {
      toast.error("Error de conexión al cargar fichas");
    } finally {
      setLoading(false);
    }
  }, [empresaActual.id, mapDbToFicha]);

  useEffect(() => {
    loadFichas();
  }, [loadFichas]);

  const empresaFichas = fichas[empresaActual.id] ?? [];
  const empresaCats = categorias[empresaActual.id] ?? [];
  const defaultConfig: ConfigFichas = { alergenos: DEFAULT_ALERGENOS, partidas: DEFAULT_PARTIDAS, menaje: DEFAULT_MENAJE, recomendaciones: DEFAULT_RECOMENDACIONES };
  const empresaConfig = configs[empresaActual.id] ?? defaultConfig;

  const [view, setView] = useState<"lista" | "pipeline">("lista");
  const [tab, setTab] = useState("fichas");
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [detalleFicha, setDetalleFicha] = useState<FichaTecnica | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = empresaFichas;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((f) => f.nombre.toLowerCase().includes(s) || f.responsable.toLowerCase().includes(s));
    }
    if (filtroCategoria !== "todas") list = list.filter((f) => f.categoriaId === filtroCategoria);
    if (filtroEstado !== "todos") list = list.filter((f) => f.estado === filtroEstado);
    return list;
  }, [empresaFichas, search, filtroCategoria, filtroEstado]);

  const openDetail = (f: FichaTecnica) => { setDetalleFicha(f); setDetalleOpen(true); };

  const openNew = () => {
    const cat = empresaCats.find((c) => c.activa)?.id ?? "cat-1";
    const nueva = { ...crearFichaVacia(empresaActual.id, cat), id: `ft-new-${Date.now()}` };
    setDetalleFicha(nueva);
    setDetalleOpen(true);
  };

  const handleSave = useCallback(async (f: FichaTecnica) => {
    const isNew = f.id.startsWith("ft-new");
    // Optimistic update
    setFichas((prev) => {
      const list = prev[empresaActual.id] ?? [];
      const exists = list.find((x) => x.id === f.id);
      const updated = exists ? list.map((x) => x.id === f.id ? f : x) : [...list, { ...f, id: isNew ? `ft-${Date.now()}` : f.id }];
      return { ...prev, [empresaActual.id]: updated };
    });
    // Re-register share if enabled
    if (f.shareEnabled && f.shareToken) {
      const catNombre = empresaCats.find((c) => c.id === f.categoriaId)?.nombre || "";
      registerSharedFicha(f, catNombre);
    }
    // Persist to server
    try {
      if (isNew) {
        const res = await createFicha({
          nombre: f.nombre,
          categoria: f.categoriaId,
          raciones: undefined,
          tiempo_elaboracion: undefined,
          notas: f.elaboracion || undefined,
          ingredientes: f.ingredientes.map((i) => ({
            producto_nombre: i.ingrediente,
            cantidad: i.cantidad,
            unidad: i.unidad,
            coste: 0,
          })),
        });
        if (!res.ok) { toast.error("Error al crear ficha en servidor"); loadFichas(); }
      } else {
        const res = await updateFicha(f.id, {
          nombre: f.nombre,
          categoria: f.categoriaId,
          notas: f.elaboracion || undefined,
        });
        if (!res.ok) { toast.error("Error al actualizar ficha en servidor"); loadFichas(); }
      }
    } catch {
      toast.error("Error de conexión al guardar ficha");
      loadFichas();
    }
  }, [empresaActual.id, empresaCats, loadFichas]);

  const duplicar = (f: FichaTecnica) => {
    const copia: FichaTecnica = { ...f, id: `ft-${Date.now()}`, nombre: `${f.nombre} (copia)`, estado: "borrador", fechaCreacion: new Date().toISOString().slice(0, 10), fechaActualizacion: new Date().toISOString().slice(0, 10), shareToken: undefined, shareEnabled: false, foto: f.foto };
    setFichas((prev) => ({ ...prev, [empresaActual.id]: [...(prev[empresaActual.id] ?? []), copia] }));
    toast.success("Ficha duplicada");
  };

  const archivar = async (id: string) => {
    setFichas((prev) => ({ ...prev, [empresaActual.id]: (prev[empresaActual.id] ?? []).map((f) => f.id === id ? { ...f, estado: "archivada" as EstadoFicha } : f) }));
    toast.success("Ficha archivada");
    try {
      const res = await updateFicha(id, { nombre: undefined });
      if (!res.ok) loadFichas();
    } catch { loadFichas(); }
  };

  const handleCatChange = (cats: CategoriaFicha[]) => {
    setCategorias((prev) => ({ ...prev, [empresaActual.id]: cats }));
  };

  const handleConfigChange = (cfg: ConfigFichas) => {
    setConfigs((prev) => ({ ...prev, [empresaActual.id]: cfg }));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.id)));
  };

  const handleMassPrint = () => {
    if (selected.size === 0) { toast.info("Selecciona al menos una ficha"); return; }
    toast.success(`Preparando impresión de ${selected.size} ficha(s)…`);
    window.print();
  };

  const handleMassExport = () => {
    if (selected.size === 0) { toast.info("Selecciona al menos una ficha"); return; }
    // Generate a simple text export (in a real app this would be PDF)
    const selectedFichas = empresaFichas.filter((f) => selected.has(f.id));
    const content = selectedFichas.map((f) => {
      const cat = empresaCats.find((c) => c.id === f.categoriaId);
      return [
        `═══ ${f.nombre} ═══`,
        `Categoría: ${cat?.nombre || "—"}`,
        `PVP: ${f.pvp.toFixed(2)}€ | Coste: ${f.costeTotal.toFixed(2)}€ | Margen: ${calcularMargen(f.pvp, f.costeTotal)}%`,
        `Ingredientes: ${f.ingredientes.map((i) => `${i.ingrediente} (${i.cantidad}${i.unidad})`).join(", ")}`,
        `Elaboración: ${f.elaboracion}`,
        f.guarnicion ? `Guarnición: ${f.guarnicion}` : "",
        f.decoracion ? `Decoración: ${f.decoracion}` : "",
        f.menaje ? `Menaje: ${f.menaje}` : "",
        f.alergenos.length ? `Alérgenos: ${f.alergenos.join(", ")}` : "",
        "",
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fichas-tecnicas-${empresaActual.id}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Dossier exportado con ${selected.size} ficha(s)`);
  };

  const activeCats = empresaCats.filter((c) => c.activa).sort((a, b) => a.orden - b.orden);

  // Stats
  const totalActivas = empresaFichas.filter((f) => f.estado === "activa").length;
  const costeMedio = empresaFichas.length > 0 ? (empresaFichas.reduce((s, f) => s + f.costeTotal, 0) / empresaFichas.length).toFixed(2) : "0.00";
  const pvpMedio = empresaFichas.length > 0 ? (empresaFichas.reduce((s, f) => s + f.pvp, 0) / empresaFichas.length).toFixed(2) : "0.00";
  const margenMedio = empresaFichas.length > 0 ? Math.round(empresaFichas.reduce((s, f) => s + calcularMargen(f.pvp, f.costeTotal), 0) / empresaFichas.length) : 0;

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando fichas técnicas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-end">
        <Button className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nueva ficha
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{empresaFichas.length}</p>
          <p className="text-xs text-muted-foreground">Total fichas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalActivas}</p>
          <p className="text-xs text-muted-foreground">Activas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{costeMedio}€ / {pvpMedio}€</p>
          <p className="text-xs text-muted-foreground">Coste / PVP medio</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{margenMedio}%</p>
          <p className="text-xs text-muted-foreground">Margen medio</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-9">
            <TabsTrigger value="fichas" className="text-xs gap-1"><ChefHat className="h-3.5 w-3.5" /> Fichas</TabsTrigger>
            <TabsTrigger value="config" className="text-xs gap-1"><Settings className="h-3.5 w-3.5" /> Configuración</TabsTrigger>
          </TabsList>
          {tab === "fichas" && (
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button variant={view === "lista" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setView("lista")}>
                <List className="h-3.5 w-3.5" /> Lista
              </Button>
              <Button variant={view === "pipeline" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setView("pipeline")}>
                <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="fichas" className="space-y-4 mt-4">
          {/* Filters + mass actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar ficha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {activeCats.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(ESTADO_FICHA_LABELS) as EstadoFicha[]).map((e) => (
                  <SelectItem key={e} value={e}>{ESTADO_FICHA_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <div className="flex gap-1.5 ml-auto">
                <Button size="sm" variant="outline" className="gap-1 text-xs h-9" onClick={handleMassPrint}>
                  <Printer className="h-3.5 w-3.5" /> Imprimir ({selected.size})
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs h-9" onClick={handleMassExport}>
                  <FileDown className="h-3.5 w-3.5" /> Exportar dossier ({selected.size})
                </Button>
              </div>
            )}
          </div>

          {/* List View */}
          {view === "lista" && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="text-xs w-12" />
                    <TableHead className="text-xs min-w-[200px]">Ficha técnica</TableHead>
                    <TableHead className="text-xs">Categoría</TableHead>
                    <TableHead className="text-xs text-right">Coste</TableHead>
                    <TableHead className="text-xs text-right">PVP</TableHead>
                    <TableHead className="text-xs text-right">Margen</TableHead>
                    <TableHead className="text-xs text-center">Estado</TableHead>
                    <TableHead className="text-xs">Actualización</TableHead>
                    <TableHead className="text-xs">Creador</TableHead>
                    <TableHead className="text-xs w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No se encontraron fichas técnicas.</TableCell></TableRow>
                  )}
                  {filtered.map((f) => {
                    const cat = empresaCats.find((c) => c.id === f.categoriaId);
                    const m = calcularMargen(f.pvp, f.costeTotal);
                    return (
                      <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(f)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggleSelect(f.id)} />
                        </TableCell>
                        <TableCell>
                          {f.foto ? (
                            <img src={f.foto} alt="" className="w-9 h-9 rounded object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded bg-muted/40 flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{f.nombre}</span>
                            {f.delicatessen && <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">★</Badge>}
                            {f.shareEnabled && <Link2 className="h-3 w-3 text-primary" />}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{cat?.nombre}</Badge></TableCell>
                        <TableCell className="text-right text-sm">{f.costeTotal.toFixed(2)}€</TableCell>
                        <TableCell className="text-right text-sm font-medium">{f.pvp.toFixed(2)}€</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-semibold ${m >= 60 ? "text-emerald-600" : m >= 40 ? "text-amber-600" : "text-destructive"}`}>{m}%</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-[10px] border ${ESTADO_COLORS[f.estado]}`}>{ESTADO_FICHA_LABELS[f.estado]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.fechaActualizacion}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.responsable}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicar(f)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => archivar(f.id)}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Pipeline View */}
          {view === "pipeline" && (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {activeCats.map((cat) => {
                const catFichas = filtered.filter((f) => f.categoriaId === cat.id);
                return (
                  <div key={cat.id} className="min-w-[260px] max-w-[280px] flex-shrink-0">
                    <div className="bg-muted/40 rounded-t-lg px-3 py-2 border border-b-0 border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground tracking-wide">{cat.nombre}</span>
                        <Badge variant="secondary" className="text-[10px]">{catFichas.length}</Badge>
                      </div>
                    </div>
                    <div className="border border-t-0 border-border rounded-b-lg p-2 space-y-2 min-h-[100px] bg-muted/10">
                      {catFichas.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">Sin fichas</p>
                      )}
                      {catFichas.map((f) => {
                        const m = calcularMargen(f.pvp, f.costeTotal);
                        return (
                          <Card key={f.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(f)}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                {f.foto && <img src={f.foto} alt="" className="w-8 h-8 rounded object-cover" />}
                                <span className="text-sm font-medium text-foreground truncate flex-1">{f.nombre}</span>
                                {f.delicatessen && <span className="text-amber-500 text-sm">★</span>}
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{f.costeTotal.toFixed(2)}€ → {f.pvp.toFixed(2)}€</span>
                                <span className={`font-semibold ${m >= 60 ? "text-emerald-600" : m >= 40 ? "text-amber-600" : "text-destructive"}`}>{m}%</span>
                              </div>
                              <Badge className={`text-[9px] border ${ESTADO_COLORS[f.estado]}`}>{ESTADO_FICHA_LABELS[f.estado]}</Badge>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ConfigPanel categorias={empresaCats} onCatChange={handleCatChange} config={empresaConfig} onConfigChange={handleConfigChange} />
        </TabsContent>
      </Tabs>

      {/* Detail modal */}
      <FichaDetalle
        ficha={detalleFicha} open={detalleOpen} onClose={() => setDetalleOpen(false)}
        categorias={empresaCats} onSave={handleSave} config={empresaConfig} empresaId={empresaActual.id}
      />
    </div>
  );
}
