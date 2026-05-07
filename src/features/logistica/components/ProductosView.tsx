"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  TipoProducto, getCategorias,
  ESTADOS_PRODUCTO, ESTADO_COLOR, EstadoProducto, type Producto, type Conservacion,
  type PreparacionVenta,
  IVA_OPCIONES, CONSERVACION_OPCIONES, getFormatosPorUnidad,
  PREPARACION_OPCIONES, getPartidasPorPreparacion,
} from "@/features/logistica/data/productos";
import {
  listProductos, createProducto, updateProducto, deleteProducto,
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
  Plus, ShoppingCart, Store, Settings,
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
  coincideBusquedaUniversal,
  colVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { EstiloProductoVenta } from "@/features/logistica/components/productos/EstiloProductoVenta";

function EstadoBadge({ estado }: { estado: EstadoProducto }) {
  return <Badge variant="outline" className={`text-[10px] ${ESTADO_COLOR[estado]}`}>{estado}</Badge>;
}

function parseImporte(s: string | null | undefined): number {
  if (!s) return NaN;
  const n = parseFloat(String(s).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function calcularPorcCoste(coste?: string | null, precioVenta?: string | null): number | null {
  const c = parseImporte(coste);
  const p = parseImporte(precioVenta);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0) return null;
  return (c / p) * 100;
}

function PorcCosteBadge({
  coste, precioVenta, umbralVerde, umbralNaranja,
}: {
  coste?: string | null;
  precioVenta?: string | null;
  umbralVerde: number;
  umbralNaranja: number;
}) {
  const pct = calcularPorcCoste(coste, precioVenta);
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const cls =
    pct <= umbralVerde
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
      : pct <= umbralNaranja
      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
      : "bg-red-500/10 text-red-600 border-red-500/30";
  return <Badge variant="outline" className={`text-[10px] font-semibold ${cls}`}>{pct.toFixed(1)}%</Badge>;
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
          <LoadingSpinner className="py-6" />
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

/* ─── DETALLE PRODUCTO (editable inline) ─── */
function ProductoDetalle({
  producto, onBack, onSaved, onDeleted,
  categoriasOpts, estadosOpts,
}: {
  producto: Producto;
  onBack: () => void;
  onSaved: (p: Producto) => void;
  onDeleted: () => void;
  categoriasOpts?: string[];
  estadosOpts?: string[];
}) {
  const esCompra = producto.tipo === "compra";
  const esVenta = producto.tipo === "venta";
  const esElaboracion = producto.tipo === "elaboracion";
  const mostrarConservacion = !esVenta;
  const mostrarIva = !esElaboracion;
  const mostrarFormato = esCompra || esElaboracion;
  const categorias = categoriasOpts ?? getCategorias(producto.tipo);
  const estadosList = estadosOpts ?? [...ESTADOS_PRODUCTO];
  const { empresaActual } = useEmpresa();

  const [nombre, setNombre] = useState(producto.nombre);
  const [categoria, setCategoria] = useState(producto.categoria);
  const [unidad, setUnidad] = useState(producto.unidad || "ud");
  const [estado, setEstado] = useState<EstadoProducto>(producto.estado);
  const [proveedor, setProveedor] = useState(producto.proveedor ?? "");
  const [precioCompra, setPrecioCompra] = useState(producto.precioCompra ?? "");
  const [precioVenta, setPrecioVenta] = useState(producto.precioVenta ?? "");
  const [coste, setCoste] = useState(producto.coste ?? "");
  const [iva, setIva] = useState(producto.iva ?? "");
  const [formato, setFormato] = useState(producto.formato ?? "");
  const [conservacion, setConservacion] = useState<Conservacion | "">(producto.conservacion ?? "");
  const [preparacion, setPreparacion] = useState<PreparacionVenta | "">(producto.preparacion ?? "");
  const [partida, setPartida] = useState(producto.partida ?? "");
  const [observaciones, setObservaciones] = useState(producto.observaciones ?? "");
  const [textoTicket, setTextoTicket] = useState(producto.textoTicket ?? "");
  const [textoComanda, setTextoComanda] = useState(producto.textoComanda ?? "");
  const [estiloColor, setEstiloColor] = useState<string | null>(producto.estiloColor ?? null);
  const [estiloImagenUrl, setEstiloImagenUrl] = useState<string | null>(producto.estiloImagenUrl ?? null);
  const [cartaNombre, setCartaNombre] = useState<string>(producto.cartaNombre ?? "");
  const [cartaTexto, setCartaTexto] = useState<string>(producto.cartaTexto ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const formatosUnidad = getFormatosPorUnidad(unidad);
  const partidasOpts = getPartidasPorPreparacion(preparacion);

  // Reset formato when unidad changes if current formato is not valid for new unidad.
  useEffect(() => {
    if (formato && formatosUnidad.length > 0 && !formatosUnidad.includes(formato)) {
      setFormato("");
    }
  }, [unidad]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset partida cuando cambia preparacion si la actual ya no aplica.
  useEffect(() => {
    if (partida && partidasOpts.length > 0 && !partidasOpts.includes(partida)) {
      setPartida("");
    }
  }, [preparacion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const errs: string[] = [];
    if (!nombre.trim()) errs.push("El nombre es obligatorio");
    if (!categoria) errs.push("Selecciona una categoría");
    if (!unidad) errs.push("Selecciona una unidad");
    if (errs.length > 0) { setErrors(errs); return; }

    setSaving(true);
    const payload = {
      nombre: nombre.trim(),
      tipo: producto.tipo,
      categoria,
      familia: producto.familia || null,
      estado,
      proveedor: esCompra ? (proveedor || null) : null,
      precioCompra: esCompra ? (precioCompra || null) : null,
      precioVenta: !esCompra ? (precioVenta || null) : null,
      coste: !esCompra ? (coste || null) : null,
      iva: mostrarIva && iva && iva !== "none" ? iva : null,
      unidad,
      formato: mostrarFormato ? (formato || null) : null,
      observaciones: observaciones || null,
      conservacion: mostrarConservacion ? (conservacion || null) : null,
      preparacion: esVenta ? (preparacion || null) : null,
      partida: esVenta ? (partida.trim() || null) : null,
      textoTicket: esVenta ? (textoTicket || null) : null,
      textoComanda: esVenta ? (textoComanda || null) : null,
      estiloColor: esVenta ? estiloColor : null,
      estiloImagenUrl: esVenta ? estiloImagenUrl : null,
      cartaNombre: esVenta ? (cartaNombre.trim() || null) : null,
      cartaTexto: esVenta ? (cartaTexto.trim() || null) : null,
    };

    const res = await updateProducto(producto.id, payload);
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Producto actualizado");
    onSaved({ ...producto, ...payload } as Producto);
  };

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
        <Button size="sm" className="gap-1" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del producto"
              className="text-xl font-black tracking-tight h-auto py-1 max-w-xl"
            />
            <EstadoBadge estado={estado} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Tipo</Label>
              <div className="font-medium capitalize py-2">{producto.tipo}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Categoría *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mostrarConservacion && (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Conservación</Label>
                <Select value={conservacion || "none"} onValueChange={(v) => setConservacion(v === "none" ? "" : (v as Conservacion))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {CONSERVACION_OPCIONES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {esVenta && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Preparación</Label>
                  <Select value={preparacion || "none"} onValueChange={(v) => setPreparacion(v === "none" ? "" : (v as PreparacionVenta))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      {PREPARACION_OPCIONES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Partida</Label>
                  <Select
                    value={partida || "none"}
                    onValueChange={(v) => setPartida(v === "none" ? "" : v)}
                    disabled={!preparacion}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!preparacion ? "Elige preparación" : "Seleccionar"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      {partidasOpts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Unidad *</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_STOCK.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mostrarFormato && (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Formato</Label>
                <Select
                  value={formato || "none"}
                  onValueChange={(v) => setFormato(v === "none" ? "" : v)}
                  disabled={formatosUnidad.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formatosUnidad.length === 0 ? "Elige unidad primero" : "Seleccionar"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {formatosUnidad.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoProducto)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {estadosList.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {esCompra ? (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Proveedor</Label>
                  <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Nombre del proveedor" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Precio compra</Label>
                  <Input value={precioCompra} onChange={(e) => setPrecioCompra(e.target.value)} placeholder="Ej: 12,50 €/kg" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Precio venta</Label>
                  <Input value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} placeholder="Ej: 18,00 €" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Coste</Label>
                  <Input value={coste} onChange={(e) => setCoste(e.target.value)} placeholder="Ej: 6,20 €" />
                </div>
              </>
            )}
            {mostrarIva && (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">IVA</Label>
                <Select value={iva || "none"} onValueChange={setIva}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {IVA_OPCIONES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Últ. actualización</Label>
              <div className="font-medium py-2">{producto.ultimaActualizacion}</div>
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <Label className="text-xs text-muted-foreground block mb-1">Observaciones</Label>
              <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </div>
          </div>

          <AtenciónModal messages={errors} onClose={() => setErrors([])} />
        </CardContent>
      </Card>

      {/* Estilo de impresión (solo productos de venta) */}
      {esVenta && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estilo de impresión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Texto para ticket</Label>
                <Input
                  value={textoTicket}
                  onChange={(e) => setTextoTicket(e.target.value)}
                  placeholder={producto.nombre}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Texto para comanda</Label>
                <Input
                  value={textoComanda}
                  onChange={(e) => setTextoComanda(e.target.value)}
                  placeholder={producto.nombre}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estilo POS — solo productos de venta */}
      {esVenta && (
        <EstiloProductoVenta
          productoId={producto.id}
          empresaId={empresaActual.id}
          nombre={nombre.trim() || producto.nombre}
          estiloColor={estiloColor}
          estiloImagenUrl={estiloImagenUrl}
          onChange={({ estiloColor: c, estiloImagenUrl: u }) => {
            setEstiloColor(c);
            setEstiloImagenUrl(u);
          }}
        />
      )}

      {/* Carta Digital — solo productos de venta */}
      {esVenta && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Carta Digital</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-y-3 gap-x-4 items-center text-sm">
              <Label className="text-xs text-muted-foreground">Nombre:</Label>
              <Input
                value={cartaNombre}
                onChange={(e) => setCartaNombre(e.target.value)}
                placeholder="Utilizar el nombre del producto"
              />
              <Label className="text-xs text-muted-foreground self-start pt-2">Texto:</Label>
              <textarea
                value={cartaTexto}
                onChange={(e) => setCartaTexto(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Utilizar la descripción de la ficha de producto"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground italic">
              Si dejas estos campos vacíos, la carta digital usará el nombre y la descripción del producto.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Composición para productos de venta y elaboraciones */}
      {(producto.tipo === "venta" || producto.tipo === "elaboracion") && (
        <Composicion productoVentaId={producto.id} precioVenta={producto.precioVenta ?? undefined} />
      )}

      <div className="flex justify-end pt-2">
        <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" /> Eliminar producto
        </Button>
      </div>
    </div>
  );
}

/* ─── TABLA ─── */
function TablaProductos({
  tipo, onAddClick, onRowClick, reloadKey, showConfig, onToggleConfig,
  umbralVerde, umbralNaranja,
}: {
  tipo: TipoProducto;
  onAddClick: () => void;
  onRowClick: (p: Producto) => void;
  reloadKey: number;
  showConfig: boolean;
  onToggleConfig: () => void;
  umbralVerde: number;
  umbralNaranja: number;
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
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>(
    tipo === "venta" || tipo === "elaboracion" ? { iva: false } : {},
  );

  const esCompra = tipo === "compra";
  const esVenta = tipo === "venta";
  const esElaboracion = tipo === "elaboracion";
  const mostrarConservacion = !esVenta;
  const mostrarIva = !esElaboracion;
  const mostrarFormato = esCompra || esElaboracion;

  useEffect(() => {
    setColumnasVisibles(tipo === "venta" || tipo === "elaboracion" ? { iva: false } : {});
  }, [tipo]);

  const categoriasUsadas = useMemo(
    () => [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort(),
    [productos],
  );
  const proveedoresUsados = useMemo(
    () => [...new Set(productos.map((p) => p.proveedor ?? "").filter(Boolean))].sort(),
    [productos],
  );
  const unidadesUsadas = useMemo(
    () => [...new Set(productos.map((p) => p.unidad).filter(Boolean))].sort(),
    [productos],
  );
  const partidasUsadas = useMemo(
    () => [...new Set(productos.map((p) => p.partida ?? "").filter(Boolean))].sort(),
    [productos],
  );

  const acceso = (p: Producto, campo: string): unknown => {
    if (campo === "precio") {
      const raw = esCompra ? p.precioCompra : p.precioVenta;
      const val = parseFloat(raw ?? "");
      return Number.isNaN(val) ? null : val;
    }
    if (campo === "fecha") return p.ultimaActualizacion;
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = productos.filter((p) => coincideBusquedaUniversal(p, busqueda));
    lista = aplicarFiltrosToolbar(lista as unknown as Record<string, unknown>[], filtros, (item, campo) =>
      acceso(item as unknown as Producto, campo),
    ) as unknown as Producto[];
    lista = aplicarOrdenToolbar(lista as unknown as Record<string, unknown>[], orden, (item, campo) =>
      acceso(item as unknown as Producto, campo),
    ) as unknown as Producto[];
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, busqueda, filtros, orden, esCompra]);

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={onAddClick}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={[
          { campo: "nombre", label: "Nombre", bloqueada: true },
          { campo: "categoria", label: "Categoría" },
          ...(mostrarConservacion ? [{ campo: "conservacion", label: "Conservación" }] : []),
          ...(esVenta ? [
            { campo: "preparacion", label: "Preparación" },
            { campo: "partida", label: "Partida" },
          ] : []),
          { campo: "estado", label: "Estado" },
          ...(esCompra
            ? [
                { campo: "proveedor", label: "Proveedor" },
                { campo: "precio", label: "Precio compra" },
              ]
            : [
                { campo: "precio", label: esElaboracion ? "Precio elaboración" : "Precio venta" },
                { campo: "coste", label: "Coste" },
                ...(esVenta ? [{ campo: "porcCoste", label: "% Coste" }] : []),
              ]),
          ...(mostrarIva ? [{ campo: "iva", label: "IVA" }] : []),
          { campo: "unidad", label: "Unidad" },
          ...(mostrarFormato ? [{ campo: "formato", label: "Formato" }] : []),
          { campo: "fecha", label: "Actualización" },
        ]}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        extraDerecha={
          <>
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
            <Button size="icon" variant={showConfig ? "default" : "outline"} className="h-9 w-9" onClick={onToggleConfig} title="Configuración" aria-label="Configuración">
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      <ResizableColumnsProvider storageKey={`logistica-productos-${tipo}`}>
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <TableColumnHeader
                label="Nombre"
                campo="nombre"
                ordenable
                orden={orden}
                onOrdenChange={setOrden}
              />
              {colVisible(columnasVisibles, "categoria") && (
                <TableColumnHeader
                  label="Categoría"
                  campo="categoria"
                  filtroTipo="lista"
                  opciones={categoriasUsadas}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {mostrarConservacion && colVisible(columnasVisibles, "conservacion") && (
                <TableColumnHeader
                  label="Conservación"
                  campo="conservacion"
                  filtroTipo="lista"
                  opciones={[...CONSERVACION_OPCIONES]}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {esVenta && colVisible(columnasVisibles, "preparacion") && (
                <TableColumnHeader
                  label="Preparación"
                  campo="preparacion"
                  filtroTipo="lista"
                  opciones={[...PREPARACION_OPCIONES]}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {esVenta && colVisible(columnasVisibles, "partida") && (
                <TableColumnHeader
                  label="Partida"
                  campo="partida"
                  filtroTipo="lista"
                  opciones={partidasUsadas}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {colVisible(columnasVisibles, "estado") && (
                <TableColumnHeader
                  label="Estado"
                  campo="estado"
                  filtroTipo="lista"
                  opciones={[...ESTADOS_PRODUCTO]}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {esCompra ? (
                <>
                  {colVisible(columnasVisibles, "proveedor") && (
                    <TableColumnHeader
                      label="Proveedor"
                      campo="proveedor"
                      filtroTipo="lista"
                      opciones={proveedoresUsados}
                      filtros={filtros}
                      onFiltrosChange={setFiltros}
                      ordenable
                      orden={orden}
                      onOrdenChange={setOrden}
                    />
                  )}
                  {colVisible(columnasVisibles, "precio") && (
                    <TableColumnHeader
                      label="Precio compra"
                      campo="precio"
                      filtroTipo="numero"
                      filtros={filtros}
                      onFiltrosChange={setFiltros}
                      ordenable
                      orden={orden}
                      onOrdenChange={setOrden}
                    />
                  )}
                </>
              ) : (
                <>
                  {colVisible(columnasVisibles, "precio") && (
                    <TableColumnHeader
                      label={esElaboracion ? "Precio de elaboración" : "Precio de venta"}
                      campo="precio"
                      filtroTipo="numero"
                      filtros={filtros}
                      onFiltrosChange={setFiltros}
                      ordenable
                      orden={orden}
                      onOrdenChange={setOrden}
                    />
                  )}
                  {colVisible(columnasVisibles, "coste") && (
                    <TableColumnHeader label="Coste" />
                  )}
                  {esVenta && colVisible(columnasVisibles, "porcCoste") && (
                    <TableColumnHeader label="% Coste" />
                  )}
                </>
              )}
              {mostrarIva && colVisible(columnasVisibles, "iva") && <TableColumnHeader label="IVA" />}
              {colVisible(columnasVisibles, "unidad") && (
                <TableColumnHeader
                  label="Unidad"
                  campo="unidad"
                  filtroTipo="lista"
                  opciones={unidadesUsadas}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                />
              )}
              {mostrarFormato && colVisible(columnasVisibles, "formato") && (
                <TableColumnHeader label="Formato" />
              )}
              {colVisible(columnasVisibles, "fecha") && (
                <TableColumnHeader
                  label="Actualización"
                  campo="fecha"
                  filtroTipo="fecha"
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}
                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onRowClick(p)}>
                <td className="px-3 py-1.5 font-semibold text-primary whitespace-nowrap">{p.nombre}</td>
                {colVisible(columnasVisibles, "categoria") && (
                  <td className="px-3 py-1.5 text-muted-foreground">{p.categoria || "—"}</td>
                )}
                {mostrarConservacion && colVisible(columnasVisibles, "conservacion") && (
                  <td className="px-3 py-1.5 text-muted-foreground">{p.conservacion ?? "—"}</td>
                )}
                {esVenta && colVisible(columnasVisibles, "preparacion") && (
                  <td className="px-3 py-1.5 text-muted-foreground">{p.preparacion ?? "—"}</td>
                )}
                {esVenta && colVisible(columnasVisibles, "partida") && (
                  <td className="px-3 py-1.5 text-muted-foreground">{p.partida ?? "—"}</td>
                )}
                {colVisible(columnasVisibles, "estado") && (
                  <td className="px-3 py-1.5"><EstadoBadge estado={p.estado} /></td>
                )}
                {esCompra ? (
                  <>
                    {colVisible(columnasVisibles, "proveedor") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{p.proveedor ?? "—"}</td>
                    )}
                    {colVisible(columnasVisibles, "precio") && (
                      <td className="px-3 py-1.5 font-medium text-foreground">{p.precioCompra ?? "—"}</td>
                    )}
                  </>
                ) : (
                  <>
                    {colVisible(columnasVisibles, "precio") && (
                      <td className="px-3 py-1.5 font-medium text-foreground">{p.precioVenta ?? "—"}</td>
                    )}
                    {colVisible(columnasVisibles, "coste") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{p.coste ?? "—"}</td>
                    )}
                    {esVenta && colVisible(columnasVisibles, "porcCoste") && (
                      <td className="px-3 py-1.5">
                        <PorcCosteBadge
                          coste={p.coste}
                          precioVenta={p.precioVenta}
                          umbralVerde={umbralVerde}
                          umbralNaranja={umbralNaranja}
                        />
                      </td>
                    )}
                  </>
                )}
                {mostrarIva && colVisible(columnasVisibles, "iva") && (
                  <td className="px-3 py-1.5 text-muted-foreground">{p.iva ?? "—"}</td>
                )}
                {colVisible(columnasVisibles, "unidad") && (
                  <td className="px-3 py-1.5 text-muted-foreground">{p.unidad}</td>
                )}
                {mostrarFormato && colVisible(columnasVisibles, "formato") && (
                  <td className="px-3 py-1.5 text-muted-foreground">{p.formato ?? "—"}</td>
                )}
                {colVisible(columnasVisibles, "fecha") && (
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{p.ultimaActualizacion}</td>
                )}
              </tr>
            ))}
            {loading && productos.length === 0 && (
              <tr><td colSpan={20} className="text-center py-10"><LoadingSpinner /></td></tr>
            )}
            {!loading && productos.length === 0 && (
              <tr><td colSpan={20} className="text-center py-10 text-muted-foreground">No hay productos todavía.</td></tr>
            )}
            {!loading && productos.length > 0 && filtrados.length === 0 && (
              <tr><td colSpan={20} className="text-center py-10 text-muted-foreground">Ningún producto coincide con los filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </ResizableColumnsProvider>
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
                  {tipo !== "venta" && p.conservacion && (
                    <p className="text-xs text-muted-foreground mt-1">{p.conservacion}</p>
                  )}
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
  const [estados, setEstRaw] = useState<string[]>([...ESTADOS_PRODUCTO]);
  const [umbralVerde, setUmbralVerdeRaw] = useState<number>(30);
  const [umbralNaranja, setUmbralNaranjaRaw] = useState<number>(40);

  useEffect(() => {
    Promise.all([
      getProductoConfigSection(tipo, "categorias"),
      getProductoConfigSection("global", "estados"),
      getProductoConfigSection("venta", "umbral_coste"),
    ]).then(([cats, ests, umbral]) => {
      setCatRaw(cats);
      setEstRaw(ests);
      const v = parseFloat(umbral?.[0] ?? "30");
      const n = parseFloat(umbral?.[1] ?? "40");
      if (!Number.isNaN(v)) setUmbralVerdeRaw(v);
      if (!Number.isNaN(n)) setUmbralNaranjaRaw(n);
    });
  }, [tipo]);

  const setCategorias = async (v: string[]) => {
    setCatRaw(v);
    await saveProductoConfigSection(tipo, "categorias", v);
  };
  const setEstados = async (v: string[]) => {
    setEstRaw(v);
    await saveProductoConfigSection("global", "estados", v);
  };
  const setUmbrales = async (verde: number, naranja: number) => {
    setUmbralVerdeRaw(verde);
    setUmbralNaranjaRaw(naranja);
    await saveProductoConfigSection("venta", "umbral_coste", [String(verde), String(naranja)]);
  };

  return { categorias, setCategorias, estados, setEstados, umbralVerde, umbralNaranja, setUmbrales };
}

/* ─── LIST MANAGER: sección editable (categorías / familias / estados) ─── */
function ListManager({ title, items, onChange, readOnly = false }: {
  title: string;
  items: string[];
  onChange: (v: string[]) => void;
  readOnly?: boolean;
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
            {!readOnly && editIdx === i ? (
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
                {!readOnly && (
                  <>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(i)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => remove(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
        {!readOnly && (
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
        )}
      </div>
    </div>
  );
}

function UmbralCosteEditor({
  umbralVerde, umbralNaranja, onChange,
}: {
  umbralVerde: number;
  umbralNaranja: number;
  onChange: (verde: number, naranja: number) => void;
}) {
  const [verde, setVerde] = useState(String(umbralVerde));
  const [naranja, setNaranja] = useState(String(umbralNaranja));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setVerde(String(umbralVerde)); setDirty(false); }, [umbralVerde]);
  useEffect(() => { setNaranja(String(umbralNaranja)); }, [umbralNaranja]);

  const vNum = parseFloat(verde.replace(",", "."));
  const nNum = parseFloat(naranja.replace(",", "."));
  const valido =
    Number.isFinite(vNum) && Number.isFinite(nNum) &&
    vNum >= 0 && vNum < nNum && nNum <= 100;

  const verdePct = Math.max(0, Math.min(100, Number.isFinite(vNum) ? vNum : 0));
  const naranjaPct = Math.max(verdePct, Math.min(100, Number.isFinite(nNum) ? nNum : 0));

  const handleSave = async () => {
    if (!valido) { toast.error("Revisa los umbrales: verde < naranja, entre 0 y 100"); return; }
    setSaving(true);
    await onChange(vNum, nNum);
    setSaving(false);
    setDirty(false);
    toast.success("Umbrales guardados");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Food cost</h4>
        {dirty && (
          <Button size="sm" className="h-7 px-3 text-xs" onClick={handleSave} disabled={saving || !valido}>
            {saving ? "…" : "Guardar"}
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        {/* Barra tricolor con marcadores */}
        <div className="relative pt-5 pb-1">
          <div className="relative h-2 w-full rounded-full overflow-hidden bg-muted">
            <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${verdePct}%` }} />
            <div className="absolute inset-y-0 bg-amber-500" style={{ left: `${verdePct}%`, width: `${Math.max(0, naranjaPct - verdePct)}%` }} />
            <div className="absolute inset-y-0 bg-red-500" style={{ left: `${naranjaPct}%`, right: 0 }} />
          </div>
          {/* Marcador verde */}
          <div
            className="absolute top-0 -translate-x-1/2 text-[10px] font-semibold text-emerald-600"
            style={{ left: `${verdePct}%` }}
          >
            {verdePct.toFixed(0)}%
          </div>
          {/* Marcador naranja */}
          <div
            className="absolute top-0 -translate-x-1/2 text-[10px] font-semibold text-amber-600"
            style={{ left: `${naranjaPct}%` }}
          >
            {naranjaPct.toFixed(0)}%
          </div>
        </div>

        {/* Inputs minimalistas */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="relative flex-1">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={verde}
                onChange={(e) => { setVerde(e.target.value); setDirty(true); }}
                className="h-9 pr-7 text-sm font-medium tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
            </div>
          </div>

          <span className="text-muted-foreground/60 text-xs px-1">→</span>

          <div className="flex items-center gap-2 flex-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="relative flex-1">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={naranja}
                onChange={(e) => { setNaranja(e.target.value); setDirty(true); }}
                className="h-9 pr-7 text-sm font-medium tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
            </div>
          </div>

          <span className="text-muted-foreground/60 text-xs px-1">→</span>

          <div className="flex items-center gap-2 shrink-0 pr-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-muted-foreground tabular-nums">+{naranjaPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigProductos({
  categorias, setCategorias,
  mostrarUmbralCoste = false, umbralVerde = 30, umbralNaranja = 40, onUmbralesChange,
}: {
  categorias: string[];
  setCategorias: (v: string[]) => void;
  mostrarUmbralCoste?: boolean;
  umbralVerde?: number;
  umbralNaranja?: number;
  onUmbralesChange?: (verde: number, naranja: number) => void;
}) {
  return (
    <div className="space-y-5">
      <ListManager title="Categorías" items={categorias} onChange={setCategorias} />
      {mostrarUmbralCoste && onUmbralesChange && (
        <UmbralCosteEditor
          umbralVerde={umbralVerde}
          umbralNaranja={umbralNaranja}
          onChange={onUmbralesChange}
        />
      )}
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
  open, onClose, tipo, editItem, onSaved, categoriasOpts, estadosOpts,
}: {
  open: boolean;
  onClose: () => void;
  tipo: TipoProducto;
  editItem: Producto | null;
  onSaved: () => void;
  categoriasOpts?: string[];
  estadosOpts?: string[];
}) {
  const esCompra = tipo === "compra";
  const esVenta = tipo === "venta";
  const esElaboracion = tipo === "elaboracion";
  const mostrarConservacion = !esVenta;
  const mostrarIva = !esElaboracion;
  const mostrarFormato = esCompra || esElaboracion;
  const categorias = categoriasOpts ?? getCategorias(tipo);
  const estadosList = estadosOpts ?? [...ESTADOS_PRODUCTO];
  const isEdit = !!editItem;

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("ud");
  const [estado, setEstado] = useState<EstadoProducto>("Activo");
  const [proveedor, setProveedor] = useState("");
  const [precioCompra, setPrecioCompra] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [coste, setCoste] = useState("");
  const [iva, setIva] = useState("");
  const [formato, setFormato] = useState("");
  const [conservacion, setConservacion] = useState<Conservacion | "">("");
  const [preparacion, setPreparacion] = useState<PreparacionVenta | "">("");
  const [partida, setPartida] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const formatosUnidad = getFormatosPorUnidad(unidad);
  const partidasOpts = getPartidasPorPreparacion(preparacion);

  useEffect(() => {
    if (formato && formatosUnidad.length > 0 && !formatosUnidad.includes(formato)) {
      setFormato("");
    }
  }, [unidad]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (partida && partidasOpts.length > 0 && !partidasOpts.includes(partida)) {
      setPartida("");
    }
  }, [preparacion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editItem) {
      setNombre(editItem.nombre);
      setCategoria(editItem.categoria);
      setUnidad(editItem.unidad || "ud");
      setEstado(editItem.estado);
      setProveedor(editItem.proveedor ?? "");
      setPrecioCompra(editItem.precioCompra ?? "");
      setPrecioVenta(editItem.precioVenta ?? "");
      setCoste(editItem.coste ?? "");
      setIva(editItem.iva ?? "");
      setFormato(editItem.formato ?? "");
      setConservacion(editItem.conservacion ?? "");
      setPreparacion(editItem.preparacion ?? "");
      setPartida(editItem.partida ?? "");
      setObservaciones(editItem.observaciones ?? "");
    } else {
      setNombre(""); setCategoria(""); setUnidad("ud");
      setEstado("Activo"); setProveedor(""); setPrecioCompra(""); setPrecioVenta("");
      setCoste(""); setIva(""); setFormato(""); setConservacion("");
      setPreparacion(""); setPartida("");
      setObservaciones("");
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
      familia: editItem?.familia || null,
      estado,
      proveedor: esCompra ? (proveedor || null) : null,
      precioCompra: esCompra ? (precioCompra || null) : null,
      precioVenta: !esCompra ? (precioVenta || null) : null,
      coste: !esCompra ? (coste || null) : null,
      iva: mostrarIva && iva && iva !== "none" ? iva : null,
      unidad,
      formato: mostrarFormato ? (formato || null) : null,
      observaciones: observaciones || null,
      conservacion: mostrarConservacion ? (conservacion || null) : null,
      preparacion: esVenta ? (preparacion || null) : null,
      partida: esVenta ? (partida.trim() || null) : null,
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
            {mostrarFormato && (
              <div>
                <Label className="text-xs font-bold">Formato</Label>
                <Select
                  value={formato || "none"}
                  onValueChange={(v) => setFormato(v === "none" ? "" : v)}
                  disabled={formatosUnidad.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formatosUnidad.length === 0 ? "Elige unidad primero" : "Seleccionar"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {formatosUnidad.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            {mostrarConservacion && (
              <div>
                <Label className="text-xs font-bold">Conservación</Label>
                <Select value={conservacion || "none"} onValueChange={(v) => setConservacion(v === "none" ? "" : (v as Conservacion))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {CONSERVACION_OPCIONES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {esVenta && (
              <>
                <div>
                  <Label className="text-xs font-bold">Preparación</Label>
                  <Select value={preparacion || "none"} onValueChange={(v) => setPreparacion(v === "none" ? "" : (v as PreparacionVenta))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      {PREPARACION_OPCIONES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold">Partida</Label>
                  <Select
                    value={partida || "none"}
                    onValueChange={(v) => setPartida(v === "none" ? "" : v)}
                    disabled={!preparacion}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!preparacion ? "Elige preparación" : "Seleccionar"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      {partidasOpts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
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
            {mostrarIva && (
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
            )}
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
          key={detalle.id}
          producto={detalle}
          onBack={() => setDetalle(null)}
          onSaved={(p) => { setDetalle(p); triggerReload(); }}
          onDeleted={() => { setDetalle(null); triggerReload(); }}
          categoriasOpts={config.categorias}
          estadosOpts={config.estados}
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
            categorias={config.categorias}
            setCategorias={config.setCategorias}
            mostrarUmbralCoste={tipoActivo === "venta"}
            umbralVerde={config.umbralVerde}
            umbralNaranja={config.umbralNaranja}
            onUmbralesChange={config.setUmbrales}
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
          umbralVerde={config.umbralVerde}
          umbralNaranja={config.umbralNaranja}
        />
      )}

      <ProductoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tipo={tipoActivo}
        editItem={editItem}
        onSaved={triggerReload}
        categoriasOpts={config.categorias}
        estadosOpts={config.estados}
      />
    </div>
  );
}
