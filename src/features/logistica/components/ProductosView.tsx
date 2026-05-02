"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  TipoProducto, getCategorias, getFamilias,
  ESTADOS_PRODUCTO, ESTADO_COLOR, EstadoProducto, type Producto, IVA_OPCIONES,
} from "@/features/logistica/data/productos";
import {
  listProductos, createProducto, updateProducto, deleteProducto, recalculateAllCosts,
} from "@/features/logistica/actions/producto-actions";
import {
  getProductoConfigSection, saveProductoConfigSection,
} from "@/features/logistica/actions/config-actions";
import { listEscandallosConPrecios, addEscandallo, removeEscandallo, getCosteEscandallo } from "@/features/logistica/actions/escandallos-actions";
import { UNIDADES_STOCK } from "@/features/logistica/data/stock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Plus, ShoppingCart, Store, Settings2, Settings,
  ArrowLeft, Pencil, Trash2, AlertTriangle, ChefHat, X, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { IOActions } from "@/shared/io";
import {
  productosCompraIO,
  productosVentaIO,
  productosElaboracionIO,
} from "@/features/logistica/io/productos.io";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";

function EstadoBadge({ estado }: { estado: EstadoProducto }) {
  return <Badge variant="outline" className={`text-[10px] ${ESTADO_COLOR[estado]}`}>{estado}</Badge>;
}

type Ingrediente = { id: string; nombre: string; unidad: string };

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

/* ─── COMPOSICIÓN (escandallo de un producto de venta) ─── */
function Composicion({ productoVentaId, precioVenta }: { productoVentaId: string; precioVenta?: string }) {
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

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([listProductos("compra"), listProductos("elaboracion")]).then(([compra, elab]) => {
      const items = [...compra, ...elab]
        .map((p) => ({
          id: p.id,
          nombre: p.tipo === "elaboracion" ? `[Elab.] ${p.nombre}` : p.nombre,
          unidad: p.unidad,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      setIngredientes(items);
    });
  }, []);

  const handleAdd = async () => {
    if (!selIng) { toast.error("Selecciona un ingrediente"); return; }
    const c = parseFloat(cantidad.replace(",", "."));
    if (isNaN(c) || c <= 0) { toast.error("Cantidad inválida"); return; }
    const m = parseFloat(merma.replace(",", ".")) || 0;
    const res = await addEscandallo({
      productoVentaId,
      ingredienteId: selIng,
      cantidad: c,
      mermaPct: m,
    });
    if (!res.ok) { toast.error(res.error ?? "Error al añadir"); return; }
    toast.success("Ingrediente añadido");
    setAddOpen(false); setSelIng(""); setCantidad(""); setMerma("0");
    load();
  };

  const handleRemove = async (id: string) => {
    const res = await removeEscandallo(id);
    if (!res.ok) { toast.error("Error al eliminar"); return; }
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ChefHat className="h-4 w-4" /> COMPOSICIÓN
          <Badge variant="secondary" className="text-[10px]">{lineas.length}</Badge>
        </CardTitle>
        <Button size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Añadir ingrediente
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>
        ) : lineas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Este plato no tiene composición. Añade ingredientes para definir el escandallo.
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
                    <th className="text-right py-2 font-bold">PRECIO/U</th>
                    <th className="text-right py-2 font-bold">SUBTOTAL</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const real = l.cantidad * (1 + l.mermaPct / 100);
                    return (
                      <tr key={l.id} className="border-b">
                        <td className="py-2 font-medium">{l.ingredienteNombre}</td>
                        <td className="py-2 text-right">{l.cantidad} {l.ingredienteUnidad}</td>
                        <td className="py-2 text-right">{l.mermaPct}%</td>
                        <td className="py-2 text-right text-muted-foreground">{real.toFixed(3)} {l.ingredienteUnidad}</td>
                        <td className="py-2 text-right">
                          {l.precioUnitario > 0
                            ? <span className="text-muted-foreground">{l.precioUnitario.toFixed(2)} €</span>
                            : <span className="text-muted-foreground/50 text-xs">sin precio</span>
                          }
                        </td>
                        <td className="py-2 text-right font-medium">
                          {l.subtotal > 0 ? `${l.subtotal.toFixed(3)} €` : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(l.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumen food cost */}
            {costeTotal > 0 && (() => {
              const pvNum = parseFloat(String(precioVenta ?? "").replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
              const margen = pvNum > 0 ? ((pvNum - costeTotal) / pvNum) * 100 : null;
              return (
                <div className="flex flex-wrap gap-3 pt-1 border-t">
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-1.5">
                    <ChefHat className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-muted-foreground">Food cost:</span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{costeTotal.toFixed(2)} €</span>
                  </div>
                  {pvNum > 0 && (
                    <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5">
                      <span className="text-xs text-muted-foreground">P.V.P:</span>
                      <span className="text-sm font-bold">{pvNum.toFixed(2)} €</span>
                    </div>
                  )}
                  {margen !== null && (
                    <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 border ${margen >= 65 ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700" : margen >= 50 ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"}`}>
                      <span className="text-xs text-muted-foreground">Margen:</span>
                      <span className={`text-sm font-bold ${margen >= 65 ? "text-emerald-700 dark:text-emerald-300" : margen >= 50 ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}`}>
                        {margen.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Añadir ingrediente al escandallo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">Ingrediente *</Label>
              <Select value={selIng} onValueChange={setSelIng}>
                <SelectTrigger><SelectValue placeholder="Seleccionar ingrediente" /></SelectTrigger>
                <SelectContent>
                  {ingredientes.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.nombre} ({i.unidad})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Cantidad *</Label>
                <Input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0,250" />
              </div>
              <div>
                <Label className="text-xs font-bold">Merma %</Label>
                <Input value={merma} onChange={(e) => setMerma(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd}>Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ─── DETALLE PRODUCTO ─── */
function ProductoDetalle({
  producto, onBack, onEdit, onDeleted,
}: {
  producto: Producto;
  onBack: () => void;
  onEdit: (p: Producto) => void;
  onDeleted: () => void;
}) {
  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    const res = await deleteProducto(producto.id);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Producto eliminado");
    onDeleted();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1" onClick={() => onEdit(producto)}>
          <Pencil className="h-4 w-4" /> Editar
        </Button>
        <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" /> Eliminar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl font-black tracking-tight">{producto.nombre}</CardTitle>
            <EstadoBadge estado={producto.estado} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground text-xs block">Tipo</span><span className="font-medium capitalize">{producto.tipo}</span></div>
            <div><span className="text-muted-foreground text-xs block">Categoría</span><span className="font-medium">{producto.categoria || "—"}</span></div>
            <div><span className="text-muted-foreground text-xs block">Familia</span><span className="font-medium">{producto.familia || "—"}</span></div>
            <div><span className="text-muted-foreground text-xs block">Unidad</span><span className="font-medium">{producto.unidad}</span></div>
            {producto.tipo === "compra" ? (
              <>
                <div><span className="text-muted-foreground text-xs block">Proveedor</span><span className="font-medium">{producto.proveedor || "—"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Precio compra</span><span className="font-medium">{producto.precioCompra || "—"}</span></div>
              </>
            ) : (
              <>
                <div><span className="text-muted-foreground text-xs block">Precio venta</span><span className="font-medium">{producto.precioVenta || "—"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Coste</span><span className="font-medium">{producto.coste || "—"}</span></div>
              </>
            )}
            <div><span className="text-muted-foreground text-xs block">IVA</span><span className="font-medium">{producto.iva || "—"}</span></div>
            <div><span className="text-muted-foreground text-xs block">Últ. actualización</span><span className="font-medium">{producto.ultimaActualizacion}</span></div>
          </div>
          {producto.observaciones && (
            <p className="text-sm text-muted-foreground mt-3">{producto.observaciones}</p>
          )}
        </CardContent>
      </Card>

      {/* Composición para productos de venta y elaboraciones */}
      {(producto.tipo === "venta" || producto.tipo === "elaboracion") && (
        <Composicion productoVentaId={producto.id} precioVenta={producto.precioVenta ?? undefined} />
      )}
    </div>
  );
}

/* ─── TABLA ─── */
function TablaProductos({
  tipo, onAddClick, onRowClick, reloadKey, showConfig, onToggleConfig,
}: {
  tipo: TipoProducto;
  onAddClick: () => void;
  onRowClick: (p: Producto) => void;
  reloadKey: number;
  showConfig: boolean;
  onToggleConfig: () => void;
}) {
  const { empresaActual } = useEmpresa();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProductos(tipo)
      .then((data) => { if (!cancelled) setProductos(data); })
      .catch((err) => console.error("Error cargando productos:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tipo, empresaActual.id, reloadKey]);

  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltroActivo[]>([]);

  const esCompra = tipo === "compra";

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      for (const f of filtros) {
        if (f.campo === "categoria" && f.valores?.length && !f.valores.includes(p.categoria)) return false;
        if (f.campo === "familia" && f.valores?.length && !f.valores.includes(p.familia)) return false;
        if (f.campo === "estado" && f.valores?.length && !f.valores.includes(p.estado)) return false;
        if (f.campo === "proveedor" && f.valores?.length && !f.valores.includes(p.proveedor ?? "")) return false;
        if (f.campo === "unidad" && f.valores?.length && !f.valores.includes(p.unidad)) return false;
        if (f.campo === "precio" && f.precioVal !== undefined) {
          const raw = esCompra ? p.precioCompra : p.precioVenta;
          const val = parseFloat(raw ?? "");
          if (!isNaN(val)) {
            if (f.operador === "mayor" && !(val > f.precioVal)) return false;
            if (f.operador === "menor" && !(val < f.precioVal)) return false;
            if (f.operador === "igual" && val !== f.precioVal) return false;
          }
        }
        if (f.campo === "fecha") {
          const fecha = p.ultimaActualizacion;
          if (f.desde && fecha < f.desde) return false;
          if (f.hasta && fecha > f.hasta) return false;
        }
      }
      return true;
    });
  }, [productos, busqueda, filtros, esCompra]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
        <Button variant="primary" size="sm" onClick={onAddClick}><Plus className="h-4 w-4" />Nuevo</Button>
        {!esCompra && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              const t = toast.loading("Recalculando costes...");
              const res = await recalculateAllCosts();
              if (res.error) toast.error(res.error, { id: t });
              else {
                toast.success(`Costes actualizados (${res.updated} productos)`, { id: t });
                window.location.reload();
              }
            }}
          >
            <Settings2 className="h-4 w-4" />
            Recalcular costes
          </Button>
        )}
        <div className="flex-1" />
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <FiltrosAvanzados productos={productos} esCompra={esCompra} filtros={filtros} onChange={setFiltros} />
        <IOActions
          config={
            tipo === "compra"
              ? productosCompraIO
              : tipo === "venta"
              ? productosVentaIO
              : productosElaboracionIO
          }
          onSuccess={() => window.location.reload()}
        />
        <Button size="icon" variant={showConfig ? "default" : "ghost"} className="h-8 w-8" onClick={onToggleConfig} title="Configuración" aria-label="Configuración">
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {[
                "NOMBRE", "CATEGORÍA", "FAMILIA", "ESTADO",
                ...(esCompra ? ["PROVEEDOR", "PRECIO COMPRA"] : ["PRECIO DE VENTA", "COSTE"]),
                "IVA", "UNIDAD", "ACTUALIZACIÓN",
              ].map((h) => (
                <th key={h} className="text-left px-3 py-1.5 text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}
                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onRowClick(p)}>
                <td className="px-3 py-1.5 font-semibold text-primary whitespace-nowrap">{p.nombre}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{p.categoria || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{p.familia || "—"}</td>
                <td className="px-3 py-1.5"><EstadoBadge estado={p.estado} /></td>
                {esCompra ? (
                  <>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.proveedor ?? "—"}</td>
                    <td className="px-3 py-1.5 font-medium text-foreground">{p.precioCompra ?? "—"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-1.5 font-medium text-foreground">{p.precioVenta ?? "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.coste ?? "—"}</td>
                  </>
                )}
                <td className="px-3 py-1.5 text-muted-foreground">{p.iva ?? "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{p.unidad}</td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{p.ultimaActualizacion}</td>
              </tr>
            ))}
            {loading && productos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Cargando productos...</td></tr>
            )}
            {!loading && productos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No hay productos todavía.</td></tr>
            )}
            {!loading && productos.length > 0 && filtrados.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Ningún producto coincide con los filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground text-right">{filtrados.length} de {productos.length} productos</div>
    </div>
  );
}

/* ─── PIPELINE ─── */
function PipelineProductos({ tipo, onCardClick, reloadKey }: {
  tipo: TipoProducto;
  onCardClick: (p: Producto) => void;
  reloadKey: number;
}) {
  const [productos, setProductos] = useState<Producto[]>([]);

  useEffect(() => {
    let cancelled = false;
    listProductos(tipo).then((data) => { if (!cancelled) setProductos(data); });
    return () => { cancelled = true; };
  }, [tipo, reloadKey]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => { if (p.categoria) set.add(p.categoria); });
    return Array.from(set).sort();
  }, [productos]);

  const grouped = useMemo(() => {
    const map: Record<string, Producto[]> = {};
    for (const cat of categorias) map[cat] = [];
    for (const p of productos) {
      if (!map[p.categoria]) map[p.categoria] = [];
      map[p.categoria].push(p);
    }
    return map;
  }, [productos, categorias]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {categorias.length === 0 && (
        <div className="w-full text-center py-10 text-muted-foreground text-sm">No hay productos para mostrar.</div>
      )}
      {categorias.map((cat) => {
        const items = grouped[cat] ?? [];
        return (
          <div key={cat} className="min-w-[280px] max-w-[300px] shrink-0">
            <div className="flex items-center justify-between mb-3 px-1">
              <h4 className="text-xs font-bold text-foreground tracking-wide uppercase">{cat}</h4>
              <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.map((p) => (
                <div key={p.id}
                  className="bg-card border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => onCardClick(p)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-tight">{p.nombre}</p>
                    <EstadoBadge estado={p.estado} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.familia}</p>
                  <div className="flex items-center justify-between mt-2">
                    {tipo === "compra" ? (
                      <span className="text-xs font-semibold text-foreground">{p.precioCompra ?? "—"}</span>
                    ) : (
                      <span className="text-xs font-semibold text-foreground">{p.precioVenta ?? "—"}</span>
                    )}
                    {tipo === "compra" && p.proveedor && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{p.proveedor}</span>
                    )}
                    {tipo === "venta" && p.coste && (
                      <span className="text-[10px] text-muted-foreground">Coste: {p.coste}</span>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">Sin productos</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── CONFIGURACIÓN ─── */
/* ─── HOOK: config persistente en Supabase ─── */
function useProductConfig(tipo: TipoProducto) {
  const [categorias, setCatRaw] = useState<string[]>(getCategorias(tipo));
  const [familias, setFamRaw] = useState<string[]>(getFamilias(tipo));
  const [estados, setEstRaw] = useState<string[]>([...ESTADOS_PRODUCTO]);

  // Cargar desde BD al montar o cambiar tipo
  useEffect(() => {
    Promise.all([
      getProductoConfigSection(tipo, "categorias"),
      getProductoConfigSection(tipo, "familias"),
      getProductoConfigSection("global", "estados"),
    ]).then(([cats, fams, ests]) => {
      setCatRaw(cats);
      setFamRaw(fams);
      setEstRaw(ests);
    });
  }, [tipo]);

  const setCategorias = async (v: string[]) => {
    setCatRaw(v);
    await saveProductoConfigSection(tipo, "categorias", v);
  };
  const setFamilias = async (v: string[]) => {
    setFamRaw(v);
    await saveProductoConfigSection(tipo, "familias", v);
  };
  const setEstados = async (v: string[]) => {
    setEstRaw(v);
    await saveProductoConfigSection("global", "estados", v);
  };

  return { categorias, setCategorias, familias, setFamilias, estados, setEstados };
}

/* ─── LIST MANAGER: sección editable (categorías / familias / estados) ─── */
function ListManager({ title, items, onChange }: {
  title: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [newVal, setNewVal] = useState("");

  const startEdit = (i: number) => { setEditIdx(i); setEditVal(items[i]); };
  const confirmEdit = () => {
    if (editIdx === null) return;
    const trimmed = editVal.trim();
    if (!trimmed) return;
    const next = [...items];
    next[editIdx] = trimmed;
    onChange(next);
    setEditIdx(null);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => {
    const trimmed = newVal.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
    setNewVal("");
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</h4>
      <div className="rounded-md border divide-y">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
            {editIdx === i ? (
              <>
                <Input
                  autoFocus
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditIdx(null); }}
                  className="h-7 text-sm flex-1"
                />
                <Button size="sm" className="h-7 px-2 text-xs" onClick={confirmEdit}>Guardar</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditIdx(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{item}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(i)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder={`Nueva ${title.toLowerCase().replace(/s$/, "")}…`}
            className="h-7 text-sm flex-1"
          />
          <Button size="sm" className="h-7 px-3 text-xs gap-1" onClick={add}>
            <Plus className="h-3 w-3" /> Añadir
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfigProductos({ tipo, categorias, familias, estados, setCategorias, setFamilias, setEstados }: {
  tipo: TipoProducto;
  categorias: string[];
  familias: string[];
  estados: string[];
  setCategorias: (v: string[]) => void;
  setFamilias: (v: string[]) => void;
  setEstados: (v: string[]) => void;
}) {
  return (
    <div className="space-y-5">
      <ListManager title="Categorías" items={categorias} onChange={setCategorias} />
      <ListManager title="Familias" items={familias} onChange={setFamilias} />
      <ListManager title="Estados" items={estados} onChange={setEstados} />
    </div>
  );
}

/* ─── MODAL ATENCIÓN (validación) ─── */
function AtenciónModal({ messages, onClose }: { messages: string[]; onClose: () => void }) {
  return (
    <Dialog open={messages.length > 0} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Atención
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-1">
          {messages.map((m, i) => (
            <p key={i} className="text-sm text-foreground">{m}</p>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Aceptar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── MODAL CREAR / EDITAR PRODUCTO ─── */
function ProductoModal({
  open, onClose, tipo, editItem, onSaved, categoriasOpts, familiasOpts, estadosOpts,
}: {
  open: boolean;
  onClose: () => void;
  tipo: TipoProducto;
  editItem: Producto | null;
  onSaved: () => void;
  categoriasOpts?: string[];
  familiasOpts?: string[];
  estadosOpts?: string[];
}) {
  const esCompra = tipo === "compra";
  const categorias = categoriasOpts ?? getCategorias(tipo);
  const familias = familiasOpts ?? getFamilias(tipo);
  const estadosList = estadosOpts ?? [...ESTADOS_PRODUCTO];
  const isEdit = !!editItem;

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [familia, setFamilia] = useState("");
  const [unidad, setUnidad] = useState("ud");
  const [estado, setEstado] = useState<EstadoProducto>("Activo");
  const [proveedor, setProveedor] = useState("");
  const [precioCompra, setPrecioCompra] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [coste, setCoste] = useState("");
  const [iva, setIva] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setNombre(editItem.nombre);
      setCategoria(editItem.categoria);
      setFamilia(editItem.familia);
      setUnidad(editItem.unidad || "ud");
      setEstado(editItem.estado);
      setProveedor(editItem.proveedor ?? "");
      setPrecioCompra(editItem.precioCompra ?? "");
      setPrecioVenta(editItem.precioVenta ?? "");
      setCoste(editItem.coste ?? "");
      setIva(editItem.iva ?? "");
      setObservaciones(editItem.observaciones ?? "");
    } else {
      setNombre(""); setCategoria(""); setFamilia(""); setUnidad("ud");
      setEstado("Activo"); setProveedor(""); setPrecioCompra(""); setPrecioVenta("");
      setCoste(""); setIva(""); setObservaciones("");
    }
    setErrors([]);
  }, [editItem, open]);

  const handleSave = async () => {
    const errs: string[] = [];
    if (!nombre.trim()) errs.push("El nombre es obligatorio");
    if (!categoria) errs.push("Selecciona una categoría");
    if (!unidad) errs.push("Selecciona una unidad");
    if (errs.length > 0) { setErrors(errs); return; }

    setSaving(true);
    const payload = {
      nombre: nombre.trim(),
      tipo,
      categoria,
      familia: familia || null,
      estado,
      proveedor: esCompra ? (proveedor || null) : null,
      precioCompra: esCompra ? (precioCompra || null) : null,
      precioVenta: !esCompra ? (precioVenta || null) : null,
      coste: !esCompra ? (coste || null) : null,
      iva: iva || null,
      unidad,
      observaciones: observaciones || null,
    };

    const res = isEdit
      ? await updateProducto(editItem!.id, payload)
      : await createProducto(payload);
    setSaving(false);

    if (res.error) { toast.error(res.error); return; }
    toast.success(isEdit ? "Producto actualizado" : "Producto creado");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar producto" : `Nuevo${tipo === "elaboracion" ? "a " : " producto de "}${tipo === "elaboracion" ? "elaboración" : tipo}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs font-bold">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del producto" />
            </div>
            <div>
              <Label className="text-xs font-bold">Unidad *</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_STOCK.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoProducto)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {estadosList.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Categoría *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Familia</Label>
              <Select value={familia} onValueChange={setFamilia}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {familias.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {esCompra ? (
              <>
                <div>
                  <Label className="text-xs font-bold">Proveedor</Label>
                  <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Nombre del proveedor" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Precio compra</Label>
                  <Input value={precioCompra} onChange={(e) => setPrecioCompra(e.target.value)} placeholder="Ej: 12,50 €/kg" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs font-bold">Precio venta</Label>
                  <Input value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} placeholder="Ej: 18,00 €" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Coste</Label>
                  <Input value={coste} onChange={(e) => setCoste(e.target.value)} placeholder="Ej: 6,20 €" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs font-bold">IVA</Label>
              <Select value={iva} onValueChange={setIva}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {IVA_OPCIONES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs font-bold">Observaciones</Label>
              <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </div>
          </div>

          <AtenciónModal messages={errors} onClose={() => setErrors([])} />
        </div>
        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── PÁGINA PRINCIPAL ─── */
export function ProductosView() {
  const [tipoActivo, setTipoActivo] = useState<TipoProducto>("compra");
  const [showConfig, setShowConfig] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Producto | null>(null);
  const [detalle, setDetalle] = useState<Producto | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const config = useProductConfig(tipoActivo);

  const [countCompra, setCountCompra] = useState(0);
  const [countVenta, setCountVenta] = useState(0);
  const [countElab, setCountElab] = useState(0);

  useEffect(() => {
    listProductos("compra").then((d) => setCountCompra(d.length));
    listProductos("venta").then((d) => setCountVenta(d.length));
    listProductos("elaboracion").then((d) => setCountElab(d.length));
  }, [reloadKey]);

  const triggerReload = () => setReloadKey((k) => k + 1);

  if (detalle) {
    return (
      <div className="p-4 md:p-6">
        <ProductoDetalle
          producto={detalle}
          onBack={() => setDetalle(null)}
          onEdit={(p) => { setEditItem(p); setModalOpen(true); }}
          onDeleted={() => { setDetalle(null); triggerReload(); }}
        />
        <ProductoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          tipo={detalle.tipo}
          editItem={editItem}
          onSaved={() => { triggerReload(); setDetalle(null); }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={tipoActivo === "compra" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("compra"); setShowConfig(false); }}
        >
          <ShoppingCart className="h-4 w-4" />
          COMPRA
          <Badge variant="secondary" className="text-[10px] ml-1">{countCompra}</Badge>
        </Button>
        <Button
          variant={tipoActivo === "venta" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("venta"); setShowConfig(false); }}
        >
          <Store className="h-4 w-4" />
          VENTA
          <Badge variant="secondary" className="text-[10px] ml-1">{countVenta}</Badge>
        </Button>
        <Button
          variant={tipoActivo === "elaboracion" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("elaboracion"); setShowConfig(false); }}
        >
          <FlaskConical className="h-4 w-4" />
          ELABORACIONES
          <Badge variant="secondary" className="text-[10px] ml-1">{countElab}</Badge>
        </Button>

      </div>

      {showConfig ? (
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">
            CONFIGURACIÓN — {tipoActivo === "compra" ? "PRODUCTOS DE COMPRA" : tipoActivo === "venta" ? "PRODUCTOS DE VENTA" : "ELABORACIONES"}
          </h3>
          <ConfigProductos
            tipo={tipoActivo}
            categorias={config.categorias}
            familias={config.familias}
            estados={config.estados}
            setCategorias={config.setCategorias}
            setFamilias={config.setFamilias}
            setEstados={config.setEstados}
          />
        </div>
      ) : (
        <TablaProductos
          tipo={tipoActivo}
          onAddClick={() => { setEditItem(null); setModalOpen(true); }}
          onRowClick={(p) => setDetalle(p)}
          reloadKey={reloadKey}
          showConfig={showConfig}
          onToggleConfig={() => setShowConfig((v) => !v)}
        />
      )}

      <ProductoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tipo={tipoActivo}
        editItem={editItem}
        onSaved={triggerReload}
        categoriasOpts={config.categorias}
        familiasOpts={config.familias}
        estadosOpts={config.estados}
      />
    </div>
  );
}
