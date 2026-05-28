"use client";

import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useTabQuery } from "@/shared/hooks/use-tab-query";
import { getRouteMeta } from "@/features/layout/data/nav-routes";
import {
  crearEscandalloVacio, calcularMargen,
  generateShareToken, registerSharedEscandallo, unregisterSharedEscandallo,
  type Escandallo, type CategoriaEscandallo, type EstadoEscandallo, type ConfigEscandallos,
  type IngredienteEscandallo, type PasoElaboracion,
  ESTADO_ESCANDALLO_LABELS, DEFAULT_ALERGENOS, DEFAULT_RECOMENDACIONES, DEFAULT_PARTIDAS, DEFAULT_MENAJE,
} from "@/features/cocina/data/escandallos";
import {
  listEscandallos, createEscandallo, updateEscandallo, deleteEscandallo,
  listEmpleadosCreadores,
} from "@/features/cocina/actions/escandallos-actions";
import { useEscandallosConfig, type EscandalloConfigItem, type GrupoCodigo } from "@/features/cocina/hooks/useEscandallosConfig";
import { listConfigItems } from "@/features/cocina/actions/escandallos-config-actions";
import { listPartidas } from "@/features/cocina/actions/partidas-actions";
import { listCategoriasProducto } from "@/features/logistica/actions/categorias-producto-actions";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import type { Producto } from "@/features/logistica/data/productos";
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
  Search, Plus, Settings, Euro, Percent,
  Copy, Archive, Trash2, GripVertical, Printer, Download,
  Share2, Link2, LinkIcon, ImageIcon, Upload, X, FileDown, Check,
  Video as VideoIcon, Pencil, ExternalLink,
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
          <TabsTrigger value="menaje" className="text-xs">Menaje</TabsTrigger>
          <TabsTrigger value="recomendaciones" className="text-xs">Recomendaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-4">
          <ConfigItemsEditor grupo="categorias" title="Categorías" uppercase showActiva onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="alergenos" className="mt-4">
          <ConfigItemsEditor grupo="alergenos" title="Alérgenos" onChanged={onChanged} />
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

// ─── Compact Photo Uploader (presentación, pasos) ─────────────
function FotoUploaderCompact({
  foto,
  onChange,
  label = "Foto",
}: {
  foto?: string;
  onChange: (url?: string) => void;
  label?: string;
}) {
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold text-muted-foreground">{label}</Label>
      {foto ? (
        <div className="relative w-[140px]">
          <img src={foto} alt={label} className="w-full aspect-video object-cover rounded border bg-muted" />
          <Button
            size="icon"
            variant="ghost"
            className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-background border"
            onClick={() => onChange(undefined)}
          >
            <X className="h-2.5 w-2.5 text-destructive" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-[140px] aspect-video rounded border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:border-primary/40 transition-colors">
          <ImageIcon className="h-4 w-4 text-muted-foreground/50 mb-0.5" />
          <span className="text-[10px] text-muted-foreground">Subir foto</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      )}
    </div>
  );
}

// ─── Video por URL (paso) ──────────────────────────────────────
// Mientras no haya storage interno, aceptamos cualquier URL pública:
// YouTube/Vimeo se incrustan; mp4/webm/mov directos se reproducen
// con <video>; lo demás abre en pestaña nueva.
function getYoutubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
function getVimeoEmbed(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : null;
}
function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(url);
}

function VideoUploaderCompact({ video, onChange }: { video?: string; onChange: (url?: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(video ?? "");

  const save = () => {
    const url = draft.trim();
    onChange(url || undefined);
    setEditing(false);
  };
  const startEdit = () => {
    setDraft(video ?? "");
    setEditing(true);
  };

  const showEditor = editing || !video;
  const embed = video ? (getYoutubeEmbed(video) ?? getVimeoEmbed(video)) : null;

  return (
    <div className="w-[140px] space-y-1">
      <Label className="text-[10px] font-bold text-muted-foreground">Vídeo (URL)</Label>

      {video && !editing && (
        <div className="relative w-[140px]">
          {embed ? (
            <iframe
              src={embed}
              title="Vídeo del paso"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full aspect-video rounded border bg-black"
            />
          ) : isDirectVideoUrl(video) ? (
            <video src={video} controls className="w-full aspect-video object-cover rounded border bg-black" />
          ) : (
            <a
              href={video}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center w-full aspect-video rounded border bg-muted/40 hover:bg-muted/60 transition-colors"
              title={video}
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Abrir vídeo</span>
            </a>
          )}
          <div className="absolute -top-1.5 -right-1.5 flex gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 bg-background border"
              onClick={startEdit}
              title="Cambiar URL"
            >
              <Pencil className="h-2.5 w-2.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 bg-background border"
              onClick={() => onChange(undefined)}
              title="Quitar vídeo"
            >
              <X className="h-2.5 w-2.5 text-destructive" />
            </Button>
          </div>
        </div>
      )}

      {showEditor && (
        <div className="w-[140px] space-y-1">
          {!video && (
            <div className="flex flex-col items-center justify-center w-full aspect-video rounded border-2 border-dashed border-border bg-muted/20">
              <VideoIcon className="h-4 w-4 text-muted-foreground/50 mb-0.5" />
              <span className="text-[9px] text-muted-foreground">Pega la URL</span>
            </div>
          )}
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://…"
            className="h-7 text-[11px]"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-[10px] flex-1" onClick={save}>
              Guardar
            </Button>
            {editing && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail / Edit Dialog ──────────────────────────────────────
function EscandalloDetalle({
  escandallo, open, onClose, categorias, onSave, config, empleados,
}: {
  escandallo: Escandallo | null; open: boolean; onClose: () => void;
  categorias: CategoriaEscandallo[]; onSave: (f: Escandallo) => void;
  config: ConfigEscandallos;
  empleados: { id: string; nombre: string; apellidos: string }[];
}) {
  const pathname = usePathname();
  const routeMeta = useMemo(() => getRouteMeta(pathname || "/cocina/escandallos"), [pathname]);
  const MenuIcon = routeMeta.icon;
  const singular = routeMeta.title.replace(/S$/, "");
  const [form, setForm] = useState<Escandallo | null>(null);
  const [productosDisponibles, setProductosDisponibles] = useState<Producto[]>([]);
  useMemo(() => {
    if (!escandallo) return;
    const inicial: Escandallo = { ...escandallo };
    // Si no hay pasos pero sí texto legacy, lo migramos a un único paso.
    if ((!inicial.pasos || inicial.pasos.length === 0) && inicial.elaboracion?.trim()) {
      inicial.pasos = [{
        id: `p-${Date.now()}`,
        titulo: "Receta",
        instrucciones: inicial.elaboracion,
      }];
    }
    setForm(inicial);
  }, [escandallo]);

  // Cargar productos (compra + elaboración, excluyendo venta) cuando se abre el diálogo.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const all = await listProductos();
      if (cancelled) return;
      const elegibles = all.filter((p) => p.tipo !== "venta" && p.estado === "Activo");
      setProductosDisponibles(elegibles);
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!form) return null;

  // Si el responsable guardado ya no figura entre los empleados activos
  // (empleado dado de baja o eliminado), lo conservamos como entrada
  // histórica para que su nombre nunca desaparezca del registro.
  const empleadosOpciones = empleados.map((e) => `${e.nombre} ${e.apellidos}`);
  const responsableHuerfano = form.responsable && !empleadosOpciones.includes(form.responsable)
    ? form.responsable
    : null;

  const margen = calcularMargen(form.pvp, form.costeTotal);
  const costePct = form.pvp > 0 ? ((form.costeTotal / form.pvp) * 100).toFixed(2) : "0.00";

  const productosMenaje = productosDisponibles.filter(
    (p) => p.tipo === "compra" && p.categoria.trim().toLowerCase() === "menaje",
  );

  // Alérgenos derivados automáticamente desde los ingredientes vinculados.
  // Por cada alérgeno guardamos la lista de orígenes (ingrediente + tipo compra/elaboracion)
  // para mostrar trazabilidad en la UI. Los manuales (form.alergenos) que NO provienen de
  // ningún ingrediente se exponen aparte como "extras" (contaminación cruzada, etc.).
  const alergenosOrigen = new Map<string, { nombre: string; tipo?: string }[]>();
  for (const ing of form.ingredientes) {
    const lista = ing.alergenos ?? [];
    for (const a of lista) {
      const arr = alergenosOrigen.get(a) ?? [];
      if (!arr.some((o) => o.nombre === ing.ingrediente)) {
        arr.push({ nombre: ing.ingrediente, tipo: ing.tipo });
      }
      alergenosOrigen.set(a, arr);
    }
  }
  const alergenosDerivados = Array.from(alergenosOrigen.entries())
    .map(([alergeno, origenes]) => ({ alergeno, origenes }))
    .sort((a, b) => a.alergeno.localeCompare(b.alergeno));
  const alergenosDerivadosSet = new Set(alergenosOrigen.keys());
  const alergenosExtra = (form.alergenos ?? []).filter((a) => !alergenosDerivadosSet.has(a));

  const update = (partial: Partial<Escandallo>) => setForm((prev) => prev ? { ...prev, ...partial } : prev);
  const toggleArray = (arr: string[], item: string) => arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const calcularPrecio = (producto: Producto, cantidad: number): number => {
    const raw = producto.coste ?? producto.precioCompra ?? "0";
    const num = parseFloat(String(raw).replace(/[^0-9,\.]/g, "").replace(",", "."));
    if (!Number.isFinite(num)) return 0;
    return +(num * cantidad).toFixed(2);
  };

  const recomputeCosteTotal = (ingredientes: IngredienteEscandallo[]): number => {
    const total = ingredientes.reduce((sum, i) => sum + (i.precio ?? 0), 0);
    return +total.toFixed(2);
  };

  const addIngrediente = () => {
    const nuevos = [...form.ingredientes, { id: `i-${Date.now()}`, ingrediente: "", unidad: "", cantidad: 0 }];
    update({ ingredientes: nuevos, costeTotal: recomputeCosteTotal(nuevos) });
  };
  const removeIngrediente = (id: string) => {
    const nuevos = form.ingredientes.filter((i) => i.id !== id);
    update({ ingredientes: nuevos, costeTotal: recomputeCosteTotal(nuevos) });
  };

  // Selección estricta: solo se permite elegir un producto del catálogo
  // (compra o elaboración). Texto libre prohibido — si productoId queda
  // vacío, el ingrediente se reinicia. Al seleccionar, hidratamos
  // automáticamente unidad y formato desde el producto.
  const handleIngredienteProducto = (id: string, productoId: string) => {
    const producto = productosDisponibles.find((p) => p.id === productoId);
    const nuevos = form.ingredientes.map((i) => {
      if (i.id !== id) return i;
      if (!producto) {
        return { ...i, ingrediente: "", tipo: undefined, productoId: undefined, unidad: "", formato: undefined, precio: 0 };
      }
      const cantidad = i.cantidad > 0 ? i.cantidad : 1;
      return {
        ...i,
        ingrediente: producto.nombre,
        tipo: producto.tipo === "elaboracion" ? "elaboracion" as const : "compra" as const,
        productoId: producto.id,
        unidad: producto.unidad,
        formato: producto.formato ?? "",
        cantidad,
        precio: calcularPrecio(producto, cantidad),
      };
    });
    update({ ingredientes: nuevos, costeTotal: recomputeCosteTotal(nuevos) });
  };

  const handleIngredienteCantidad = (id: string, cantidad: number) => {
    const nuevos = form.ingredientes.map((i) => {
      if (i.id !== id) return i;
      const producto = i.productoId ? productosDisponibles.find((p) => p.id === i.productoId) : undefined;
      const precio = producto ? calcularPrecio(producto, cantidad) : 0;
      return { ...i, cantidad, precio };
    });
    update({ ingredientes: nuevos, costeTotal: recomputeCosteTotal(nuevos) });
  };

  // ─── Pasos de elaboración ──────────────────────────────────
  const pasos: PasoElaboracion[] = form.pasos ?? [];

  const addPaso = () => {
    update({ pasos: [...pasos, { id: `p-${Date.now()}`, titulo: "", instrucciones: "" }] });
  };
  const updatePaso = (id: string, partial: Partial<PasoElaboracion>) => {
    update({ pasos: pasos.map((p) => (p.id === id ? { ...p, ...partial } : p)) });
  };
  const removePaso = (id: string) => {
    update({ pasos: pasos.filter((p) => p.id !== id) });
  };
  const movePaso = (id: string, dir: -1 | 1) => {
    const idx = pasos.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const nuevoIdx = idx + dir;
    if (nuevoIdx < 0 || nuevoIdx >= pasos.length) return;
    const copia = [...pasos];
    [copia[idx], copia[nuevoIdx]] = [copia[nuevoIdx], copia[idx]];
    update({ pasos: copia });
  };

  const camposBasicosOk = !!form.nombre.trim() && !!form.categoriaId;

  const handleSave = () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!form.categoriaId) { toast.error("Selecciona una categoría"); return; }
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
                  {MenuIcon && <MenuIcon className="h-5 w-5 text-primary" />}
                  {form.id.startsWith("ft-new") ? `NUEVO ${singular}` : `EDITAR ${singular}`}
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
                        {responsableHuerfano && (
                          <SelectItem key="huerfano" value={responsableHuerfano}>
                            {responsableHuerfano} (histórico)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </section>

            {/* Ingredientes (productos de compra + elaboraciones) */}
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
                      <TableHead className="text-xs w-28">Tipo</TableHead>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs w-20">Unidad</TableHead>
                      <TableHead className="text-xs w-28">Formato</TableHead>
                      <TableHead className="text-xs w-24">Cantidad</TableHead>
                      <TableHead className="text-xs w-24 text-right">Precio</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.ingredientes.map((ing) => (
                      <TableRow key={ing.id}>
                        <TableCell>
                          {ing.tipo === "elaboracion" ? (
                            <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">ELABORACIÓN</Badge>
                          ) : ing.tipo === "compra" ? (
                            <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">PRODUCTO</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <select
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={ing.productoId ?? ""}
                            onChange={(e) => handleIngredienteProducto(ing.id, e.target.value)}
                          >
                            <option value="">Seleccionar producto…</option>
                            {productosDisponibles
                              .slice()
                              .sort((a, b) => {
                                if (a.tipo !== b.tipo) return a.tipo === "elaboracion" ? -1 : 1;
                                return a.nombre.localeCompare(b.nombre);
                              })
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.tipo === "elaboracion" ? "[ELAB] " : ""}{p.nombre}
                                  {p.unidad ? ` · ${p.unidad}` : ""}{p.formato ? ` · ${p.formato}` : ""}
                                </option>
                              ))}
                          </select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ing.unidad || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ing.formato || "—"}</TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-sm"
                            type="number"
                            step="0.01"
                            min="0"
                            value={ing.cantidad || ""}
                            onChange={(e) => handleIngredienteCantidad(ing.id, +e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {(ing.precio ?? 0).toFixed(2)}€
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
                  <Label className="text-xs">Decoración</Label>
                  <Input value={form.decoracion} onChange={(e) => update({ decoracion: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Menaje</Label>
                  <Select value={form.menaje} onValueChange={(v) => update({ menaje: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar menaje" /></SelectTrigger>
                    <SelectContent>
                      {productosMenaje.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Sin productos en la categoría "Menaje".
                        </div>
                      ) : (
                        productosMenaje.map((p) => (
                          <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pasos de la receta */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pasos de la receta</Label>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={addPaso}>
                    <Plus className="h-3 w-3" /> Añadir paso
                  </Button>
                </div>
                {pasos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin pasos. Divide la receta en partes (p. ej., <em>Bechamel</em>, <em>Empanado</em>, <em>Fritura</em>) para que cualquier jefe de cocina pueda seguirla.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pasos.map((paso, idx) => (
                      <Card key={paso.id} className="p-3">
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center pt-1.5 gap-1">
                            <Badge variant="secondary" className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </Badge>
                            <div className="flex flex-col gap-0.5">
                              <Button
                                variant="ghost" size="icon" className="h-5 w-5"
                                disabled={idx === 0}
                                onClick={() => movePaso(paso.id, -1)}
                                title="Subir"
                              >
                                <span className="text-xs">▲</span>
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-5 w-5"
                                disabled={idx === pasos.length - 1}
                                onClick={() => movePaso(paso.id, 1)}
                                title="Bajar"
                              >
                                <span className="text-xs">▼</span>
                              </Button>
                            </div>
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <Input
                              className="h-8 text-sm font-medium"
                              placeholder="Nombre del paso (p. ej., Bechamel)"
                              value={paso.titulo}
                              onChange={(e) => updatePaso(paso.id, { titulo: e.target.value })}
                            />
                            <Textarea
                              rows={3}
                              className="text-sm"
                              placeholder="Explicación detallada: temperaturas, tiempos, técnica…"
                              value={paso.instrucciones}
                              onChange={(e) => updatePaso(paso.id, { instrucciones: e.target.value })}
                            />
                          </div>
                          <VideoUploaderCompact
                            video={paso.videoUrl}
                            onChange={(url) => updatePaso(paso.id, { videoUrl: url })}
                          />
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => removePaso(paso.id)}
                            title="Eliminar paso"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Presentación en mesa */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Presentación en mesa</Label>
                <div className="flex gap-3 items-center">
                  <Textarea
                    rows={3}
                    className="flex-1 text-sm"
                    placeholder="Explica cómo se presenta el plato al comensal…"
                    value={form.presentacionMesa}
                    onChange={(e) => update({ presentacionMesa: e.target.value })}
                  />
                  <FotoUploaderCompact
                    foto={form.presentacionFoto}
                    onChange={(url) => update({ presentacionFoto: url })}
                    label="Emplatado"
                  />
                </div>
              </div>
            </section>

            {/* Alérgenos — DERIVADOS automáticamente desde los ingredientes vinculados (productos.alergenos).
                Cada badge indica de qué ingrediente(s) proviene el alérgeno. Los marcados manualmente
                aquí (no presentes en ningún ingrediente) se conservan como EXTRAS — útil para
                contaminación cruzada u observaciones de planta. */}
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide border-b pb-1">
                Alérgenos <span className="text-[10px] font-normal italic text-muted-foreground">— automáticos desde los ingredientes</span>
              </h4>
              {alergenosDerivados.length === 0 && alergenosExtra.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Sin alérgenos. Marca los alérgenos en los productos de compra usados como ingredientes para que aparezcan aquí.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {alergenosDerivados.map(({ alergeno, origenes }) => (
                    <Badge
                      key={alergeno}
                      variant="outline"
                      title={`Viene de: ${origenes.map((o) => `${o.nombre}${o.tipo ? ` (${o.tipo})` : ""}`).join(", ")}`}
                      className="text-xs bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/40 py-1 px-2.5"
                    >
                      <span className="font-semibold">{alergeno}</span>
                      <span className="ml-1.5 opacity-75">
                        · {origenes.map((o) => o.nombre).join(", ")}
                      </span>
                    </Badge>
                  ))}
                  {alergenosExtra.map((a) => (
                    <Badge
                      key={`extra-${a}`}
                      variant="outline"
                      title="Añadido manualmente (no proviene de un ingrediente vinculado)"
                      className="text-xs bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900/20 dark:text-zinc-200 dark:border-zinc-800/40 py-1 px-2.5"
                    >
                      <span className="font-semibold">{a}</span>
                      <span className="ml-1.5 opacity-75">· manual</span>
                      <button
                        type="button"
                        onClick={() => update({ alergenos: form.alergenos.filter((x) => x !== a) })}
                        className="ml-1.5 hover:text-destructive"
                        title="Quitar alérgeno manual"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

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
              <Button
                onClick={handleSave}
                disabled={!camposBasicosOk}
                title={camposBasicosOk ? undefined : "Indica nombre y categoría para guardar"}
              >
                Guardar escandallo
              </Button>
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
  const [empleados, setEmpleados] = useState<{ id: string; nombre: string; apellidos: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Helper: map DB row → Escandallo ---
  const mapDbToEscandallo = useCallback((row: Record<string, unknown>): Escandallo => {
    const estadoDb = String(row.estado ?? "Borrador").toLowerCase();
    const estado = (["activa", "borrador", "archivada"].includes(estadoDb) ? estadoDb : "borrador") as EstadoEscandallo;

    const rawIngredientes = Array.isArray(row.ingredientes) ? row.ingredientes : [];
    const ingredientes: IngredienteEscandallo[] = (rawIngredientes as Array<Record<string, unknown>>).map((r) => {
      const prod = r.productos as { alergenos?: string[] } | null;
      return {
        id: (r.id as string) ?? `i-${Math.random().toString(36).slice(2)}`,
        ingrediente: (r.nombre as string) ?? "",
        unidad: (r.unidad as string) ?? "",
        cantidad: Number(r.cantidad ?? 0),
        tipo: (r.tipo as "compra" | "elaboracion" | null) ?? undefined,
        productoId: (r.producto_id as string) ?? undefined,
        formato: (r.formato as string) ?? undefined,
        precio: r.coste_total != null ? Number(r.coste_total) : undefined,
        alergenos: Array.isArray(prod?.alergenos) ? prod!.alergenos! : [],
      };
    });

    return {
      id: row.id as string,
      nombre: (row.nombre as string) ?? "",
      categoriaId: (row.categoria as string) ?? "",
      estado,
      responsable: (row.responsable as string) ?? (row.created_by as string) ?? "",
      fechaCreacion: (row.created_at as string)?.slice(0, 10) ?? "",
      fechaActualizacion: (row.updated_at as string)?.slice(0, 10) ?? "",
      foto: (row.foto_url as string) ?? undefined,
      delicatessen: (row.delicatessen as boolean) ?? false,
      ingredientes,
      elaboracion: (row.elaboracion as string) ?? "",
      pasos: Array.isArray(row.pasos) ? (row.pasos as PasoElaboracion[]) : undefined,
      partida: (row.partida as string) ?? "",
      guarnicion: (row.guarnicion as string) ?? "",
      decoracion: (row.decoracion as string) ?? "",
      menaje: (row.menaje as string) ?? "",
      presentacionMesa: (row.presentacion_mesa as string) ?? "",
      presentacionFoto: (row.presentacion_foto as string) ?? undefined,
      alergenos: Array.isArray(row.alergenos) ? (row.alergenos as string[]) : [],
      recomendaciones: Array.isArray(row.recomendaciones) ? (row.recomendaciones as string[]) : [],
      costeTotal: Number(row.coste_total ?? 0),
      pvp: Number(row.pvp ?? 0),
      desglose: [],
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

  // --- Load config (categorias + alergenos/menaje/recomendaciones + partidas desde submódulo Partidas) ---
  const loadConfig = useCallback(async () => {
    try {
      const [cats, alg, par, men, rec] = await Promise.all([
        listCategoriasProducto("venta"),
        listConfigItems("alergenos"),
        listPartidas(),
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
        partidas: (par.data ?? []).filter((p) => p.estado === "activa").map((p) => p.nombre),
        menaje: (men.data ?? []).filter((i) => i.activa).map((i) => i.nombre),
        recomendaciones: (rec.data ?? []).filter((i) => i.activa).map((i) => i.nombre),
      };
      setConfigs((prev) => ({ ...prev, [empresaActual.id]: cfg }));
    } catch (err) {
      console.error("[escandallos] loadConfig:", err);
      toast.error("Error al cargar la configuración");
    }
  }, [empresaActual.id]);

  // --- Load empleados activos (selector "Creador") ---
  const loadEmpleados = useCallback(async () => {
    try {
      const res = await listEmpleadosCreadores();
      if (res.ok) setEmpleados(res.data);
    } catch (err) {
      console.error("[escandallos] loadEmpleados:", err);
    }
  }, []);

  useEffect(() => {
    loadEscandallos();
    loadConfig();
    loadEmpleados();
  }, [loadEscandallos, loadConfig, loadEmpleados]);

  const empresaEscandallos = escandallos[empresaActual.id] ?? [];
  const empresaCats = categorias[empresaActual.id] ?? [];
  const defaultConfig: ConfigEscandallos = { alergenos: DEFAULT_ALERGENOS, partidas: DEFAULT_PARTIDAS, menaje: DEFAULT_MENAJE, recomendaciones: DEFAULT_RECOMENDACIONES };
  const empresaConfig = configs[empresaActual.id] ?? defaultConfig;

  const view = "lista" as "lista" | "pipeline";
  const [tab, setTab] = useTabQuery(["escandallos", "config"] as const, "escandallos");
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
    // Una sola ficha: abrimos el editor completo con el escandallo en blanco.
    // El botón "Guardar" del propio editor queda bloqueado hasta que nombre +
    // categoría estén rellenos (regla "no datos a medias").
    const catDefault = empresaCats.find((c) => c.activa)?.id ?? "";
    const nueva: Escandallo = {
      ...crearEscandalloVacio(empresaActual.id, catDefault),
      id: `ft-new-${Date.now()}`,
      estado: "borrador",
    };
    setDetalleEscandallo(nueva);
    setDetalleOpen(true);
  };

  // Convierte el modelo del cliente al input que esperan las actions.
  const toEscandalloInput = useCallback((f: Escandallo) => ({
    nombre: f.nombre,
    categoria: f.categoriaId || null,
    estado: f.estado,
    partida: f.partida || null,
    elaboracion: f.elaboracion || null,
    guarnicion: f.guarnicion || null,
    decoracion: f.decoracion || null,
    menaje: f.menaje || null,
    presentacionMesa: f.presentacionMesa || null,
    presentacionFoto: f.presentacionFoto ?? null,
    pasos: f.pasos ?? [],
    alergenos: f.alergenos ?? [],
    recomendaciones: f.recomendaciones ?? [],
    delicatessen: !!f.delicatessen,
    costeTotal: f.costeTotal ?? 0,
    pvp: f.pvp ?? 0,
    margenPct: calcularMargen(f.pvp, f.costeTotal),
    fotoUrl: f.foto ?? null,
    responsable: f.responsable || null,
    shareToken: f.shareToken ?? null,
    shareEnabled: !!f.shareEnabled,
    ingredientes: f.ingredientes.map((i) => ({
      productoId: i.productoId,
      nombre: i.ingrediente,
      cantidad: i.cantidad,
      unidad: i.unidad,
      tipo: i.tipo,
      formato: i.formato,
      precio: i.precio,
    })),
  }), []);

  const handleSave = useCallback(async (f: Escandallo) => {
    const isNew = f.id.startsWith("ft-new");
    const payload = toEscandalloInput(f);
    try {
      if (isNew) {
        const res = await createEscandallo(payload);
        if (!res.ok) {
          toast.error("Error al crear escandallo en servidor");
          loadEscandallos();
          return;
        }
      } else {
        const res = await updateEscandallo(f.id, payload);
        if (!res.ok) {
          toast.error("Error al actualizar escandallo en servidor");
          loadEscandallos();
          return;
        }
      }
      if (f.shareEnabled && f.shareToken) {
        const catNombre = empresaCats.find((c) => c.id === f.categoriaId)?.nombre || "";
        registerSharedEscandallo(f, catNombre);
      }
      // Recargamos para tener el id real (BD) y los ingredientes ya con id de fila.
      loadEscandallos();
    } catch {
      toast.error("Error de conexión al guardar escandallo");
      loadEscandallos();
    }
  }, [empresaCats, loadEscandallos, toEscandalloInput]);

  const duplicar = async (f: Escandallo) => {
    const copia: Escandallo = {
      ...f,
      id: `ft-new-${Date.now()}`,
      nombre: `${f.nombre} (copia)`,
      estado: "borrador",
      fechaCreacion: new Date().toISOString().slice(0, 10),
      fechaActualizacion: new Date().toISOString().slice(0, 10),
      shareToken: undefined,
      shareEnabled: false,
    };
    const payload = toEscandalloInput(copia);
    const res = await createEscandallo(payload);
    if (res.ok) {
      toast.success("Escandallo duplicado");
      loadEscandallos();
    } else {
      toast.error("No se pudo duplicar el escandallo");
    }
  };

  const archivar = async (id: string) => {
    const actual = (escandallos[empresaActual.id] ?? []).find((f) => f.id === id);
    if (!actual) return;
    const payload = toEscandalloInput({ ...actual, estado: "archivada" });
    const res = await updateEscandallo(id, payload);
    if (res.ok) {
      toast.success("Escandallo archivado");
      loadEscandallos();
    } else {
      toast.error("No se pudo archivar el escandallo");
    }
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

  if (loading) {
    return <LoadingSpinner className="p-4 md:p-6 min-h-[300px]" size="lg" />;
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "escandallo", label: "Escandallo", bloqueada: true },
    { campo: "categoria", label: "Categoría" },
    { campo: "ingredientes", label: "Ingredientes" },
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
    ingredientes: {
      th: <TableHead key="ingredientes" className="text-xs text-center">Ingredientes</TableHead>,
      td: (f) => {
        const n = f.ingredientes?.length ?? 0;
        return (
          <TableCell key="ingredientes" className="text-center">
            {n === 0 ? (
              <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 border">PENDIENTE</Badge>
            ) : (
              <span className="text-sm font-medium text-foreground">{n}</span>
            )}
          </TableCell>
        );
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as "escandallos" | "config")}>
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
        categorias={empresaCats} onSave={handleSave} config={empresaConfig} empleados={empleados}
      />

    </div>
  );
}
