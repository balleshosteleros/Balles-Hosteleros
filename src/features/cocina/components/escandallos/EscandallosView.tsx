"use client";

import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  crearEscandalloVacio, calcularMargen,
  generateShareToken, registerSharedEscandallo, unregisterSharedEscandallo,
  type Escandallo, type CategoriaEscandallo, type EstadoEscandallo, type ConfigEscandallos,
  ESTADO_ESCANDALLO_LABELS, DEFAULT_ALERGENOS, DEFAULT_RECOMENDACIONES, DEFAULT_PARTIDAS, DEFAULT_MENAJE,
} from "@/features/cocina/data/escandallos";
import { getEmpleadosPorEmpresa } from "@/features/rrhh/data/rrhh";
import {
  listEscandallos, createEscandallo, updateEscandallo, deleteEscandallo,
} from "@/features/cocina/actions/escandallos-actions";
import { useEscandallosConfig, type EscandalloConfigItem, type GrupoCodigo } from "@/features/cocina/hooks/useEscandallosConfig";
import { listConfigItems } from "@/features/cocina/actions/escandallos-config-actions";
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
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
  type ToolbarFiltroActivo,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";

// ─── Estado colors ─────────────────────────────────────────────
const ESTADO_COLORS: Record<EstadoEscandallo, string> = {
  activa: "bg-emerald-100 text-emerald-700 border-emerald-200",
  borrador: "bg-amber-100 text-amber-700 border-amber-200",
  archivada: "bg-muted text-muted-foreground border-border",
};

// ─── Editor de items de configuración (Supabase) ───────────────
function ConfigItemsEditor({
  grupo,
  title,
  uppercase = false,
  showActiva = false,
  onChanged,
}: {
  grupo: GrupoCodigo;
  title: string;
  uppercase?: boolean;
  showActiva?: boolean;
  onChanged?: () => void;
}) {
  const { items, loading, create, update, remove } = useEscandallosConfig(grupo);
  const [nuevo, setNuevo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const fire = () => onChanged?.();

  const add = async () => {
    const val = nuevo.trim();
    if (!val) {
      toast.error("Escribe un nombre antes de añadir");
      return;
    }
    setSaving(true);
    try {
      const ok = await create({ nombre: uppercase ? val.toUpperCase() : val });
      if (ok) {
        setNuevo("");
        fire();
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (it: EscandalloConfigItem) => {
    setEditId(it.id);
    setEditVal(it.nombre);
  };

  const saveEdit = async () => {
    if (!editId) return;
    const val = editVal.trim();
    if (!val) return;
    const ok = await update(editId, { nombre: uppercase ? val.toUpperCase() : val });
    if (ok) {
      setEditId(null);
      setEditVal("");
      fire();
    }
  };

  const handleRemove = async (id: string) => {
    const ok = await remove(id);
    if (ok) fire();
  };

  const toggleActiva = async (it: EscandalloConfigItem) => {
    const ok = await update(it.id, { activa: !it.activa });
    if (ok) fire();
  };

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">{title}</h3>
      <div className="flex gap-2">
        <Input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder={`Escribe un nuevo ${title.toLowerCase().replace(/s$/, "")} y pulsa Añadir`}
          className="max-w-md h-9 text-sm"
          onKeyDown={(e) => e.key === "Enter" && add()}
          disabled={saving}
          autoFocus
        />
        <Button size="sm" onClick={add} className="gap-1 h-9 text-xs" disabled={saving}>
          <Plus className="h-4 w-4" /> {saving ? "Añadiendo…" : "Añadir"}
        </Button>
      </div>
      <div className="space-y-1 max-h-[320px] overflow-y-auto">
        {loading && items.length === 0 ? (
          <LoadingSpinner size="sm" className="py-2" />
        ) : items.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">Sin valores. Añade el primero.</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg border bg-card text-sm">
              {editId === it.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    className="h-7 text-sm flex-1"
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    autoFocus
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveEdit}>OK</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditId(null)}>✕</Button>
                </div>
              ) : (
                <>
                  <span className="text-foreground">{it.nombre}</span>
                  <div className="flex items-center gap-2">
                    {showActiva && (
                      <>
                        <Label className="text-xs text-muted-foreground">Activa</Label>
                        <Switch checked={it.activa} onCheckedChange={() => toggleActiva(it)} />
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(it)}>
                      <span className="text-xs">✎</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemove(it.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Config Panel ──────────────────────────────────────────────
function ConfigPanel({ onChanged }: { onChanged?: () => void }) {
  const [configTab, setConfigTab] = useState("categorias");

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

        <TabsContent value="categorias" className="mt-4">
          <ConfigItemsEditor grupo="categorias" title="Categorías" uppercase showActiva onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="alergenos" className="mt-4">
          <ConfigItemsEditor grupo="alergenos" title="Alérgenos" onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="partidas" className="mt-4">
          <ConfigItemsEditor grupo="partidas" title="Partidas" onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="menaje" className="mt-4">
          <ConfigItemsEditor grupo="menaje" title="Menaje" onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="recomendaciones" className="mt-4">
          <ConfigItemsEditor grupo="recomendaciones" title="Recomendaciones" onChanged={onChanged} />
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
function EscandalloDetalle({
  escandallo, open, onClose, categorias, onSave, config, empresaId,
}: {
  escandallo: Escandallo | null; open: boolean; onClose: () => void;
  categorias: CategoriaEscandallo[]; onSave: (f: Escandallo) => void;
  config: ConfigEscandallos; empresaId: string;
}) {
  const [form, setForm] = useState<Escandallo | null>(null);
  useMemo(() => { if (escandallo) setForm({ ...escandallo }); }, [escandallo]);
  if (!form) return null;

  const empleados = getEmpleadosPorEmpresa(empresaId);
  const margen = calcularMargen(form.pvp, form.costeTotal);
  const costePct = form.pvp > 0 ? ((form.costeTotal / form.pvp) * 100).toFixed(2) : "0.00";

  const update = (partial: Partial<Escandallo>) => setForm((prev) => prev ? { ...prev, ...partial } : prev);
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
    toast.success("Escandallo guardado correctamente");
    onClose();
  };

  const handlePrint = () => window.print();

  const handleShare = () => {
    const token = form.shareToken || generateShareToken();
    const catNombre = categorias.find((c) => c.id === form.categoriaId)?.nombre || "";
    const updated = { ...form, shareToken: token, shareEnabled: true };
    registerSharedEscandallo(updated, catNombre);
    update({ shareToken: token, shareEnabled: true });
    const url = `${window.location.origin}/escandallo-publico/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado al portapapeles");
  };

  const handleDisableShare = () => {
    if (form.shareToken) unregisterSharedEscandallo(form.shareToken);
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
                  {form.id.startsWith("ft-new") ? "Nueva escandallo" : "Editar escandallo"}
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
                    {window.location.origin}/escandallo-publico/{form.shareToken}
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/escandallo-publico/${form.shareToken}`);
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
                    <Select value={form.estado} onValueChange={(v) => update({ estado: v as EstadoEscandallo })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ESTADO_ESCANDALLO_LABELS) as EstadoEscandallo[]).map((e) => (
                          <SelectItem key={e} value={e}>{ESTADO_ESCANDALLO_LABELS[e]}</SelectItem>
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
                <p className="text-sm text-muted-foreground text-center py-4">Sin ingredientes. Pulsa &quot;Añadir&quot; para empezar.</p>
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
                    <p className="text-xs text-muted-foreground">Precio de Venta</p>
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
              <Button onClick={handleSave}>Guardar escandallo</Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export function EscandallosView() {
  const { empresaActual } = useEmpresa();

  const [escandallos, setEscandallos] = useState<Record<string, Escandallo[]>>({});
  const [categorias, setCategorias] = useState<Record<string, CategoriaEscandallo[]>>({});
  const [configs, setConfigs] = useState<Record<string, ConfigEscandallos>>({});
  const [loading, setLoading] = useState(true);

  // --- Helper: map DB row → Escandallo ---
  const mapDbToEscandallo = useCallback((row: Record<string, unknown>): Escandallo => {
    return {
      id: row.id as string,
      nombre: (row.nombre as string) ?? "",
      categoriaId: (row.categoria as string) ?? "",
      estado: ((row.estado as string) ?? "borrador") as EstadoEscandallo,
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

  // --- Load escandallos from server ---
  const loadEscandallos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEscandallos();
      if (res.ok) {
        const mapped = (res.data as Record<string, unknown>[]).map(mapDbToEscandallo);
        setEscandallos((prev) => ({ ...prev, [empresaActual.id]: mapped }));
      } else {
        toast.error("Error al cargar escandallos");
      }
    } catch {
      toast.error("Error de conexión al cargar escandallos");
    } finally {
      setLoading(false);
    }
  }, [empresaActual.id, mapDbToEscandallo]);

  // --- Load config (categorias + alergenos/partidas/menaje/recomendaciones) ---
  const loadConfig = useCallback(async () => {
    try {
      const [cats, alg, par, men, rec] = await Promise.all([
        listConfigItems("categorias"),
        listConfigItems("alergenos"),
        listConfigItems("partidas"),
        listConfigItems("menaje"),
        listConfigItems("recomendaciones"),
      ]);

      const mappedCats: CategoriaEscandallo[] = (cats.data ?? []).map((it) => ({
        id: it.id,
        nombre: it.nombre,
        orden: it.orden,
        activa: it.activa,
      }));
      setCategorias((prev) => ({ ...prev, [empresaActual.id]: mappedCats }));

      const cfg: ConfigEscandallos = {
        alergenos: (alg.data ?? []).filter((i) => i.activa).map((i) => i.nombre),
        partidas: (par.data ?? []).filter((i) => i.activa).map((i) => i.nombre),
        menaje: (men.data ?? []).filter((i) => i.activa).map((i) => i.nombre),
        recomendaciones: (rec.data ?? []).filter((i) => i.activa).map((i) => i.nombre),
      };
      setConfigs((prev) => ({ ...prev, [empresaActual.id]: cfg }));
    } catch (err) {
      console.error("[escandallos] loadConfig:", err);
      toast.error("Error al cargar la configuración");
    }
  }, [empresaActual.id]);

  useEffect(() => {
    loadEscandallos();
    loadConfig();
  }, [loadEscandallos, loadConfig]);

  const empresaEscandallos = escandallos[empresaActual.id] ?? [];
  const empresaCats = categorias[empresaActual.id] ?? [];
  const defaultConfig: ConfigEscandallos = { alergenos: DEFAULT_ALERGENOS, partidas: DEFAULT_PARTIDAS, menaje: DEFAULT_MENAJE, recomendaciones: DEFAULT_RECOMENDACIONES };
  const empresaConfig = configs[empresaActual.id] ?? defaultConfig;

  const [view, setView] = useState<"lista" | "pipeline">("lista");
  const [tab, setTab] = useState("escandallos");
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [detalleEscandallo, setDetalleEscandallo] = useState<Escandallo | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = empresaEscandallos;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((f) => f.nombre.toLowerCase().includes(s) || f.responsable.toLowerCase().includes(s));
    }
    list = aplicarFiltrosToolbar(list, filtros, (f, campo) => {
      if (campo === "categoria") return empresaCats.find((c) => c.id === f.categoriaId)?.nombre ?? "";
      if (campo === "estado") return ESTADO_ESCANDALLO_LABELS[f.estado];
      return (f as unknown as Record<string, unknown>)[campo];
    });
    return list;
  }, [empresaEscandallos, empresaCats, search, filtros]);

  const openDetail = (f: Escandallo) => { setDetalleEscandallo(f); setDetalleOpen(true); };

  const openNew = () => {
    const cat = empresaCats.find((c) => c.activa)?.id ?? "cat-1";
    const nueva = { ...crearEscandalloVacio(empresaActual.id, cat), id: `ft-new-${Date.now()}` };
    setDetalleEscandallo(nueva);
    setDetalleOpen(true);
  };

  const handleSave = useCallback(async (f: Escandallo) => {
    const isNew = f.id.startsWith("ft-new");
    // Optimistic update
    setEscandallos((prev) => {
      const list = prev[empresaActual.id] ?? [];
      const exists = list.find((x) => x.id === f.id);
      const updated = exists ? list.map((x) => x.id === f.id ? f : x) : [...list, { ...f, id: isNew ? `ft-${Date.now()}` : f.id }];
      return { ...prev, [empresaActual.id]: updated };
    });
    // Re-register share if enabled
    if (f.shareEnabled && f.shareToken) {
      const catNombre = empresaCats.find((c) => c.id === f.categoriaId)?.nombre || "";
      registerSharedEscandallo(f, catNombre);
    }
    // Persist to server
    try {
      if (isNew) {
        const res = await createEscandallo({
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
        if (!res.ok) { toast.error("Error al crear escandallo en servidor"); loadEscandallos(); }
      } else {
        const res = await updateEscandallo(f.id, {
          nombre: f.nombre,
          categoria: f.categoriaId,
          notas: f.elaboracion || undefined,
        });
        if (!res.ok) { toast.error("Error al actualizar escandallo en servidor"); loadEscandallos(); }
      }
    } catch {
      toast.error("Error de conexión al guardar escandallo");
      loadEscandallos();
    }
  }, [empresaActual.id, empresaCats, loadEscandallos]);

  const duplicar = (f: Escandallo) => {
    const copia: Escandallo = { ...f, id: `ft-${Date.now()}`, nombre: `${f.nombre} (copia)`, estado: "borrador", fechaCreacion: new Date().toISOString().slice(0, 10), fechaActualizacion: new Date().toISOString().slice(0, 10), shareToken: undefined, shareEnabled: false, foto: f.foto };
    setEscandallos((prev) => ({ ...prev, [empresaActual.id]: [...(prev[empresaActual.id] ?? []), copia] }));
    toast.success("Escandallo duplicado");
  };

  const archivar = async (id: string) => {
    setEscandallos((prev) => ({ ...prev, [empresaActual.id]: (prev[empresaActual.id] ?? []).map((f) => f.id === id ? { ...f, estado: "archivada" as EstadoEscandallo } : f) }));
    toast.success("Escandallo archivado");
    try {
      const res = await updateEscandallo(id, { nombre: undefined });
      if (!res.ok) loadEscandallos();
    } catch { loadEscandallos(); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.id)));
  };

  const handleMassPrint = () => {
    if (selected.size === 0) { toast.info("Selecciona al menos un escandallo"); return; }
    toast.success(`Preparando impresión de ${selected.size} escandallo(s)…`);
    window.print();
  };

  const handleMassExport = () => {
    if (selected.size === 0) { toast.info("Selecciona al menos un escandallo"); return; }
    // Generate a simple text export (in a real app this would be PDF)
    const selectedEscandallos = empresaEscandallos.filter((f) => selected.has(f.id));
    const content = selectedEscandallos.map((f) => {
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
    a.download = `escandallos-${empresaActual.id}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Dossier exportado con ${selected.size} escandallo(s)`);
  };

  const activeCats = empresaCats.filter((c) => c.activa).sort((a, b) => a.orden - b.orden);

  // Stats
  const totalActivas = empresaEscandallos.filter((f) => f.estado === "activa").length;
  const costeMedio = empresaEscandallos.length > 0 ? (empresaEscandallos.reduce((s, f) => s + f.costeTotal, 0) / empresaEscandallos.length).toFixed(2) : "0.00";
  const pvpMedio = empresaEscandallos.length > 0 ? (empresaEscandallos.reduce((s, f) => s + f.pvp, 0) / empresaEscandallos.length).toFixed(2) : "0.00";
  const margenMedio = empresaEscandallos.length > 0 ? Math.round(empresaEscandallos.reduce((s, f) => s + calcularMargen(f.pvp, f.costeTotal), 0) / empresaEscandallos.length) : 0;

  if (loading) {
    return <LoadingSpinner className="p-4 md:p-6 min-h-[300px]" size="lg" />;
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "escandallo", label: "Escandallo", bloqueada: true },
    { campo: "categoria", label: "Categoría" },
    { campo: "coste", label: "Coste" },
    { campo: "pvp", label: "Precio de Venta" },
    { campo: "margen", label: "Margen" },
    { campo: "estado", label: "Estado" },
    { campo: "actualizacion", label: "Actualización" },
    { campo: "creador", label: "Creador" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (f: Escandallo) => ReactNode }> = {
    escandallo: {
      th: <TableHead key="escandallo" className="text-xs min-w-[200px]">Escandallo</TableHead>,
      td: (f) => (
        <TableCell key="escandallo">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{f.nombre}</span>
            {f.delicatessen && <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">★</Badge>}
            {f.shareEnabled && <Link2 className="h-3 w-3 text-primary" />}
          </div>
        </TableCell>
      ),
    },
    categoria: {
      th: (
        <TableColumnHeader
          key="categoria"
          label="Categoría"
          campo="categoria"
          filtroTipo="lista"
          opciones={activeCats.map((c) => c.nombre)}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => {
        const cat = empresaCats.find((c) => c.id === f.categoriaId);
        return <TableCell key="categoria"><Badge variant="outline" className="text-[10px]">{cat?.nombre}</Badge></TableCell>;
      },
    },
    coste: {
      th: <TableHead key="coste" className="text-xs text-right">Coste</TableHead>,
      td: (f) => <TableCell key="coste" className="text-right text-sm">{f.costeTotal.toFixed(2)}€</TableCell>,
    },
    pvp: {
      th: <TableHead key="pvp" className="text-xs text-right">Precio de Venta</TableHead>,
      td: (f) => <TableCell key="pvp" className="text-right text-sm font-medium">{f.pvp.toFixed(2)}€</TableCell>,
    },
    margen: {
      th: <TableHead key="margen" className="text-xs text-right">Margen</TableHead>,
      td: (f) => {
        const m = calcularMargen(f.pvp, f.costeTotal);
        return (
          <TableCell key="margen" className="text-right">
            <span className={`text-sm font-semibold ${m >= 60 ? "text-emerald-600" : m >= 40 ? "text-amber-600" : "text-destructive"}`}>{m}%</span>
          </TableCell>
        );
      },
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          filtroTipo="lista"
          opciones={(Object.keys(ESTADO_ESCANDALLO_LABELS) as EstadoEscandallo[]).map((e) => ESTADO_ESCANDALLO_LABELS[e])}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (f) => (
        <TableCell key="estado" className="text-center">
          <Badge className={`text-[10px] border ${ESTADO_COLORS[f.estado]}`}>{ESTADO_ESCANDALLO_LABELS[f.estado]}</Badge>
        </TableCell>
      ),
    },
    actualizacion: {
      th: <TableHead key="actualizacion" className="text-xs">Actualización</TableHead>,
      td: (f) => <TableCell key="actualizacion" className="text-sm text-muted-foreground">{f.fechaActualizacion}</TableCell>,
    },
    creador: {
      th: <TableHead key="creador" className="text-xs">Creador</TableHead>,
      td: (f) => <TableCell key="creador" className="text-sm text-muted-foreground">{f.responsable}</TableCell>,
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Toolbar estándar (BARRA HORIZONTAL 1) */}
      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={openNew}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <Button
            size="icon"
            variant={tab === "config" ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setTab(tab === "config" ? "escandallos" : "config")}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      {/* Toggle vista (fuera de la toolbar) */}
      <div className="flex justify-end">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button variant={view === "lista" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setView("lista")}>
            <List className="h-3.5 w-3.5" /> Lista
          </Button>
          <Button variant={view === "pipeline" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setView("pipeline")}>
            <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{empresaEscandallos.length}</p>
          <p className="text-xs text-muted-foreground">Total escandallos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{totalActivas}</p>
          <p className="text-xs text-muted-foreground">Activas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{costeMedio}€ / {pvpMedio}€</p>
          <p className="text-xs text-muted-foreground">Coste / Precio de Venta medio</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{margenMedio}%</p>
          <p className="text-xs text-muted-foreground">Margen medio</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="escandallos" className="space-y-4 mt-4">
          {selected.size > 0 && (
            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="outline" className="gap-1 text-xs h-9" onClick={handleMassPrint}>
                <Printer className="h-3.5 w-3.5" /> Imprimir ({selected.size})
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-9" onClick={handleMassExport}>
                <FileDown className="h-3.5 w-3.5" /> Exportar dossier ({selected.size})
              </Button>
            </div>
          )}

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
                    {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                    <TableHead className="text-xs w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={20} className="text-center py-12 text-muted-foreground">No se encontraron escandallos.</TableCell></TableRow>
                  )}
                  {filtered.map((f) => (
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
                      {columnasRender.map((c) => columnDefs[c.campo]?.td(f))}
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
                  ))}
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
                        <p className="text-xs text-muted-foreground text-center py-6">Sin escandallos</p>
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
                              <Badge className={`text-[9px] border ${ESTADO_COLORS[f.estado]}`}>{ESTADO_ESCANDALLO_LABELS[f.estado]}</Badge>
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
          <ConfigPanel onChanged={loadConfig} />
        </TabsContent>
      </Tabs>

      {/* Detail modal */}
      <EscandalloDetalle
        escandallo={detalleEscandallo} open={detalleOpen} onClose={() => setDetalleOpen(false)}
        categorias={empresaCats} onSave={handleSave} config={empresaConfig} empresaId={empresaActual.id}
      />
    </div>
  );
}
