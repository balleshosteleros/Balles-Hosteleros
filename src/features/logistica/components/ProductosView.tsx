"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  TipoProducto,
  ESTADOS_PRODUCTO, ESTADO_COLOR, EstadoProducto, type Producto, type Conservacion,
  getUnidadDeFormato,
  ALERGENOS_UE_14,
} from "@/features/logistica/data/productos";
import {
  listProductos, createProducto, updateProducto, deleteProducto, getProductoById,
} from "@/features/logistica/actions/producto-actions";
import { listPartidas } from "@/features/cocina/actions/partidas-actions";
import {
  getProductoConfigSection, saveProductoConfigSection,
} from "@/features/logistica/actions/config-actions";
import { EscandalloEditor } from "@/features/logistica/components/EscandalloEditor";
import { MovimientosStockSection } from "@/features/logistica/components/productos/MovimientosStockSection";
import { ConexionAgoraSection } from "@/features/logistica/components/productos/ConexionAgoraSection";
import { getAlergenosDerivados, getAlergenosDerivadosOrigen, getCosteEscandallo, type AlergenoOrigen } from "@/features/logistica/actions/escandallos-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingCart, Store, Settings,
  ArrowLeft, Trash2, AlertTriangle, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { IOActions } from "@/shared/io";
import { capitalizeText } from "@/shared/lib/utils";
import {
  productosCompraIO,
  productosVentaIO,
  productosElaboracionIO,
} from "@/features/logistica/io/productos.io";
import { ImportadorIADialog } from "@/features/logistica/components/ImportadorIADialog";
import { GestorCategoriasProducto } from "@/features/logistica/components/productos/GestorCategoriasProducto";
import { GestorCatalogoEstandar } from "@/features/logistica/components/productos/GestorCatalogoEstandar";
import { listCategoriasProducto } from "@/features/logistica/actions/categorias-producto-actions";
import {
  listUnidadesMedida,
  createUnidadMedida,
  updateUnidadMedida,
  deleteUnidadMedida,
  listIvas,
  createIva,
  updateIva,
  deleteIva,
  listConservaciones,
  createConservacion,
  updateConservacion,
  deleteConservacion,
} from "@/features/logistica/actions/catalogos-estandar-actions";
import {
  analizarUnidadesIA,
  guardarUnidadesIA,
  analizarIvasIA,
  guardarIvasIA,
  analizarConservacionesIA,
  guardarConservacionesIA,
} from "@/features/logistica/actions/importador-catalogos-ia-actions";
import { useCatalogosLogistica } from "@/features/logistica/hooks/useCatalogosLogistica";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { EstiloProductoVenta } from "@/features/logistica/components/productos/EstiloProductoVenta";
import { PreciosCompraSection } from "@/features/logistica/components/productos/PreciosCompraSection";
import { PreciosPorProveedorSection } from "@/features/logistica/components/productos/PreciosPorProveedorSection";
import { TarifaPreciosSection } from "@/features/logistica/components/productos/TarifaPreciosSection";
import { ProveedorCombobox } from "@/features/logistica/components/productos/ProveedorCombobox";
import { addPrecioCompra } from "@/features/logistica/actions/precios-compra-actions";

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

/* ─── DETALLE PRODUCTO (editable inline) ─── */
function ProductoDetalle({
  producto, tipo, onBack, onSaved, onDeleted,
  categoriasOpts, estadosOpts,
}: {
  producto: Producto | null;
  tipo: TipoProducto;
  onBack: () => void;
  onSaved: (p: Producto) => void;
  onDeleted: () => void;
  categoriasOpts?: string[];
  estadosOpts?: string[];
}) {
  const isNew = producto === null;
  const esCompra = tipo === "compra";
  const esVenta = tipo === "venta";
  const esElaboracion = tipo === "elaboracion";
  const mostrarConservacion = !esVenta;
  const mostrarIva = !esElaboracion;
  const mostrarFormato = esCompra || esElaboracion;
  const estadosList = estadosOpts ?? [...ESTADOS_PRODUCTO];
  const { empresaActual } = useEmpresa();
  const catalogos = useCatalogosLogistica();

  // Cargamos las categorías directamente en el detalle (no a través del padre)
  // para evitar la carrera al abrir un producto antes de que el padre haya cargado.
  const [categoriasLocal, setCategoriasLocal] = useState<string[]>(categoriasOpts ?? []);
  useEffect(() => {
    let cancelled = false;
    listCategoriasProducto(tipo).then((res) => {
      if (cancelled) return;
      setCategoriasLocal(res.ok ? res.data.map((c) => c.nombre) : []);
    });
    return () => { cancelled = true; };
  }, [tipo]);
  const categorias = categoriasLocal;

  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [categoria, setCategoria] = useState(producto?.categoria ?? "");
  const [unidad, setUnidad] = useState(producto?.unidad || "ud");
  const [estado, setEstado] = useState<EstadoProducto>(producto?.estado ?? "Activo");
  const [proveedor, setProveedor] = useState(producto?.proveedor ?? "");
  const [precioVenta, _setPrecioVenta] = useState(producto?.precioVenta ?? "");
  const [coste, setCoste] = useState(producto?.coste ?? "");
  const [iva, setIva] = useState(producto?.iva ?? "");
  const [formato, setFormato] = useState(producto?.formato ?? "");
  const [conservacion, setConservacion] = useState<Conservacion | "">(producto?.conservacion ?? "");
  const [partida, setPartida] = useState(producto?.partida ?? "");
  const [partidasOpts, setPartidasOpts] = useState<string[]>([]);
  const [costeCalc, setCosteCalc] = useState<number | null>(null);
  const [textoTicket, setTextoTicket] = useState(producto?.textoTicket ?? "");
  const [textoComanda, setTextoComanda] = useState(producto?.textoComanda ?? "");
  const [estiloColor, setEstiloColor] = useState<string | null>(producto?.estiloColor ?? null);
  const [estiloImagenUrl, setEstiloImagenUrl] = useState<string | null>(producto?.estiloImagenUrl ?? null);
  const [cartaNombre, setCartaNombre] = useState<string>(producto?.cartaNombre ?? "");
  const [cartaTexto, setCartaTexto] = useState<string>(producto?.cartaTexto ?? "");
  const [alergenos, setAlergenos] = useState<string[]>(producto?.alergenos ?? []);
  const [alergenosDerivados, setAlergenosDerivados] = useState<string[]>([]);
  const [alergenosOrigenes, setAlergenosOrigenes] = useState<AlergenoOrigen[]>([]);
  const [alergenosLoading, setAlergenosLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [preciosVersion, setPreciosVersion] = useState(0);
  // Solo en alta de productos de compra: precio de la primera entrada del histórico.
  // Se persiste vía addPrecioCompra justo después de createProducto.
  const [precioInicial, setPrecioInicial] = useState<string>("");

  // Sincronización con precio vigente (solo productos de compra).
  // Persistimos la preferencia por producto en localStorage; default = true.
  const usarVigenteKey = `producto:${producto?.id ?? "nuevo"}:usarVigente`;
  const [usarVigente, setUsarVigente] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    if (isNew) return false;
    const stored = window.localStorage.getItem(usarVigenteKey);
    return stored === null ? true : stored === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNew) return;
    window.localStorage.setItem(usarVigenteKey, usarVigente ? "1" : "0");
  }, [usarVigente, usarVigenteKey, isNew]);

  const [vigenteSnapshot, setVigenteSnapshot] = useState<{ proveedor: string; formato: string } | null>(null);
  const [vigenteLoaded, setVigenteLoaded] = useState(false);

  // Cuando hay vigente cargado y el check está activo, propagar (o limpiar) los campos.
  // El formato manda: si el formato del vigente pertenece a otra unidad, ajustamos la unidad
  // para evitar combos imposibles tipo "Litros + 1 K".
  useEffect(() => {
    if (!esCompra) return;
    if (!vigenteLoaded) return;
    if (!usarVigente) return;
    const fmt = vigenteSnapshot?.formato ?? "";
    const prov = vigenteSnapshot?.proveedor ?? "";
    setProveedor(prov);
    setFormato(fmt);
    if (fmt) {
      const u = getUnidadDeFormato(fmt);
      if (u) setUnidad(u);
    }
  }, [esCompra, usarVigente, vigenteSnapshot, vigenteLoaded]);

  const formatosUnidad = catalogos.formatosPorUnidad[unidad] ?? [];

  // Reset formato when unidad changes if current formato is not valid for new unidad.
  useEffect(() => {
    if (formato && formatosUnidad.length > 0 && !formatosUnidad.includes(formato)) {
      setFormato("");
    }
  }, [unidad]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar partidas reales (de cocina/partidas) — solo productos de venta.
  useEffect(() => {
    if (!esVenta) return;
    let cancelled = false;
    listPartidas().then((res) => {
      if (cancelled) return;
      const nombres = res.ok ? res.data.map((p) => p.nombre).sort((a, b) => a.localeCompare(b)) : [];
      setPartidasOpts(nombres);
    });
    return () => { cancelled = true; };
  }, [esVenta]);

  // Coste calculado desde el escandallo (productos de venta ya creados).
  useEffect(() => {
    if (!esVenta || isNew || !producto?.id) return;
    let cancelled = false;
    getCosteEscandallo(producto.id).then((res) => {
      if (cancelled) return;
      setCosteCalc(res.ok ? res.coste : null);
    });
    return () => { cancelled = true; };
  }, [esVenta, isNew, producto?.id, preciosVersion]);

  // Alérgenos derivados: para elaboraciones se calculan recursivamente desde el escandallo.
  // Cada ingrediente (producto compra o sub-elaboración) aporta sus alérgenos.
  useEffect(() => {
    if (!esElaboracion || isNew || !producto?.id) return;
    let cancelled = false;
    setAlergenosLoading(true);
    Promise.all([
      getAlergenosDerivados(producto.id),
      getAlergenosDerivadosOrigen(producto.id),
    ]).then(([resA, resO]) => {
      if (cancelled) return;
      setAlergenosDerivados(resA.ok ? resA.data : []);
      setAlergenosOrigenes(resO.ok ? resO.data : []);
      setAlergenosLoading(false);
    });
    return () => { cancelled = true; };
  }, [esElaboracion, isNew, producto?.id, preciosVersion]);

  const handleSave = async () => {
    const errs: string[] = [];
    if (!nombre.trim()) errs.push("El nombre es obligatorio");
    if (!categoria) errs.push("Selecciona una categoría");
    if (!unidad) errs.push("Selecciona una unidad");
    if (errs.length > 0) { setErrors(errs); return; }

    setSaving(true);
    // Para productos de compra: precio + iva los gestiona PreciosCompraSection,
    // así que NO los enviamos aquí (evita sobrescribir el sync del histórico).
    const payload: Record<string, unknown> = {
      nombre: nombre.trim(),
      tipo,
      categoria,
      estado,
      proveedor: esCompra ? (proveedor || null) : null,
      precioVenta: esElaboracion ? (precioVenta || null) : null,
      coste: esElaboracion ? (coste || null) : null,
      unidad,
      formato: mostrarFormato ? (formato || null) : null,
      conservacion: mostrarConservacion ? (conservacion || null) : null,
      partida: esVenta ? (partida.trim() || null) : null,
      textoTicket: esVenta ? (textoTicket || null) : null,
      textoComanda: esVenta ? (textoComanda || null) : null,
      estiloColor: esVenta ? estiloColor : null,
      estiloImagenUrl: esVenta ? estiloImagenUrl : null,
      cartaNombre: esVenta ? (cartaNombre.trim() || null) : null,
      cartaTexto: esVenta ? (cartaTexto.trim() || null) : null,
      alergenos: !esVenta ? alergenos : [],
    };
    if (!esCompra) {
      payload.iva = mostrarIva && iva && iva !== "none" ? iva : null;
    }

    if (isNew) {
      // En el alta de un producto de compra, el precio + IVA se capturan en la
      // sección "Primer precio de compra" y se persisten con addPrecioCompra
      // tras crear el producto.
      let precioInicialNum: number | null = null;
      if (esCompra) {
        const raw = precioInicial.trim();
        if (raw) {
          precioInicialNum = parseFloat(raw.replace(",", "."));
          if (!Number.isFinite(precioInicialNum) || precioInicialNum < 0) {
            setSaving(false);
            setErrors(["Precio inicial inválido"]);
            return;
          }
          if (!proveedor.trim()) {
            setSaving(false);
            setErrors(["Selecciona un proveedor para el primer precio"]);
            return;
          }
        }
      }
      const res = await createProducto(payload as Parameters<typeof createProducto>[0]);
      if (res.error || !res.producto) {
        setSaving(false);
        toast.error(res.error ?? "No se pudo crear");
        return;
      }
      if (esCompra && precioInicialNum !== null) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const fechaInicio = `${yyyy}-${mm}-${dd}`;
        const precioRes = await addPrecioCompra({
          productoId: res.producto.id,
          precio: precioInicialNum,
          iva: iva && iva !== "none" ? iva : null,
          proveedor: proveedor.trim(),
          formato: formato || null,
          fechaInicio,
        });
        if (!precioRes.ok) {
          setSaving(false);
          toast.error(precioRes.error ?? "Producto creado, pero no se pudo guardar el precio");
          onSaved(res.producto);
          return;
        }
      }
      setSaving(false);
      toast.success("Producto creado");
      onSaved(res.producto);
      return;
    }

    const res = await updateProducto(producto!.id, payload);
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Producto actualizado");
    onSaved({ ...producto!, ...payload } as Producto);
  };

  const handleDelete = async () => {
    if (!producto) return;
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
          <Input
            value={nombre}
            onChange={(e) => setNombre(capitalizeText(e.target.value))}
            placeholder="Nombre del producto"
            className="text-xl font-black tracking-tight h-auto py-1 w-full"
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Tipo</Label>
              <div className="font-medium capitalize py-2">{tipo}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Categoría *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {/* Si la categoría actual no está en el catálogo, la incluimos para no perderla. */}
                  {(categoria && !categorias.includes(categoria)
                    ? [categoria, ...categorias]
                    : categorias
                  ).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                    {catalogos.conservaciones.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {esVenta && (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Partida</Label>
                <Select
                  value={partida || "none"}
                  onValueChange={(v) => setPartida(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={partidasOpts.length === 0 ? "Sin partidas" : "Seleccionar"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {partidasOpts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Unidad *</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {catalogos.unidades.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mostrarFormato && !(isNew && esCompra) && (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Formato</Label>
                {esCompra && usarVigente ? (
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                    {formato || <span className="italic">Sin formato vigente</span>}
                  </div>
                ) : (
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
                )}
              </div>
            )}
            {esCompra && !isNew ? (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Proveedor</Label>
                {usarVigente ? (
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                    {proveedor || <span className="italic">Sin proveedor vigente</span>}
                  </div>
                ) : (
                  <ProveedorCombobox value={proveedor} onChange={setProveedor} />
                )}
              </div>
            ) : esCompra && isNew ? null : esElaboracion ? (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Coste</Label>
                <Input value={coste} onChange={(e) => setCoste(e.target.value)} placeholder="Ej: 6,20 €" />
              </div>
            ) : (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Coste (escandallo)</Label>
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                  {costeCalc !== null && costeCalc > 0
                    ? `${costeCalc.toFixed(2)} €`
                    : <span className="italic">Sin escandallo</span>}
                </div>
              </div>
            )}
            {mostrarIva && !esCompra && (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">IVA</Label>
                <Select value={iva || "none"} onValueChange={setIva}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {catalogos.ivas.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!esCompra && !isNew && (
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Últ. actualización</Label>
                <div className="font-medium py-2">{producto!.ultimaActualizacion}</div>
              </div>
            )}
          </div>

          {esCompra && !isNew && (
            <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={usarVigente}
                onCheckedChange={(v) => setUsarVigente(v === true)}
                className="mt-0.5"
              />
              <span>
                Coger unidad, formato y proveedor del precio vigente
                <span className="block text-[11px] opacity-80">
                  Si lo activas, estos campos se rellenan automáticamente con el precio de compra vigente y se actualizan cuando cambia. Desactívalo para editarlos a mano.
                </span>
              </span>
            </label>
          )}

          <AtenciónModal messages={errors} onClose={() => setErrors([])} />
        </CardContent>
      </Card>

      {/* Precios de compra: en alta capturamos el primer precio inline y se persiste
          tras crear el producto. En edición, histórico completo con PreciosCompraSection. */}
      {esCompra && isNew && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Primer precio de compra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Proveedor *</Label>
                <ProveedorCombobox value={proveedor} onChange={setProveedor} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Precio (sin IVA)</Label>
                <Input
                  value={precioInicial}
                  onChange={(e) => setPrecioInicial(e.target.value)}
                  placeholder="Ej: 12,50"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">IVA</Label>
                <Select value={iva || "none"} onValueChange={(v) => setIva(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {catalogos.ivas.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground italic">
              Al guardar, este precio queda registrado como vigente. Después podrás añadir más entradas en el histórico.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Histórico de precios de compra (solo productos de tipo compra ya creados) */}
      {esCompra && !isNew && (
        <>
          <PreciosCompraSection
            productoId={producto!.id}
            unidad={unidad}
            onCurrentChange={(vig) => {
              setVigenteSnapshot({
                proveedor: vig?.proveedor ?? "",
                formato: vig?.formato ?? "",
              });
              setVigenteLoaded(true);
            }}
            onItemsChange={() => setPreciosVersion((v) => v + 1)}
          />
          <PreciosPorProveedorSection
            productoId={producto!.id}
            refreshKey={preciosVersion}
          />
        </>
      )}

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
                  placeholder={producto?.nombre ?? nombre}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Texto para comanda</Label>
                <Input
                  value={textoComanda}
                  onChange={(e) => setTextoComanda(e.target.value)}
                  placeholder={producto?.nombre ?? nombre}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Texto para Punto de Venta — solo productos de venta ya creados */}
      {esVenta && !isNew && (
        <EstiloProductoVenta
          productoId={producto!.id}
          empresaId={empresaActual.id}
          nombre={nombre.trim() || producto!.nombre}
          estiloColor={estiloColor}
          estiloImagenUrl={estiloImagenUrl}
          onChange={({ estiloColor: c, estiloImagenUrl: u }) => {
            setEstiloColor(c);
            setEstiloImagenUrl(u);
          }}
        />
      )}

      {/* Alérgenos — Compra: fuente de verdad editable. Elaboración: derivados del escandallo (readonly). */}
      {esCompra && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Alérgenos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Marca los alérgenos UE que contiene este producto. Se propagan automáticamente a las elaboraciones y escandallos que lo usen como ingrediente.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {ALERGENOS_UE_14.map((a) => {
                const checked = alergenos.includes(a);
                return (
                  <label
                    key={a}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setAlergenos((prev) =>
                          v === true
                            ? Array.from(new Set([...prev, a]))
                            : prev.filter((x) => x !== a),
                        );
                      }}
                    />
                    <span className="select-none">{a}</span>
                  </label>
                );
              })}
            </div>
            {alergenos.length === 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground italic">
                Sin alérgenos marcados. Si el producto no contiene ninguno, déjalo así.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {esElaboracion && !isNew && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Alérgenos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Se derivan automáticamente del escandallo: unión de los alérgenos de los ingredientes (compra) y de cualquier sub-elaboración. Para modificarlos, edita los alérgenos del producto de compra origen.
            </p>
            {alergenosLoading ? (
              <p className="text-xs text-muted-foreground italic">Calculando…</p>
            ) : alergenosDerivados.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Sin alérgenos detectados en los ingredientes del escandallo.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {alergenosDerivados.map((a) => (
                    <Badge key={a} variant="outline" className="text-[11px] bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/40">
                      {a}
                    </Badge>
                  ))}
                </div>

                {alergenosOrigenes.length > 0 && (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Alérgeno</th>
                          <th className="text-left px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Origen</th>
                          <th className="text-left px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Tipo</th>
                          <th className="px-3 py-2 w-12" />
                        </tr>
                      </thead>
                      <tbody>
                        {alergenosOrigenes.map((o, i) => {
                          const tipoLabel = o.origenTipo === "compra" ? "Compra" : o.origenTipo === "elaboracion" ? "Elaboración" : "Venta";
                          return (
                            <tr key={`${o.alergeno}-${o.origenId}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-3 py-2 font-medium">{o.alergeno}</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => router.push(`${pathname}?p=${o.origenId}`)}
                                  className="text-primary hover:underline text-left"
                                >
                                  {o.origenNombre}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{tipoLabel}</td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => router.push(`${pathname}?p=${o.origenId}`)}
                                  title="Abrir ficha del producto"
                                >
                                  <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
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

      {/* Escandallo para productos de venta y elaboraciones ya creados */}
      {!isNew && (tipo === "venta" || tipo === "elaboracion") && (
        <EscandalloEditor productoVentaId={producto!.id} precioVenta={producto!.precioVenta ?? undefined} />
      )}

      {/* Tarifas — solo productos de venta ya creados */}
      {!isNew && esVenta && (
        <TarifaPreciosSection productoId={producto!.id} />
      )}

      {/* Conexión con Ágora — productos de venta ya creados */}
      {!isNew && esVenta && (
        <ConexionAgoraSection productoId={producto!.id} />
      )}

      {/* Movimientos de stock (kardex) — productos ya creados */}
      {!isNew && (
        <MovimientosStockSection productoId={producto!.id} unidad={unidad} />
      )}

      {!isNew && (
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" /> Eliminar producto
          </Button>
        </div>
      )}
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
  const catalogos = useCatalogosLogistica();
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
    tipo === "venta" || tipo === "elaboracion"
      ? { iva: false }
      : {},
  );
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [importadorIAOpen, setImportadorIAOpen] = useState(false);

  const esCompra = tipo === "compra";
  const esVenta = tipo === "venta";
  const esElaboracion = tipo === "elaboracion";
  const mostrarConservacion = !esVenta;
  const mostrarIva = !esElaboracion;
  const mostrarFormato = esCompra || esElaboracion;

  useEffect(() => {
    setColumnasVisibles(
      tipo === "venta" || tipo === "elaboracion"
        ? { iva: false }
        : {},
    );
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

  const columnasDef: ToolbarColumna[] = [
    { campo: "numero", label: "ID", bloqueada: true },
    { campo: "nombre", label: "Nombre", bloqueada: true },
    { campo: "categoria", label: "Categoría" },
    ...(mostrarConservacion ? [{ campo: "conservacion", label: "Conservación" }] : []),
    ...(esVenta ? [{ campo: "partida", label: "Partida" }] : []),
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
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: Producto) => ReactNode }> = {
    numero: {
      th: <TableColumnHeader key="numero" label="ID" />,
      td: (p) => (
        <td key="numero" className="px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
          {p.numeroSecuencial ?? "—"}
        </td>
      ),
    },
    nombre: {
      th: (
        <TableColumnHeader
          key="nombre"
          label="Nombre"
          campo="nombre"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="nombre" className="px-3 py-1.5 font-semibold text-primary whitespace-nowrap">
          {p.nombre}
        </td>
      ),
    },
    categoria: {
      th: (
        <TableColumnHeader
          key="categoria"
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
      ),
      td: (p) => (
        <td key="categoria" className="px-3 py-1.5 text-muted-foreground">
          {p.categoria || "—"}
        </td>
      ),
    },
    conservacion: {
      th: (
        <TableColumnHeader
          key="conservacion"
          label="Conservación"
          campo="conservacion"
          filtroTipo="lista"
          opciones={catalogos.conservaciones}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="conservacion" className="px-3 py-1.5 text-muted-foreground">
          {p.conservacion ?? "—"}
        </td>
      ),
    },
    partida: {
      th: (
        <TableColumnHeader
          key="partida"
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
      ),
      td: (p) => (
        <td key="partida" className="px-3 py-1.5 text-muted-foreground">
          {p.partida ?? "—"}
        </td>
      ),
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
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
      ),
      td: (p) => (
        <td key="estado" className="px-3 py-1.5">
          <EstadoBadge estado={p.estado} />
        </td>
      ),
    },
    proveedor: {
      th: (
        <TableColumnHeader
          key="proveedor"
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
      ),
      td: (p) => (
        <td key="proveedor" className="px-3 py-1.5 text-muted-foreground">
          {p.proveedor ?? "—"}
        </td>
      ),
    },
    precio: {
      th: (
        <TableColumnHeader
          key="precio"
          label={esCompra ? "Precio compra" : esElaboracion ? "Precio de elaboración" : "Precio de venta"}
          campo="precio"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="precio" className="px-3 py-1.5 font-medium text-foreground">
          {(esCompra ? p.precioCompra : p.precioVenta) ?? "—"}
        </td>
      ),
    },
    coste: {
      th: <TableColumnHeader key="coste" label="Coste" />,
      td: (p) => (
        <td key="coste" className="px-3 py-1.5 text-muted-foreground">
          {p.coste ?? "—"}
        </td>
      ),
    },
    porcCoste: {
      th: <TableColumnHeader key="porcCoste" label="% Coste" />,
      td: (p) => (
        <td key="porcCoste" className="px-3 py-1.5">
          <PorcCosteBadge
            coste={p.coste}
            precioVenta={p.precioVenta}
            umbralVerde={umbralVerde}
            umbralNaranja={umbralNaranja}
          />
        </td>
      ),
    },
    iva: {
      th: <TableColumnHeader key="iva" label="IVA" />,
      td: (p) => (
        <td key="iva" className="px-3 py-1.5 text-muted-foreground">
          {p.iva ?? "—"}
        </td>
      ),
    },
    unidad: {
      th: (
        <TableColumnHeader
          key="unidad"
          label="Unidad"
          campo="unidad"
          filtroTipo="lista"
          opciones={unidadesUsadas}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (p) => (
        <td key="unidad" className="px-3 py-1.5 text-muted-foreground">
          {p.unidad}
        </td>
      ),
    },
    formato: {
      th: <TableColumnHeader key="formato" label="Formato" />,
      td: (p) => (
        <td key="formato" className="px-3 py-1.5 text-muted-foreground">
          {p.formato ?? "—"}
        </td>
      ),
    },
    fecha: {
      th: (
        <TableColumnHeader
          key="fecha"
          label="Actualización"
          campo="fecha"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="fecha" className="px-3 py-1.5 text-xs text-muted-foreground">
          {p.ultimaActualizacion}
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={onAddClick}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
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
              onCustomImport={() => setImportadorIAOpen(true)}
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
              {columnasRender.map((c) => columnDefs[c.campo]?.th)}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr
                key={p.id}
                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onRowClick(p)}
              >
                {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
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

      <ImportadorIADialog
        open={importadorIAOpen}
        onOpenChange={setImportadorIAOpen}
        tipo={tipo}
        onImportSuccess={() => window.location.reload()}
      />
    </div>
  );
}

/* ─── CONFIGURACIÓN ─── */
/* ─── HOOK: config persistente en Supabase ─── */
function useProductConfig(tipo: TipoProducto) {
  const [categorias, setCatRaw] = useState<string[]>([]);
  const [estados, setEstRaw] = useState<string[]>([...ESTADOS_PRODUCTO]);
  const [umbralVerde, setUmbralVerdeRaw] = useState<number>(30);
  const [umbralNaranja, setUmbralNaranjaRaw] = useState<number>(40);
  const [reloadCatKey, setReloadCatKey] = useState(0);

  useEffect(() => {
    setCatRaw([]);
    let cancelled = false;
    Promise.all([
      // Categorías ahora viven en la tabla `categorias_producto` (catálogo cerrado).
      // Para crear/renombrar/borrar, ver GestorCategoriasProducto en el panel Configuración.
      listCategoriasProducto(tipo),
      getProductoConfigSection("global", "estados"),
      getProductoConfigSection("venta", "umbral_coste"),
    ]).then(([catsRes, ests, umbral]) => {
      if (cancelled) return;
      setCatRaw(catsRes.ok ? catsRes.data.map((c) => c.nombre) : []);
      setEstRaw(ests);
      const v = parseFloat(umbral?.[0] ?? "30");
      const n = parseFloat(umbral?.[1] ?? "40");
      if (!Number.isNaN(v)) setUmbralVerdeRaw(v);
      if (!Number.isNaN(n)) setUmbralNaranjaRaw(n);
    });
    return () => { cancelled = true; };
  }, [tipo, reloadCatKey]);

  const reloadCategorias = () => setReloadCatKey((k) => k + 1);
  const setEstados = async (v: string[]) => {
    setEstRaw(v);
    await saveProductoConfigSection("global", "estados", v);
  };
  const setUmbrales = async (verde: number, naranja: number) => {
    setUmbralVerdeRaw(verde);
    setUmbralNaranjaRaw(naranja);
    await saveProductoConfigSection("venta", "umbral_coste", [String(verde), String(naranja)]);
  };

  return { categorias, reloadCategorias, estados, setEstados, umbralVerde, umbralNaranja, setUmbrales };
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
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Precio coste</h4>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Define los umbrales de coste sobre PVP que pintan cada producto en verde (saludable), naranja (aviso) o rojo (margen insuficiente).
          </p>
        </div>
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
  tipo, onCategoriasChanged,
  mostrarUmbralCoste = false, umbralVerde = 30, umbralNaranja = 40, onUmbralesChange,
}: {
  tipo: TipoProducto;
  onCategoriasChanged: () => void;
  mostrarUmbralCoste?: boolean;
  umbralVerde?: number;
  umbralNaranja?: number;
  onUmbralesChange?: (verde: number, naranja: number) => void;
}) {
  return (
    <div className="space-y-6">
      <GestorCategoriasProducto tipo={tipo} onChanged={onCategoriasChanged} />

      {/* ── Catálogos transversales (mismos para los 3 tipos de producto) ── */}
      <GestorCatalogoEstandar
        titulo="Unidades de medida"
        hint="Unidades base con las que se miden los productos (kg, L, ud…). Vienen 3 estándar; añade más si las necesitas."
        campos={[
          { key: "codigo", label: "Unidad (kg, L, ud…)", obligatorio: true, ancho: "flex-1" },
        ]}
        itemPrincipal={(it) => it.codigo}
        itemSecundario={() => null}
        itemAPatch={(it) => ({ codigo: it.codigo })}
        list={listUnidadesMedida}
        create={(input) => createUnidadMedida({ codigo: input.codigo, label: input.codigo })}
        update={(id, patch) => updateUnidadMedida(id, { codigo: patch.codigo, label: patch.codigo })}
        remove={deleteUnidadMedida}
        iaConfig={{
          titulo: "Importar unidades de medida con IA",
          campos: [
            { key: "codigo", label: "Código", obligatorio: true, tipo: "texto" },
            { key: "label", label: "Etiqueta", obligatorio: false, tipo: "texto" },
          ],
          analyze: analizarUnidadesIA,
          save: guardarUnidadesIA,
        }}
      />

      <GestorCatalogoEstandar
        titulo="IVA"
        hint="Tipos impositivos aplicables. España viene con los 4 estándar; añade otros si vendes en otros países."
        campos={[
          { key: "porcentaje", label: "IVA (ej: 10)", obligatorio: true, ancho: "w-32" },
          { key: "label", label: "Etiqueta (ej: Reducido)", ancho: "flex-1" },
        ]}
        itemPrincipal={(it) => `${it.porcentaje}%`}
        itemSecundario={(it) => it.label}
        itemAPatch={(it) => ({ porcentaje: String(it.porcentaje), label: it.label ?? "" })}
        list={listIvas}
        create={(input) => {
          const pct = parseFloat(input.porcentaje.replace(",", ".")) || 0;
          return createIva({ codigo: `${pct}%`, porcentaje: pct, label: input.label });
        }}
        update={(id, patch) => {
          const pct =
            patch.porcentaje !== undefined ? parseFloat(patch.porcentaje.replace(",", ".")) : undefined;
          return updateIva(id, {
            codigo: pct !== undefined ? `${pct}%` : undefined,
            porcentaje: pct,
            label: patch.label || null,
          });
        }}
        remove={deleteIva}
        iaConfig={{
          titulo: "Importar tipos de IVA con IA",
          campos: [
            { key: "codigo", label: "Código", obligatorio: true, tipo: "texto" },
            { key: "porcentaje", label: "%", obligatorio: true, tipo: "texto" },
            { key: "label", label: "Etiqueta", obligatorio: false, tipo: "texto" },
          ],
          analyze: analizarIvasIA,
          save: guardarIvasIA,
        }}
      />

      <GestorCatalogoEstandar
        titulo="Conservación"
        hint="Zonas de almacenaje según temperatura (APPCC). Vienen las 4 estándar."
        campos={[
          { key: "nombre", label: "Nombre", obligatorio: true, ancho: "flex-1" },
          { key: "rangoTemp", label: "Rango (ej: 0–8 °C)", ancho: "w-44" },
        ]}
        itemPrincipal={(it) => it.nombre}
        itemSecundario={(it) => it.rango_temp}
        itemAPatch={(it) => ({ nombre: it.nombre, rangoTemp: it.rango_temp ?? "" })}
        list={listConservaciones}
        create={(input) => createConservacion({ nombre: input.nombre, rangoTemp: input.rangoTemp })}
        update={(id, patch) => updateConservacion(id, { nombre: patch.nombre, rangoTemp: patch.rangoTemp ?? null })}
        remove={deleteConservacion}
        iaConfig={{
          titulo: "Importar modos de conservación con IA",
          campos: [
            { key: "nombre", label: "Nombre", obligatorio: true, tipo: "texto" },
            { key: "rangoTemp", label: "Rango temperatura", obligatorio: false, tipo: "texto" },
          ],
          analyze: analizarConservacionesIA,
          save: guardarConservacionesIA,
        }}
      />

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


/* ─── PÁGINA PRINCIPAL ─── */
export function ProductosView() {
  const [tipoActivo, setTipoActivo] = useState<TipoProducto>("compra");
  const [showConfig, setShowConfig] = useState(false);
  const [detalle, setDetalle] = useState<Producto | null>(null);
  // Cuando es true, ProductoDetalle entra en modo "alta" (sin producto.id).
  // El producto solo se persiste al pulsar Guardar (evita huecos en el nº secuencial).
  const [nuevoModo, setNuevoModo] = useState(false);
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

  // Deep-link: ?p=<id> abre la ficha del producto. Usado por enlaces desde Alérgenos origen.
  const searchParams = useSearchParams();
  useEffect(() => {
    const pid = searchParams.get("p");
    if (!pid || detalle?.id === pid) return;
    (async () => {
      const p = await getProductoById(pid);
      if (p) {
        setTipoActivo(p.tipo);
        setDetalle(p);
        setShowConfig(false);
        setNuevoModo(false);
      }
    })();
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerReload = () => setReloadKey((k) => k + 1);

  if (detalle || nuevoModo) {
    return (
      <div className="p-4 md:p-6">
        <ProductoDetalle
          key={detalle?.id ?? "nuevo"}
          producto={detalle}
          tipo={detalle?.tipo ?? tipoActivo}
          onBack={() => { setDetalle(null); setNuevoModo(false); }}
          onSaved={(p) => { setDetalle(p); setNuevoModo(false); triggerReload(); }}
          onDeleted={() => { setDetalle(null); setNuevoModo(false); triggerReload(); }}
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
          variant={tipoActivo === "elaboracion" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("elaboracion"); setShowConfig(false); }}
        >
          <FlaskConical className="h-4 w-4" />
          ELABORACIONES
          <Badge variant="secondary" className="text-[10px] ml-1">{countElab}</Badge>
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

      </div>

      {showConfig ? (
        <div className="bg-card border rounded-lg p-5">
          <ConfigProductos
            tipo={tipoActivo}
            onCategoriasChanged={config.reloadCategorias}
            mostrarUmbralCoste={tipoActivo === "venta"}
            umbralVerde={config.umbralVerde}
            umbralNaranja={config.umbralNaranja}
            onUmbralesChange={config.setUmbrales}
          />
        </div>
      ) : (
        <TablaProductos
          tipo={tipoActivo}
          onAddClick={() => setNuevoModo(true)}
          onRowClick={(p) => setDetalle(p)}
          reloadKey={reloadKey}
          showConfig={showConfig}
          onToggleConfig={() => setShowConfig((v) => !v)}
          umbralVerde={config.umbralVerde}
          umbralNaranja={config.umbralNaranja}
        />
      )}
    </div>
  );
}
