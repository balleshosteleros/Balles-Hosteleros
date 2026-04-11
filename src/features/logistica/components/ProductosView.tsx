"use client";

import { useState, useMemo, useEffect } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  TipoProducto, getProductosPorEmpresa, getCategorias, getFamilias,
  ESTADOS_PRODUCTO, ESTADO_COLOR, EstadoProducto, type Producto,
  CATEGORIAS_COMPRA, FAMILIAS_COMPRA, CATEGORIAS_VENTA, FAMILIAS_VENTA,
} from "@/features/logistica/data/productos";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import {
  getProductosElaboracion, CATEGORIAS_ELABORACION,
  type ProductoElaboracion,
} from "@/features/logistica/data/elaboraciones";
import { getTemporadasPorEmpresa, UNIDADES_STOCK, type TemporadaStock } from "@/features/logistica/data/stock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search, Plus, Table2, LayoutGrid, ShoppingCart, Store, Settings2,
  Package, FlaskConical, CalendarDays, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { ImportExportButtons } from "@/features/logistica/components/productos/ImportExportButtons";

function EstadoBadge({ estado }: { estado: EstadoProducto }) {
  return <Badge variant="outline" className={`text-[10px] ${ESTADO_COLOR[estado]}`}>{estado}</Badge>;
}

/* ─── TABLA ─── */
function TablaProductos({ tipo, onAddClick }: { tipo: TipoProducto; onAddClick: () => void }) {
  const { empresaActual } = useEmpresa();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProductos(tipo)
      .then((data) => {
        if (!cancelled) setProductos(data);
      })
      .catch((err) => {
        console.error("Error cargando productos:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tipo, empresaActual.id]);

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const categorias = getCategorias(tipo);

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      const texto = `${p.nombre} ${p.categoria} ${p.familia} ${p.proveedor ?? ""}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      if (filtroCategoria !== "todas" && p.categoria !== filtroCategoria) return false;
      if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
      return true;
    });
  }, [productos, busqueda, filtroCategoria, filtroEstado]);

  const esCompra = tipo === "compra";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {ESTADOS_PRODUCTO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <ImportExportButtons tipo={tipo} onImportSuccess={() => window.location.reload()} />
          <Button size="sm" className="gap-1.5" onClick={onAddClick}><Plus className="h-3.5 w-3.5" /> Añadir producto</Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {[
                "NOMBRE", "CATEGORÍA", "FAMILIA", "ESTADO",
                ...(esCompra ? ["PROVEEDOR", "PRECIO COMPRA"] : ["PVP", "COSTE"]),
                "UNIDAD", "ACTUALIZACIÓN",
              ].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30 cursor-pointer">
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{p.nombre}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{p.categoria}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{p.familia}</td>
                <td className="px-3 py-2.5"><EstadoBadge estado={p.estado} /></td>
                {esCompra ? (
                  <>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.proveedor ?? "—"}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{p.precioCompra ?? "—"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2.5 font-medium text-foreground">{p.precioVenta ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.coste ?? "—"}</td>
                  </>
                )}
                <td className="px-3 py-2.5 text-muted-foreground">{p.unidad}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.ultimaActualizacion}</td>
              </tr>
            ))}
            {loading && productos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Cargando productos...</td></tr>
            )}
            {!loading && productos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No hay productos todavía. Usa el botón <strong>Importar</strong> para cargar tu catálogo desde CSV o Excel.</td></tr>
            )}
            {!loading && productos.length > 0 && filtrados.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Ningún producto coincide con los filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── PIPELINE ─── */
function PipelineProductos({ tipo }: { tipo: TipoProducto }) {
  const { empresaActual } = useEmpresa();
  const productos = useMemo(() => getProductosPorEmpresa(empresaActual.id, tipo), [empresaActual.id, tipo]);
  const categorias = getCategorias(tipo);

  const grouped = useMemo(() => {
    const map: Record<string, typeof productos> = {};
    for (const cat of categorias) map[cat] = [];
    for (const p of productos) {
      if (!map[p.categoria]) map[p.categoria] = [];
      map[p.categoria].push(p);
    }
    return map;
  }, [productos, categorias]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
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
                <div key={p.id} className="bg-card border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer">
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
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Sin productos
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── CONFIGURACIÓN ─── */
function ConfigProductos({ tipo }: { tipo: TipoProducto }) {
  const categorias = getCategorias(tipo);
  const familias = getFamilias(tipo);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-foreground">CATEGORÍAS</h4>
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
          <Button variant="outline" size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" /> Añadir</Button>
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-foreground">FAMILIAS</h4>
        <div className="flex flex-wrap gap-2">
          {familias.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}
          <Button variant="outline" size="sm" className="gap-1 text-xs"><Plus className="h-3 w-3" /> Añadir</Button>
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-foreground">ESTADOS</h4>
        <div className="flex flex-wrap gap-2">
          {ESTADOS_PRODUCTO.map((e) => <EstadoBadge key={e} estado={e} />)}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Próximamente: campos configurables, criterios de pipeline personalizados y tipos de producto avanzados.</p>
    </div>
  );
}

/* ─── TABLA ELABORACIONES ─── */
function TablaElaboraciones() {
  const { empresaActual } = useEmpresa();
  const productos = useMemo(() => getProductosElaboracion(empresaActual.id), [empresaActual.id]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCat, setFiltroCat] = useState("todas");

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (filtroCat !== "todas" && p.categoria !== filtroCat) return false;
      return true;
    });
  }, [productos, busqueda, filtroCat]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar elaboración..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {CATEGORIAS_ELABORACION.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 ml-auto"><Plus className="h-3.5 w-3.5" /> Añadir elaboración</Button>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["NOMBRE", "CATEGORÍA", "UNIDAD", "STOCK ACTUAL", "COSTE EST.", "ESTADO"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30 cursor-pointer">
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{p.nombre}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{p.categoria}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{p.unidad}</td>
                <td className="px-3 py-2.5 font-bold text-foreground">{p.stockActual}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{p.costeEstimado.toFixed(2)} €/{p.unidad}</td>
                <td className="px-3 py-2.5">
                  <Badge variant="outline" className={`text-[10px] ${p.estado === "Activo" ? ESTADO_COLOR.Activo : ESTADO_COLOR.Inactivo}`}>
                    {p.estado}
                  </Badge>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No se encontraron elaboraciones.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── MODAL CREAR PRODUCTO ─── */
interface ProductoFormTemporada {
  temporadaId: string;
  nombre: string;
  stockMaximo: string;
  stockSeguridad: string;
}

function ProductoModal({
  open, onClose, tipo, temporadas,
}: {
  open: boolean;
  onClose: () => void;
  tipo: TipoProducto;
  temporadas: TemporadaStock[];
}) {
  const esCompra = tipo === "compra";
  const categorias = getCategorias(tipo);
  const familias = getFamilias(tipo);

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [familia, setFamilia] = useState("");
  const [unidad, setUnidad] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [precioCompra, setPrecioCompra] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [coste, setCoste] = useState("");
  const [stockMaximoBase, setStockMaximoBase] = useState("");
  const [stockSeguridadBase, setStockSeguridadBase] = useState("");
  const [temporadaValues, setTemporadaValues] = useState<ProductoFormTemporada[]>(
    temporadas.map((t) => ({ temporadaId: t.id, nombre: t.nombre, stockMaximo: "", stockSeguridad: "" }))
  );
  const [errors, setErrors] = useState<string[]>([]);

  const updateTemp = (idx: number, field: "stockMaximo" | "stockSeguridad", val: string) => {
    setTemporadaValues((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!nombre.trim()) errs.push("El nombre es obligatorio");
    if (!categoria) errs.push("Selecciona una categoría");
    if (!familia) errs.push("Selecciona una familia");
    if (!unidad) errs.push("Selecciona una unidad");
    if (!stockMaximoBase) errs.push("Stock máximo base es obligatorio");
    if (!stockSeguridadBase) errs.push("Stock de seguridad base es obligatorio");

    if (temporadas.length > 0) {
      temporadaValues.forEach((t) => {
        if (!t.stockMaximo || !t.stockSeguridad) {
          errs.push(`Completa stock máximo y seguridad para "${t.nombre}"`);
        }
      });
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    toast.success("Producto creado correctamente");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo producto de {esCompra ? "compra" : "venta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
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
              <Label className="text-xs font-bold">Categoría *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Familia *</Label>
              <Select value={familia} onValueChange={setFamilia}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {familias.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {esCompra && (
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
            )}
            {!esCompra && (
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
          </div>

          <Separator />

          {/* Stock base */}
          <div>
            <h4 className="text-sm font-bold text-foreground mb-2">Stock base</h4>
            <p className="text-xs text-muted-foreground mb-3">Valores aplicados cuando no hay temporada activa.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Stock máximo *</Label>
                <Input type="number" value={stockMaximoBase} onChange={(e) => setStockMaximoBase(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs font-bold">Stock seguridad *</Label>
                <Input type="number" value={stockSeguridadBase} onChange={(e) => setStockSeguridadBase(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Temporadas - mandatory if they exist */}
          {temporadas.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-bold text-foreground">Stock por temporadas</h4>
                  <Badge variant="outline" className="text-[10px]">Obligatorio</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Define los niveles de stock máximo y seguridad para cada temporada configurada. Todos los campos son obligatorios.
                </p>
                <div className="space-y-3">
                  {temporadaValues.map((t, idx) => (
                    <div key={t.temporadaId} className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        {t.nombre}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Stock máximo *</Label>
                          <Input type="number" className="h-8 text-sm" value={t.stockMaximo} onChange={(e) => updateTemp(idx, "stockMaximo", e.target.value)} placeholder="0" />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Stock seguridad *</Label>
                          <Input type="number" className="h-8 text-sm" value={t.stockSeguridad} onChange={(e) => updateTemp(idx, "stockSeguridad", e.target.value)} placeholder="0" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-destructive text-xs font-bold">
                <AlertTriangle className="h-3.5 w-3.5" /> Corrige los siguientes errores:
              </div>
              {errors.map((e, i) => <p key={i} className="text-xs text-destructive/80 ml-5">• {e}</p>)}
            </div>
          )}
        </div>
        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Crear producto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── PÁGINA PRINCIPAL ─── */
export function ProductosView() {
  const { empresaActual } = useEmpresa();
  const [tipoActivo, setTipoActivo] = useState<TipoProducto | "elaboracion">("compra");
  const [vistaActiva, setVistaActiva] = useState<"tabla" | "pipeline">("tabla");
  const [showConfig, setShowConfig] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const productosCompra = useMemo(() => getProductosPorEmpresa(empresaActual.id, "compra"), [empresaActual.id]);
  const productosVenta = useMemo(() => getProductosPorEmpresa(empresaActual.id, "venta"), [empresaActual.id]);
  const productosElab = useMemo(() => getProductosElaboracion(empresaActual.id), [empresaActual.id]);
  const temporadas = useMemo(() => getTemporadasPorEmpresa(empresaActual.id), [empresaActual.id]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">PRODUCTOS</h1>
            <p className="text-sm text-muted-foreground">Gestión de productos de compra, venta y elaboraciones</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowConfig(!showConfig)}>
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{showConfig ? "Cerrar config." : "Configuración"}</span>
        </Button>
      </div>

      {/* Tipo selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={tipoActivo === "compra" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("compra"); setShowConfig(false); }}
        >
          <ShoppingCart className="h-4 w-4" />
          COMPRA
          <Badge variant="secondary" className="text-[10px] ml-1">{productosCompra.length}</Badge>
        </Button>
        <Button
          variant={tipoActivo === "venta" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("venta"); setShowConfig(false); }}
        >
          <Store className="h-4 w-4" />
          VENTA
          <Badge variant="secondary" className="text-[10px] ml-1">{productosVenta.length}</Badge>
        </Button>
        <Button
          variant={tipoActivo === "elaboracion" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("elaboracion"); setShowConfig(false); }}
        >
          <FlaskConical className="h-4 w-4" />
          ELABORACIONES
          <Badge variant="secondary" className="text-[10px] ml-1">{productosElab.length}</Badge>
        </Button>

        {!showConfig && tipoActivo !== "elaboracion" && (
          <div className="ml-auto flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
            <Button
              variant={vistaActiva === "tabla" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setVistaActiva("tabla")}
            >
              <Table2 className="h-3.5 w-3.5" /> Tabla
            </Button>
            <Button
              variant={vistaActiva === "pipeline" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setVistaActiva("pipeline")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {showConfig && tipoActivo !== "elaboracion" ? (
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">
            CONFIGURACIÓN — {tipoActivo === "compra" ? "PRODUCTOS DE COMPRA" : "PRODUCTOS DE VENTA"}
          </h3>
          <ConfigProductos tipo={tipoActivo as TipoProducto} />
        </div>
      ) : tipoActivo === "elaboracion" ? (
        <TablaElaboraciones />
      ) : vistaActiva === "tabla" ? (
        <TablaProductos tipo={tipoActivo as TipoProducto} onAddClick={() => setModalOpen(true)} />
      ) : (
        <PipelineProductos tipo={tipoActivo as TipoProducto} />
      )}

      {/* Modal crear producto */}
      {tipoActivo !== "elaboracion" && (
        <ProductoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          tipo={tipoActivo as TipoProducto}
          temporadas={temporadas}
        />
      )}
    </div>
  );
}
