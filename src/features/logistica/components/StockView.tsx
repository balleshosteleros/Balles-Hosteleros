"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getStockConTemporada,
  CATEGORIAS_STOCK, type ProductoStock, type TemporadaStock,
} from "@/features/logistica/data/stock";
import { listTemporadas } from "@/features/logistica/actions/temporadas-actions";
import { listStock, updateStock as updateStockAction, updateStockBatch } from "@/features/logistica/actions/stock-actions";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import TemporadasConfig from "@/features/logistica/components/stock/TemporadasConfig";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  Search, ArrowUpDown, Pencil, Check, X, Sun, Settings, ChevronDown,
} from "lucide-react";
import { FiltrosAvanzados, type FiltroActivo, type CampoFiltro } from "@/features/logistica/components/FiltrosAvanzados";
import { ImportExportButton } from "@/features/logistica/components/ImportExportButton";
import { exportToCSV, exportToXLSX } from "@/features/logistica/lib/export-utils";
import { toast } from "sonner";

type CampoStock = "categoria" | "estadoStock" | "unidad";
type MassAction = "pct" | "fixed" | "set" | "copy" | "copiar-temporada" | "consumption";
type MassField = "stockMaximo" | "stockSeguridad";

function stockStatus(actual: number, seguridad: number): "critical" | "warning" | "ok" {
  if (actual < seguridad) return "critical";
  if (actual <= seguridad * 1.3) return "warning";
  return "ok";
}

const statusColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300",
};
const statusLabels: Record<string, string> = { critical: "BAJO", warning: "ATENCIÓN", ok: "OK" };

function InventarioBadge({ value }: { value: number }) {
  if (value > 0) return <span className="text-emerald-700 dark:text-emerald-400 font-semibold">+{value}</span>;
  if (value < 0) return <span className="text-red-700 dark:text-red-400 font-semibold">{value}</span>;
  return <span className="text-muted-foreground font-medium">0</span>;
}

export function StockView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("logistica_last", pathname); }, [pathname]);

  const { empresaActual } = useEmpresa();
  const [stock, setStock] = useState<ProductoStock[]>([]);
  const [temporadas, setTemporadas] = useState<TemporadaStock[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);

  const loadStockData = useCallback(async () => {
    setLoadingStock(true);
    try {
      const [stockRes, productos] = await Promise.all([
        listStock(),
        listProductos("compra"),
      ]);
      const stockByProductoId = new Map<string, { id: string; cantidad: number; minima: number; maxima: number }>();
      const stockByNombre = new Map<string, { id: string; cantidad: number; minima: number; maxima: number }>();
      if (stockRes.ok) {
        for (const r of stockRes.data as Array<Record<string, unknown>>) {
          const entry = {
            id: r.id as string,
            cantidad: Number(r.cantidad_actual ?? 0),
            minima: Number(r.cantidad_minima ?? 0),
            maxima: Number(r.cantidad_maxima ?? 0),
          };
          if (r.producto_id) stockByProductoId.set(r.producto_id as string, entry);
          if (r.producto_nombre) stockByNombre.set(String(r.producto_nombre).toLowerCase(), entry);
        }
      }
      const merged: ProductoStock[] = productos.map((p) => {
        const s = stockByProductoId.get(p.id) ?? stockByNombre.get(p.nombre.toLowerCase());
        return {
          id: s?.id ?? p.id,
          nombre: p.nombre,
          categoria: p.categoria || "Otros",
          unidad: p.unidad,
          stockMaximo: s?.maxima ?? 0,
          stockSeguridad: s?.minima ?? 0,
          stockActual: s?.cantidad ?? 0,
          ultimoInventario: 0,
          ultimoInventarioFecha: null,
          empresaId: empresaActual.id,
        };
      });
      setStock(merged);
    } catch (err) {
      console.error("Error cargando stock:", err);
      setStock([]);
    } finally {
      setLoadingStock(false);
    }
    listTemporadas().then((res) => {
      if (res.ok) setTemporadas(res.data);
    });
  }, [empresaActual.id]);

  useEffect(() => { loadStockData(); }, [loadStockData]);

  const [temporadaSeleccionada, setTemporadaSeleccionada] = useState<string>("base");
  const [tempPopoverOpen, setTempPopoverOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const temporadaActiva = useMemo(() => {
    if (temporadaSeleccionada === "base") return null;
    return temporadas.find((t) => t.id === temporadaSeleccionada) || null;
  }, [temporadaSeleccionada, temporadas]);

  const temporadaLabel = useMemo(() => {
    if (temporadaSeleccionada === "base") return "Base";
    return temporadas.find((t) => t.id === temporadaSeleccionada)?.nombre ?? "Base";
  }, [temporadaSeleccionada, temporadas]);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<FiltroActivo<CampoStock>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ stockMaximo: number; stockSeguridad: number }>({ stockMaximo: 0, stockSeguridad: 0 });

  // Mass edit
  const [massOpen, setMassOpen] = useState(false);
  const [massAction, setMassAction] = useState<MassAction>("pct");
  const [massField, setMassField] = useState<MassField>("stockMaximo");
  const [massValue, setMassValue] = useState("");
  const [massCopyFrom, setMassCopyFrom] = useState<MassField>("stockMaximo");
  const [massCopyTo, setMassCopyTo] = useState<MassField>("stockSeguridad");
  const [massCopyTempFrom, setMassCopyTempFrom] = useState<string>("");
  const [massCopyTempTo, setMassCopyTempTo] = useState<string>("");

  // Enrich stock with season overrides for display
  const enriched = useMemo(() => stock.map((p) => {
    const s = getStockConTemporada(p, temporadaActiva);
    return { ...p, displayMaximo: s.stockMaximo, displaySeguridad: s.stockSeguridad, esTemporada: s.esTemporada };
  }), [stock, temporadaActiva]);

  const camposFiltro = useMemo((): CampoFiltro<CampoStock>[] => {
    const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
    return [
      { campo: "categoria", label: "Categoría", tipo: "lista", opciones: CATEGORIAS_STOCK as string[] },
      { campo: "estadoStock", label: "Estado stock", tipo: "lista", opciones: ["Stock bajo", "Atención", "Correcto"] },
      { campo: "unidad", label: "Unidad", tipo: "lista", opciones: uniq(enriched.map((p) => p.unidad)) },
    ];
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((p) => {
      const st = stockStatus(p.stockActual, p.displaySeguridad);
      for (const f of filtros) {
        if (f.campo === "categoria" && f.valores?.length && !f.valores.includes(p.categoria)) return false;
        if (f.campo === "unidad" && f.valores?.length && !f.valores.includes(p.unidad)) return false;
        if (f.campo === "estadoStock" && f.valores?.length) {
          const label = st === "critical" ? "Stock bajo" : st === "warning" ? "Atención" : "Correcto";
          if (!f.valores.includes(label)) return false;
        }
      }
      if (search) {
        const s = search.toLowerCase();
        return p.nombre.toLowerCase().includes(s) || p.categoria.toLowerCase().includes(s);
      }
      return true;
    });
  }, [enriched, search, filtros]);

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  // Inline edit
  const startEdit = (p: typeof enriched[0]) => {
    setEditingId(p.id);
    setEditValues({ stockMaximo: p.displayMaximo, stockSeguridad: p.displaySeguridad });
  };
  const saveEdit = async () => {
    if (!editingId) return;
    if (temporadaActiva && temporadaActiva.overrides[editingId]) {
      setTemporadas((prev) => prev.map((t) =>
        t.id === temporadaActiva.id
          ? { ...t, overrides: { ...t.overrides, [editingId]: { stockMaximo: editValues.stockMaximo, stockSeguridad: editValues.stockSeguridad } } }
          : t
      ));
    } else {
      setStock((prev) => prev.map((p) => p.id === editingId ? { ...p, stockMaximo: editValues.stockMaximo, stockSeguridad: editValues.stockSeguridad } : p));
    }
    const savedId = editingId;
    setEditingId(null);
    const res = await updateStockAction(savedId, {
      cantidad_minima: editValues.stockSeguridad,
      cantidad_maxima: editValues.stockMaximo,
    });
    if (res.ok) toast.success("Valores actualizados");
    else { toast.error("Error al actualizar stock"); loadStockData(); }
  };
  const cancelEdit = () => setEditingId(null);

  // Mass edit
  const applyMassEdit = async () => {
    if (selected.size === 0) { toast.info("Selecciona al menos un producto"); return; }

    // Copy between temporadas (solo local — temporadas son configuración visual)
    if (massAction === "copiar-temporada") {
      if (!massCopyTempFrom || !massCopyTempTo) { toast.error("Selecciona temporada origen y destino"); return; }
      if (massCopyTempFrom === massCopyTempTo) { toast.error("Origen y destino deben ser diferentes"); return; }
      const sourceTemp = massCopyTempFrom === "base" ? null : temporadas.find((t) => t.id === massCopyTempFrom);
      setTemporadas((prev) => prev.map((t) => {
        if (t.id !== massCopyTempTo) return t;
        const newOverrides = { ...t.overrides };
        for (const prodId of selected) {
          const prod = stock.find((p) => p.id === prodId);
          if (!prod) continue;
          const srcVal = sourceTemp?.overrides[prodId] ?? { stockMaximo: prod.stockMaximo, stockSeguridad: prod.stockSeguridad };
          newOverrides[prodId] = { ...srcVal };
        }
        return { ...t, overrides: newOverrides };
      }));
      const targetName = temporadas.find((t) => t.id === massCopyTempTo)?.nombre ?? "temporada";
      toast.success(`Stock copiado a ${targetName} para ${selected.size} producto(s)`);
      setMassOpen(false);
      return;
    }

    const val = parseFloat(massValue);
    const apply = (current: number): number => {
      if (massAction === "pct" && !isNaN(val)) return Math.max(0, Math.round(current * (1 + val / 100) * 100) / 100);
      if (massAction === "fixed" && !isNaN(val)) return Math.max(0, Math.round((current + val) * 100) / 100);
      if (massAction === "set" && !isNaN(val)) return Math.max(0, val);
      return current;
    };

    // Calcular nuevos valores primero para poder persistirlos
    const updates: { id: string; cantidad_minima: number; cantidad_maxima: number }[] = [];
    const updatedStock = stock.map((p) => {
      if (!selected.has(p.id)) return p;
      const updated = { ...p };
      if (massAction === "copy") {
        updated[massCopyTo] = updated[massCopyFrom];
      } else if (massAction === "consumption") {
        if (updated.stockActual < updated.stockSeguridad) {
          updated.stockMaximo = Math.round(updated.stockMaximo * 1.2 * 100) / 100;
          updated.stockSeguridad = Math.round(updated.stockSeguridad * 1.15 * 100) / 100;
        } else if (updated.stockActual > updated.stockMaximo * 0.9) {
          updated.stockMaximo = Math.round(updated.stockMaximo * 0.9 * 100) / 100;
        }
      } else {
        updated[massField] = apply(updated[massField]);
      }
      updates.push({ id: p.id, cantidad_minima: updated.stockSeguridad, cantidad_maxima: updated.stockMaximo });
      return updated;
    });

    setStock(updatedStock);
    setMassOpen(false);
    setMassValue("");

    const res = await updateStockBatch(updates);
    if (res.ok) {
      toast.success(`Edición masiva guardada para ${selected.size} producto(s)`);
    } else {
      toast.error("Error al guardar en base de datos");
      loadStockData();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
            {/* Temporada picker */}
            <Popover open={tempPopoverOpen} onOpenChange={setTempPopoverOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <ChevronDown className="h-4 w-4" />
                  {temporadaLabel === "Base" ? "Temporada" : temporadaLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="start">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">Ver temporada</p>
                {/* Valores base siempre disponible */}
                <button
                  onClick={() => { setTemporadaSeleccionada("base"); setTempPopoverOpen(false); }}
                  className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md transition-colors ${
                    temporadaSeleccionada === "base" || !temporadas.find((t) => t.id === temporadaSeleccionada)
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted"
                  }`}
                >
                  Base
                </button>
                {temporadas.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTemporadaSeleccionada(t.id); setTempPopoverOpen(false); }}
                    className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md transition-colors ${
                      temporadaSeleccionada === t.id
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-muted"
                    }`}
                  >
                    {t.nombre}
                  </button>
                ))}
                {temporadas.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2 italic">Sin temporadas — configura una con ⚙️</p>
                )}
              </PopoverContent>
            </Popover>

            {/* Edición masiva */}
            <Button size="sm" variant="outline" className="gap-1" disabled={selected.size === 0} onClick={() => setMassOpen(true)}>
              <ArrowUpDown className="h-4 w-4" />
              Edición masiva{selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>

            <div className="flex-1" />

            {/* Búsqueda */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            {/* Filtros */}
            <FiltrosAvanzados campos={camposFiltro} filtros={filtros} onChange={setFiltros} />

            {/* Importar / Exportar */}
            <ImportExportButton
              onExport={(format) => {
                const ts = new Date().toISOString().slice(0, 10);
                const rows = filtered.map((p) => ({
                  Producto: p.nombre, Categoría: p.categoria, Unidad: p.unidad,
                  "Stock Máximo": p.displayMaximo, "Stock Mínimo": p.displaySeguridad,
                  "Stock Actual": p.stockActual, "Stock Reposición": Math.max(0, p.displayMaximo - p.stockActual),
                }));
                if (rows.length === 0) { toast.info("No hay datos para exportar."); return; }
                if (format === "csv") exportToCSV(rows, `stock-${ts}.csv`);
                else exportToXLSX(rows, `stock-${ts}.xlsx`);
                toast.success(`${rows.length} filas exportadas en ${format.toUpperCase()}`);
              }}
            />

            {/* Configuración temporadas */}
            <Button size="icon" variant={showConfig ? "default" : "ghost"} className="h-8 w-8" onClick={() => setShowConfig((v) => !v)} title="Configuración" aria-label="Configuración">
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>

          {showConfig ? (
            <div className="bg-card border rounded-lg p-5">
              <TemporadasConfig
                temporadas={temporadas}
                setTemporadas={setTemporadas}
                productos={stock}
                empresaId={empresaActual.id}
                temporadaActiva={temporadaActiva}
              />
            </div>
          ) : (
            <>
              {/* Indicador temporada activa */}
              {temporadaActiva && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-md px-3 py-1.5">
                  <Sun className="h-3.5 w-3.5 shrink-0" />
                  <span>Mostrando valores de temporada <strong>{temporadaActiva.nombre}</strong> ({temporadaActiva.fechaInicio} → {temporadaActiva.fechaFin}). Los valores con <Sun className="inline h-3 w-3" /> son específicos de esta temporada.</span>
                </div>
              )}

              {/* Table */}
              <div className="bg-card rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-3 w-10">
                        <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                      </th>
                      {["Producto", "Categoría", "Unidad", "Stock Máximo", "Stock Mínimo", "Stock Actual", "Stock Reposición", "Estado", "Últ. Inventario", "Fecha Inv.", ""].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const st = stockStatus(p.stockActual, p.displaySeguridad);
                      const isEditing = editingId === p.id;
                      const reposicion = Math.max(0, p.displayMaximo - p.stockActual);
                      return (
                        <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-foreground">
                            {p.nombre}
                            {p.esTemporada && <Sun className="inline h-3 w-3 ml-1 text-primary" />}
                          </td>
                          <td className="px-3 py-2.5 text-xs">{p.categoria}</td>
                          <td className="px-3 py-2.5 text-xs">{p.unidad}</td>
                          {/* Stock Máximo */}
                          <td className="px-3 py-2.5 text-xs">
                            {isEditing
                              ? <Input type="number" className="h-7 w-20 text-xs" value={editValues.stockMaximo} onChange={(e) => setEditValues((v) => ({ ...v, stockMaximo: +e.target.value }))} />
                              : <span className="font-medium">{p.displayMaximo}</span>}
                          </td>
                          {/* Stock Mínimo */}
                          <td className="px-3 py-2.5 text-xs">
                            {isEditing
                              ? <Input type="number" className="h-7 w-20 text-xs" value={editValues.stockSeguridad} onChange={(e) => setEditValues((v) => ({ ...v, stockSeguridad: +e.target.value }))} />
                              : <span className="font-medium">{p.displaySeguridad}</span>}
                          </td>
                          {/* Stock Actual */}
                          <td className="px-3 py-2.5 text-xs">
                            <span className="font-bold text-foreground">{p.stockActual}</span>
                          </td>
                          {/* Stock Reposición */}
                          <td className="px-3 py-2.5 text-xs">
                            {reposicion > 0
                              ? <span className="font-medium text-amber-600 dark:text-amber-400">{reposicion}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          {/* Estado */}
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className={`text-[11px] font-bold px-2 py-0.5 ${statusColors[st]}`}>{statusLabels[st]}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-xs"><InventarioBadge value={p.ultimoInventario} /></td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{p.ultimoInventarioFecha || "—"}</td>
                          <td className="px-3 py-2.5">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-3.5 w-3.5 text-emerald-600" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                              </div>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={12} className="text-center py-12 text-muted-foreground">No se encontraron productos.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-muted-foreground text-right">{filtered.length} de {enriched.length} productos</div>
            </>
          )}
      </div>

      {/* Mass Edit Dialog */}
      <Dialog open={massOpen} onOpenChange={setMassOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edición masiva — {selected.size} producto(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Modifica Stock Máximo y/o Stock Mínimo de los productos seleccionados.
            </div>

            <div>
              <Label className="text-xs font-bold">Tipo de acción</Label>
              <Select value={massAction} onValueChange={(v) => setMassAction(v as MassAction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct">Por porcentaje (%)</SelectItem>
                  <SelectItem value="fixed">Por cantidad fija</SelectItem>
                  <SelectItem value="set">Igualar valor</SelectItem>
                  <SelectItem value="copy">Copiar campo</SelectItem>
                  {temporadas.length >= 2 && <SelectItem value="copiar-temporada">Copiar entre temporadas</SelectItem>}
                  <SelectItem value="consumption">Ajustar según consumo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(massAction === "pct" || massAction === "fixed" || massAction === "set") && (
              <>
                <div>
                  <Label className="text-xs font-bold">Campo a modificar</Label>
                  <Select value={massField} onValueChange={(v) => setMassField(v as MassField)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stockMaximo">Stock Máximo</SelectItem>
                      <SelectItem value="stockSeguridad">Stock Mínimo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold">
                    {massAction === "pct" ? "Porcentaje (ej: 10 para +10%, -15 para -15%)" :
                     massAction === "fixed" ? "Cantidad (ej: 5 para sumar, -2 para restar)" :
                     "Valor fijo para todos"}
                  </Label>
                  <Input type="number" value={massValue} onChange={(e) => setMassValue(e.target.value)} placeholder={massAction === "pct" ? "10" : "5"} />
                </div>
              </>
            )}

            {massAction === "copy" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">Copiar desde</Label>
                  <Select value={massCopyFrom} onValueChange={(v) => setMassCopyFrom(v as MassField)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stockMaximo">Stock Máximo</SelectItem>
                      <SelectItem value="stockSeguridad">Stock Mínimo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold">Copiar a</Label>
                  <Select value={massCopyTo} onValueChange={(v) => setMassCopyTo(v as MassField)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stockMaximo">Stock Máximo</SelectItem>
                      <SelectItem value="stockSeguridad">Stock Mínimo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {massAction === "copiar-temporada" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Copia los valores de Stock Máximo y Stock Mínimo de los productos seleccionados desde una temporada a otra.
                </p>
                <div>
                  <Label className="text-xs font-bold">Temporada origen</Label>
                  <Select value={massCopyTempFrom} onValueChange={setMassCopyTempFrom}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar origen…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Valores base</SelectItem>
                      {temporadas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold">Temporada destino</Label>
                  <Select value={massCopyTempTo} onValueChange={setMassCopyTempTo}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar destino…" /></SelectTrigger>
                    <SelectContent>
                      {temporadas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {massAction === "consumption" && (
              <p className="text-sm text-muted-foreground">
                Ajuste inteligente: aumenta stock máximo (+20%) y mínimo (+15%) en productos con stock actual por debajo del mínimo. Reduce stock máximo (-10%) en productos con stock cerca del máximo.
              </p>
            )}
          </div>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassOpen(false)}>Cancelar</Button>
            <Button onClick={applyMassEdit}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
