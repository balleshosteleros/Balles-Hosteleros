"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  calcularCosteElaboracion,
  CATEGORIAS_ELABORACION, ESTADO_ELABORACION_COLOR, ESTADO_ELABORACION_LABEL,
  type Elaboracion, type ProductoElaboracion, type EstadoElaboracion, type ComponenteElaboracion,
} from "@/features/logistica/data/elaboraciones";
import { type ProductoStock } from "@/features/logistica/data/stock";
import {
  listElaboraciones, createElaboracion, updateElaboracion, deleteElaboracion,
} from "@/features/cocina/actions/elaboraciones-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search, Plus, Eye, Pencil, Trash2, Check, ArrowLeft,
  ChevronDown, Package, AlertTriangle, Table2, LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";

const ALL = "__ALL__";

/* ════════════════════════════════════════════════════════════
   MODAL: CREAR / EDITAR ELABORACIÓN
   ════════════════════════════════════════════════════════════ */
function ElaboracionModal({
  open, onClose, onSave, productosElab, stockItems, productosElabList, existing,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (e: Elaboracion) => void;
  productosElab: ProductoElaboracion[];
  stockItems: ProductoStock[];
  productosElabList: ProductoElaboracion[];
  existing?: Elaboracion | null;
}) {
  const [nombre, setNombre] = useState(existing?.nombre || "");
  const [productoElabId, setProductoElabId] = useState(existing?.productoElaboracionId || "");
  const [fecha, setFecha] = useState(existing?.fecha || new Date().toISOString().slice(0, 10));
  const [cantidad, setCantidad] = useState(existing?.cantidadProducida?.toString() || "");
  const [unidad, setUnidad] = useState(existing?.unidad || "kg");
  const [almacen, setAlmacen] = useState<"COCINA" | "BARRA">(existing?.almacen || "COCINA");
  const [observaciones, setObservaciones] = useState(existing?.observaciones || "");
  const [componentes, setComponentes] = useState<ComponenteElaboracion[]>(existing?.componentes || []);

  // Add component
  const [addType, setAddType] = useState<"compra" | "elaboracion">("compra");
  const [addProdId, setAddProdId] = useState("");
  const [addCantidad, setAddCantidad] = useState("");

  const availableCompra = stockItems;
  const availableElab = productosElabList;

  const handleAddComponente = () => {
    if (!addProdId || !addCantidad) return;
    const cant = parseFloat(addCantidad);
    if (isNaN(cant) || cant <= 0) return;

    let nombre = "";
    let unidad = "";
    let coste = 0;
    if (addType === "compra") {
      const p = stockItems.find(s => s.id === addProdId);
      if (!p) return;
      nombre = p.nombre; unidad = p.unidad; coste = 0; // coste from productos would need linking
    } else {
      const p = productosElabList.find(e => e.id === addProdId);
      if (!p) return;
      nombre = p.nombre; unidad = p.unidad; coste = p.costeEstimado;
    }

    setComponentes(prev => [...prev, {
      productoId: addProdId, nombre, tipo: addType, cantidad: cant, unidad, costeUnitario: coste,
    }]);
    setAddProdId("");
    setAddCantidad("");
  };

  const removeComponente = (idx: number) => setComponentes(prev => prev.filter((_, i) => i !== idx));

  const handleSave = () => {
    if (!nombre.trim() || !productoElabId || !cantidad) {
      toast.error("Completa nombre, producto y cantidad");
      return;
    }
    const elab: Elaboracion = {
      id: existing?.id || `el-${Date.now()}`,
      nombre: nombre.trim(),
      productoElaboracionId: productoElabId,
      fecha,
      cantidadProducida: parseFloat(cantidad),
      unidad,
      componentes,
      estado: existing?.estado || "borrador",
      creador: existing?.creador || "Usuario actual",
      almacen,
      observaciones,
      empresaId: existing?.empresaId || "",
    };
    onSave(elab);
  };

  const costeTotal = calcularCosteElaboracion(componentes);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Editar elaboración" : "Nueva elaboración"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold">Nombre</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Salsa chimichurri" />
            </div>
            <div>
              <Label className="text-xs font-bold">Producto elaboración</Label>
              <Select value={productoElabId} onValueChange={setProductoElabId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {productosElab.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-xs font-bold">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-bold">Cantidad</Label>
              <Input type="number" step="0.01" value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-bold">Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["kg", "L", "ud", "bot", "caja", "pack"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Almacén</Label>
              <Select value={almacen} onValueChange={(v) => setAlmacen(v as "COCINA" | "BARRA")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COCINA">COCINA</SelectItem>
                  <SelectItem value="BARRA">BARRA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Componentes */}
          <div>
            <h4 className="text-sm font-bold text-foreground mb-2">COMPONENTES / INGREDIENTES</h4>
            {componentes.length > 0 && (
              <div className="bg-muted/30 rounded-lg border overflow-x-auto mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {["Producto", "Tipo", "Cantidad", "Unidad", "Coste unit.", ""].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {componentes.map((c, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2 font-medium text-foreground">{c.nombre}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">
                            {c.tipo === "compra" ? "Compra" : "Elaboración"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{c.cantidad}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.unidad}</td>
                        <td className="px-3 py-2">{c.costeUnitario.toFixed(2)} €</td>
                        <td className="px-3 py-2">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeComponente(i)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2 bg-card border rounded-lg p-3">
              <div>
                <Label className="text-[10px] font-bold">Tipo</Label>
                <Select value={addType} onValueChange={(v) => { setAddType(v as "compra" | "elaboracion"); setAddProdId(""); }}>
                  <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="elaboracion">Elaboración</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label className="text-[10px] font-bold">Producto</Label>
                <Select value={addProdId} onValueChange={setAddProdId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {addType === "compra"
                      ? availableCompra.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)
                      : availableElab.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20">
                <Label className="text-[10px] font-bold">Cantidad</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={addCantidad} onChange={e => setAddCantidad(e.target.value)} />
              </div>
              <Button size="sm" className="h-8 gap-1" onClick={handleAddComponente}>
                <Plus className="h-3 w-3" /> Añadir
              </Button>
            </div>
          </div>

          {costeTotal > 0 && (
            <div className="text-sm font-semibold text-foreground">
              Coste total estimado: <span className="text-primary">{costeTotal.toFixed(2)} €</span>
            </div>
          )}

          <div>
            <Label className="text-xs font-bold">Observaciones</Label>
            <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{existing ? "Guardar cambios" : "Crear elaboración"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════════════
   DETALLE DE ELABORACIÓN
   ════════════════════════════════════════════════════════════ */
function DetalleElaboracion({
  elaboracion, productosElab, onBack, onConfirm, onRevert, onEdit,
}: {
  elaboracion: Elaboracion;
  productosElab: ProductoElaboracion[];
  onBack: () => void;
  onConfirm: (id: string) => void;
  onRevert: (id: string) => void;
  onEdit: (e: Elaboracion) => void;
}) {
  const productoElab = productosElab.find(p => p.id === elaboracion.productoElaboracionId);
  const costeTotal = calcularCosteElaboracion(elaboracion.componentes);
  const isConfirmado = elaboracion.estado === "confirmado";
  const isArchivado = elaboracion.estado === "archivado";

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Volver al listado
      </Button>

      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">{elaboracion.nombre}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {elaboracion.fecha} · {elaboracion.almacen} · Creado por {elaboracion.creador}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`font-bold ${ESTADO_ELABORACION_COLOR[elaboracion.estado]}`}>
              {ESTADO_ELABORACION_LABEL[elaboracion.estado]}
            </Badge>
            {!isConfirmado && !isArchivado && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onEdit(elaboracion)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            )}
            {!isConfirmado && !isArchivado && (
              <Button size="sm" className="gap-1" onClick={() => onConfirm(elaboracion.id)}>
                <Check className="h-3.5 w-3.5" /> Confirmar
              </Button>
            )}
            {isConfirmado && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onRevert(elaboracion.id)}>
                Deshacer confirmación
              </Button>
            )}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium">PRODUCTO</p>
            <p className="text-sm font-semibold text-foreground">{productoElab?.nombre || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">CANTIDAD PRODUCIDA</p>
            <p className="text-sm font-semibold text-foreground">{elaboracion.cantidadProducida} {elaboracion.unidad}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">COSTE TOTAL</p>
            <p className="text-sm font-semibold text-primary">{costeTotal.toFixed(2)} €</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">COSTE UNITARIO</p>
            <p className="text-sm font-semibold text-foreground">
              {elaboracion.cantidadProducida > 0 ? (costeTotal / elaboracion.cantidadProducida).toFixed(2) : "0.00"} €/{elaboracion.unidad}
            </p>
          </div>
        </div>

        {elaboracion.observaciones && (
          <div>
            <p className="text-xs text-muted-foreground font-medium">OBSERVACIONES</p>
            <p className="text-sm text-foreground">{elaboracion.observaciones}</p>
          </div>
        )}
      </div>

      {/* Componentes */}
      <div className="bg-card border rounded-lg">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-bold text-foreground">COMPONENTES UTILIZADOS</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Producto", "Tipo", "Cantidad", "Unidad", "Coste unit.", "Coste total"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elaboracion.componentes.map((c, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium text-foreground">{c.nombre}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-[10px]">
                      {c.tipo === "compra" ? "Compra" : "Elaboración"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">{c.cantidad}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.unidad}</td>
                  <td className="px-4 py-2.5">{c.costeUnitario.toFixed(2)} €</td>
                  <td className="px-4 py-2.5 font-semibold">{(c.cantidad * c.costeUnitario).toFixed(2)} €</td>
                </tr>
              ))}
              {elaboracion.componentes.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin componentes registrados</td></tr>
              )}
            </tbody>
            {elaboracion.componentes.length > 0 && (
              <tfoot>
                <tr className="bg-muted/50">
                  <td colSpan={5} className="px-4 py-2.5 text-right text-xs font-bold text-muted-foreground">TOTAL</td>
                  <td className="px-4 py-2.5 font-bold text-primary">{costeTotal.toFixed(2)} €</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Trazabilidad */}
      {isConfirmado && (
        <div className="bg-card border rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground">TRAZABILIDAD DE STOCK</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">↓ CONSUMIDO (salida de stock)</p>
              {elaboracion.componentes.map((c, i) => (
                <p key={i} className="text-sm text-foreground">{c.nombre}: -{c.cantidad} {c.unidad}</p>
              ))}
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">↑ PRODUCIDO (entrada a stock)</p>
              <p className="text-sm text-foreground">{productoElab?.nombre || elaboracion.nombre}: +{elaboracion.cantidadProducida} {elaboracion.unidad}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ════════════════════════════════════════════════════════════ */
// --- Helper: map DB row → Elaboracion ---
function mapDbToElaboracion(row: Record<string, unknown>): Elaboracion {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? "",
    productoElaboracionId: (row.producto_elaboracion_id as string) ?? "",
    fecha: ((row.fecha as string) ?? (row.created_at as string))?.slice(0, 10) ?? "",
    cantidadProducida: (row.cantidad_producida as number) ?? 0,
    unidad: (row.unidad as string) ?? "kg",
    componentes: Array.isArray(row.componentes) ? row.componentes : [],
    estado: ((row.estado as string) ?? "borrador") as EstadoElaboracion,
    creador: (row.responsable as string) ?? (row.created_by as string) ?? "",
    almacen: ((row.almacen as string) ?? "COCINA") as "COCINA" | "BARRA",
    observaciones: (row.descripcion as string) ?? (row.observaciones as string) ?? "",
    empresaId: (row.empresa_id as string) ?? "",
  };
}

export function ElaboracionesView() {
  const { empresaActual } = useEmpresa();
  const [elaboraciones, setElaboraciones] = useState<Elaboracion[]>([]);
  const [productosElab, setProductosElab] = useState<ProductoElaboracion[]>([]);
  const [stock] = useState<ProductoStock[]>([]);
  const [loading, setLoading] = useState(true);

  const loadElaboraciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listElaboraciones();
      if (res.ok) {
        setElaboraciones((res.data as Record<string, unknown>[]).map(mapDbToElaboracion));
      } else {
        toast.error("Error al cargar elaboraciones");
      }
    } catch {
      toast.error("Error de conexión al cargar elaboraciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadElaboraciones();
  }, [loadElaboraciones]);

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState(ALL);
  const [filterAlmacen, setFilterAlmacen] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingElab, setEditingElab] = useState<Elaboracion | null>(null);
  const [vistaActiva, setVistaActiva] = useState<"tabla" | "pipeline">("tabla");

  const filtered = useMemo(() => {
    return elaboraciones.filter(e => {
      if (filterEstado !== ALL && e.estado !== filterEstado) return false;
      if (filterAlmacen !== ALL && e.almacen !== filterAlmacen) return false;
      if (search) {
        const s = search.toLowerCase();
        return e.nombre.toLowerCase().includes(s) || e.creador.toLowerCase().includes(s);
      }
      return true;
    });
  }, [elaboraciones, search, filterEstado, filterAlmacen]);

  const selectedElab = elaboraciones.find(e => e.id === selectedId) || null;

  // Stats
  const total = elaboraciones.length;
  const borradores = elaboraciones.filter(e => e.estado === "borrador").length;
  const confirmados = elaboraciones.filter(e => e.estado === "confirmado").length;

  const handleSave = async (elab: Elaboracion) => {
    elab.empresaId = empresaActual.id;
    const isNew = !editingElab;
    // Optimistic update
    if (editingElab) {
      setElaboraciones(prev => prev.map(e => e.id === elab.id ? elab : e));
      toast.success("Elaboración actualizada");
    } else {
      setElaboraciones(prev => [...prev, elab]);
      toast.success("Elaboración creada");
    }
    setModalOpen(false);
    setEditingElab(null);
    // Persist to server
    try {
      if (isNew) {
        const res = await createElaboracion({
          nombre: elab.nombre,
          tipo: elab.almacen,
          descripcion: elab.observaciones || undefined,
          responsable: elab.creador || undefined,
        });
        if (!res.ok) { toast.error("Error al crear elaboración en servidor"); loadElaboraciones(); }
      } else {
        const res = await updateElaboracion(elab.id, {
          nombre: elab.nombre,
          tipo: elab.almacen,
          descripcion: elab.observaciones || undefined,
          responsable: elab.creador || undefined,
          estado: elab.estado,
        });
        if (!res.ok) { toast.error("Error al actualizar elaboración en servidor"); loadElaboraciones(); }
      }
    } catch {
      toast.error("Error de conexión al guardar elaboración");
      loadElaboraciones();
    }
  };

  const handleConfirm = async (id: string) => {
    const elab = elaboraciones.find(e => e.id === id);
    if (!elab) return;
    if (elab.componentes.length === 0) {
      toast.error("Añade al menos un componente antes de confirmar");
      return;
    }
    // Update elaboracion stock
    setProductosElab(prev => prev.map(p => {
      if (p.id !== elab.productoElaboracionId) return p;
      return { ...p, stockActual: p.stockActual + elab.cantidadProducida };
    }));
    // Mark confirmed
    setElaboraciones(prev => prev.map(e => e.id === id ? { ...e, estado: "confirmado" as EstadoElaboracion } : e));
    toast.success("Elaboración confirmada — stock actualizado");
    try {
      const res = await updateElaboracion(id, { estado: "confirmado" });
      if (!res.ok) loadElaboraciones();
    } catch { loadElaboraciones(); }
  };

  const handleRevert = async (id: string) => {
    const elab = elaboraciones.find(e => e.id === id);
    if (!elab) return;
    // Revert stock
    setProductosElab(prev => prev.map(p => {
      if (p.id !== elab.productoElaboracionId) return p;
      return { ...p, stockActual: Math.max(0, p.stockActual - elab.cantidadProducida) };
    }));
    setElaboraciones(prev => prev.map(e => e.id === id ? { ...e, estado: "borrador" as EstadoElaboracion } : e));
    toast.info("Confirmación revertida");
    try {
      const res = await updateElaboracion(id, { estado: "borrador" });
      if (!res.ok) loadElaboraciones();
    } catch { loadElaboraciones(); }
  };

  const handleEdit = (elab: Elaboracion) => {
    setEditingElab(elab);
    setModalOpen(true);
    setSelectedId(null);
  };

  const handleDelete = async (id: string) => {
    const elab = elaboraciones.find(e => e.id === id);
    if (!elab || elab.estado === "confirmado") return;
    setElaboraciones(prev => prev.filter(e => e.id !== id));
    toast.success("Elaboración eliminada");
    try {
      const res = await deleteElaboracion(id);
      if (!res.ok) { toast.error("Error al eliminar elaboración en servidor"); loadElaboraciones(); }
    } catch {
      toast.error("Error de conexión al eliminar elaboración");
      loadElaboraciones();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando elaboraciones...</p>
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedElab) {
    return (
      <div className="p-4 md:p-6">
        <DetalleElaboracion
          elaboracion={selectedElab}
          productosElab={productosElab}
          onBack={() => setSelectedId(null)}
          onConfirm={handleConfirm}
          onRevert={handleRevert}
          onEdit={handleEdit}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-end">
        <Button className="gap-1.5" onClick={() => { setEditingElab(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Nueva elaboración
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-black text-foreground">{total}</div>
          <div className="text-xs text-muted-foreground font-medium">TOTAL</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{borradores}</div>
          <div className="text-xs text-muted-foreground font-medium">BORRADORES</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{confirmados}</div>
          <div className="text-xs text-muted-foreground font-medium">CONFIRMADOS</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-black text-foreground">{productosElab.length}</div>
          <div className="text-xs text-muted-foreground font-medium">PRODUCTOS ELAB.</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar elaboración..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="en_proceso">En proceso</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="archivado">Archivado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAlmacen} onValueChange={setFilterAlmacen}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Almacén" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="COCINA">COCINA</SelectItem>
            <SelectItem value="BARRA">BARRA</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          <Button variant={vistaActiva === "tabla" ? "secondary" : "ghost"} size="sm" className="gap-1.5 h-8" onClick={() => setVistaActiva("tabla")}>
            <Table2 className="h-3.5 w-3.5" /> Tabla
          </Button>
          <Button variant={vistaActiva === "pipeline" ? "secondary" : "ghost"} size="sm" className="gap-1.5 h-8" onClick={() => setVistaActiva("pipeline")}>
            <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
          </Button>
        </div>
      </div>

      {/* Content */}
      {vistaActiva === "tabla" ? (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Nombre", "Fecha", "Cantidad", "Almacén", "Estado", "Creador", "Coste", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const coste = calcularCosteElaboracion(e.componentes);
                return (
                  <tr key={e.id} className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedId(e.id)}>
                    <td className="px-4 py-3 font-semibold text-foreground">{e.nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.fecha}</td>
                    <td className="px-4 py-3">{e.cantidadProducida} {e.unidad}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{e.almacen}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] font-bold ${ESTADO_ELABORACION_COLOR[e.estado]}`}>
                        {ESTADO_ELABORACION_LABEL[e.estado]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.creador}</td>
                    <td className="px-4 py-3 font-medium">{coste > 0 ? `${coste.toFixed(2)} €` : "—"}</td>
                    <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedId(e.id)}><Eye className="h-3.5 w-3.5" /></Button>
                        {e.estado !== "confirmado" && e.estado !== "archivado" && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(e.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No se encontraron elaboraciones.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(["borrador", "en_proceso", "confirmado", "archivado"] as EstadoElaboracion[]).map(estado => {
            const items = filtered.filter(e => e.estado === estado);
            return (
              <div key={estado} className="min-w-[280px] max-w-[320px] shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-xs font-bold text-foreground tracking-wide uppercase">{ESTADO_ELABORACION_LABEL[estado]}</h4>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map(e => {
                    const coste = calcularCosteElaboracion(e.componentes);
                    return (
                      <div key={e.id} className="bg-card border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setSelectedId(e.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-tight">{e.nombre}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{e.almacen}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{e.fecha} · {e.creador}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-semibold text-foreground">{e.cantidadProducida} {e.unidad}</span>
                          {coste > 0 && <span className="text-[10px] text-muted-foreground">{coste.toFixed(2)} €</span>}
                        </div>
                        <div className="mt-2">
                          <span className="text-[10px] text-muted-foreground">{e.componentes.length} componente(s)</span>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">Sin elaboraciones</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ElaboracionModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingElab(null); }}
          onSave={handleSave}
          productosElab={productosElab}
          stockItems={stock}
          productosElabList={productosElab}
          existing={editingElab}
        />
      )}
    </div>
  );
}
