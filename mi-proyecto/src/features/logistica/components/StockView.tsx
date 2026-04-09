"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getStockPorEmpresa, getTemporadasPorEmpresa, getTemporadaActiva, getStockConTemporada,
  CATEGORIAS_STOCK, type ProductoStock, type TemporadaStock,
} from "@/features/logistica/data/stock";
import TemporadasConfig from "@/features/logistica/components/stock/TemporadasConfig";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Warehouse, ArrowUpDown, Pencil, Check, X, Lock, Sun, BarChart3,
} from "lucide-react";
import StockAnalytics from "@/features/logistica/components/stock/StockAnalytics";
import { toast } from "sonner";

const ALL = "__ALL__";
type StockFilter = "todos" | "bajo" | "alto" | "sin_inventario";
type MassAction = "pct" | "fixed" | "set" | "copy" | "consumption";
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
  const [stock, setStock] = useState<ProductoStock[]>(() => getStockPorEmpresa(empresaActual.id));
  const [temporadas, setTemporadas] = useState<TemporadaStock[]>(() => getTemporadasPorEmpresa(empresaActual.id));

  useMemo(() => {
    setStock(getStockPorEmpresa(empresaActual.id));
    setTemporadas(getTemporadasPorEmpresa(empresaActual.id));
  }, [empresaActual.id]);

  const temporadaAutoActiva = useMemo(() => getTemporadaActiva(temporadas), [temporadas]);
  const [temporadaSeleccionada, setTemporadaSeleccionada] = useState<string>("auto");

  // If "auto", use detected season; otherwise use manual selection
  const temporadaActiva = useMemo(() => {
    if (temporadaSeleccionada === "auto") return temporadaAutoActiva;
    if (temporadaSeleccionada === "base") return null;
    return temporadas.find((t) => t.id === temporadaSeleccionada) || null;
  }, [temporadaSeleccionada, temporadaAutoActiva, temporadas]);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(ALL);
  const [filterStatus, setFilterStatus] = useState<StockFilter>("todos");
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

  // Enrich stock with season overrides for display
  const enriched = useMemo(() => stock.map((p) => {
    const s = getStockConTemporada(p, temporadaActiva);
    return { ...p, displayMaximo: s.stockMaximo, displaySeguridad: s.stockSeguridad, esTemporada: s.esTemporada };
  }), [stock, temporadaActiva]);

  const filtered = useMemo(() => {
    return enriched.filter((p) => {
      if (filterCat !== ALL && p.categoria !== filterCat) return false;
      const st = stockStatus(p.stockActual, p.displaySeguridad);
      if (filterStatus === "bajo" && st !== "critical") return false;
      if (filterStatus === "alto" && p.stockActual < p.displayMaximo * 0.85) return false;
      if (filterStatus === "sin_inventario" && p.ultimoInventarioFecha) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.nombre.toLowerCase().includes(s) || p.categoria.toLowerCase().includes(s);
      }
      return true;
    });
  }, [enriched, search, filterCat, filterStatus]);

  const totalProducts = enriched.length;
  const criticalCount = enriched.filter((p) => stockStatus(p.stockActual, p.displaySeguridad) === "critical").length;
  const warningCount = enriched.filter((p) => stockStatus(p.stockActual, p.displaySeguridad) === "warning").length;
  const okCount = enriched.filter((p) => stockStatus(p.stockActual, p.displaySeguridad) === "ok").length;

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  // Inline edit – only stockMaximo & stockSeguridad
  const startEdit = (p: typeof enriched[0]) => {
    setEditingId(p.id);
    setEditValues({ stockMaximo: p.displayMaximo, stockSeguridad: p.displaySeguridad });
  };
  const saveEdit = () => {
    if (!editingId) return;
    if (temporadaActiva && temporadaActiva.overrides[editingId]) {
      // Update season override
      setTemporadas((prev) => prev.map((t) =>
        t.id === temporadaActiva.id
          ? { ...t, overrides: { ...t.overrides, [editingId]: { stockMaximo: editValues.stockMaximo, stockSeguridad: editValues.stockSeguridad } } }
          : t
      ));
    } else {
      setStock((prev) => prev.map((p) => p.id === editingId ? { ...p, stockMaximo: editValues.stockMaximo, stockSeguridad: editValues.stockSeguridad } : p));
    }
    setEditingId(null);
    toast.success("Valores actualizados");
  };
  const cancelEdit = () => setEditingId(null);

  // Mass edit – only stockMaximo & stockSeguridad
  const applyMassEdit = () => {
    if (selected.size === 0) { toast.info("Selecciona al menos un producto"); return; }
    const val = parseFloat(massValue);

    const apply = (current: number): number => {
      if (massAction === "pct" && !isNaN(val)) return Math.max(0, Math.round(current * (1 + val / 100) * 100) / 100);
      if (massAction === "fixed" && !isNaN(val)) return Math.max(0, Math.round((current + val) * 100) / 100);
      if (massAction === "set" && !isNaN(val)) return Math.max(0, val);
      return current;
    };

    setStock((prev) => prev.map((p) => {
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
      return updated;
    }));

    setMassOpen(false);
    setMassValue("");
    toast.success(`Edición masiva aplicada a ${selected.size} producto(s)`);
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Warehouse className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">STOCK</h1>
          <p className="text-sm text-muted-foreground">Control de stock de productos — {empresaActual.nombre}</p>
        </div>
        {temporadas.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Temporada:</span>
            <Select value={temporadaSeleccionada} onValueChange={setTemporadaSeleccionada}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Automática{temporadaAutoActiva ? ` (${temporadaAutoActiva.nombre})` : " (base)"}
                </SelectItem>
                <SelectItem value="base">Valores base (sin temporada)</SelectItem>
                {temporadas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre} ({t.fechaInicio} → {t.fechaFin})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {temporadaActiva && (
              <Badge className="bg-primary/10 text-primary border-primary/30 gap-1">
                <Sun className="h-3.5 w-3.5" /> {temporadaActiva.nombre}
              </Badge>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="analitica" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Analítica</TabsTrigger>
          <TabsTrigger value="temporadas">Temporadas</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-2xl font-black text-foreground">{totalProducts}</div>
              <div className="text-xs text-muted-foreground font-medium">PRODUCTOS</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-2xl font-black text-red-600 dark:text-red-400">{criticalCount}</div>
              <div className="text-xs text-muted-foreground font-medium">STOCK BAJO</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{warningCount}</div>
              <div className="text-xs text-muted-foreground font-medium">ATENCIÓN</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{okCount}</div>
              <div className="text-xs text-muted-foreground font-medium">CORRECTO</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-card rounded-lg border p-3">
            <Button size="sm" variant="outline" className="gap-1" disabled={selected.size === 0} onClick={() => setMassOpen(true)}>
              <ArrowUpDown className="h-4 w-4" /> Edición masiva ({selected.size})
            </Button>
            <div className="flex-1" />
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {CATEGORIAS_STOCK.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StockFilter)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="bajo">Stock bajo</SelectItem>
                <SelectItem value="alto">Cerca de máximo</SelectItem>
                <SelectItem value="sin_inventario">Sin inventario reciente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info banner */}
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>El <strong>stock actual</strong> solo se modifica mediante albaranes, ventas, elaboraciones o inventarios confirmados. Desde aquí puedes ajustar el <strong>stock máximo</strong> y <strong>stock de seguridad</strong>.</span>
          </div>

          {/* Table */}
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                  {["Producto", "Categoría", "Unidad", "Stock Máximo", "Stock Seguridad", "Stock Actual", "Estado", "Últ. Inventario", "Fecha Inv.", ""].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = stockStatus(p.stockActual, p.displaySeguridad);
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5"><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></td>
                      <td className="px-3 py-2.5 font-semibold text-foreground">
                        {p.nombre}
                        {p.esTemporada && <Sun className="inline h-3 w-3 ml-1 text-primary" />}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{p.categoria}</td>
                      <td className="px-3 py-2.5 text-xs">{p.unidad}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {isEditing
                          ? <Input type="number" className="h-7 w-20 text-xs" value={editValues.stockMaximo} onChange={(e) => setEditValues((v) => ({ ...v, stockMaximo: +e.target.value }))} />
                          : <span className="font-medium">{p.displayMaximo}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {isEditing
                          ? <Input type="number" className="h-7 w-20 text-xs" value={editValues.stockSeguridad} onChange={(e) => setEditValues((v) => ({ ...v, stockSeguridad: +e.target.value }))} />
                          : <span className="font-medium">{p.displaySeguridad}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="font-bold text-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                          {p.stockActual}
                        </span>
                      </td>
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
                  <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">No se encontraron productos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground text-right">{filtered.length} de {enriched.length} productos</div>
        </TabsContent>

        <TabsContent value="analitica">
          <StockAnalytics stock={stock} temporadaActiva={temporadaActiva} />
        </TabsContent>

        <TabsContent value="temporadas">
          <TemporadasConfig
            temporadas={temporadas}
            setTemporadas={setTemporadas}
            productos={stock}
            empresaId={empresaActual.id}
            temporadaActiva={temporadaActiva}
          />
        </TabsContent>
      </Tabs>

      {/* Mass Edit Dialog – only stockMaximo & stockSeguridad */}
      <Dialog open={massOpen} onOpenChange={setMassOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edición masiva — {selected.size} producto(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
              Solo se pueden modificar Stock Máximo y Stock Seguridad.
            </div>

            <div>
              <Label className="text-xs font-bold">Tipo de acción</Label>
              <Select value={massAction} onValueChange={(v) => setMassAction(v as MassAction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct">Por porcentaje (%)</SelectItem>
                  <SelectItem value="fixed">Por cantidad fija</SelectItem>
                  <SelectItem value="set">Igualar valor</SelectItem>
                  <SelectItem value="copy">Copiar referencia</SelectItem>
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
                      <SelectItem value="stockSeguridad">Stock Seguridad</SelectItem>
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
                      <SelectItem value="stockSeguridad">Stock Seguridad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold">Copiar a</Label>
                  <Select value={massCopyTo} onValueChange={(v) => setMassCopyTo(v as MassField)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stockMaximo">Stock Máximo</SelectItem>
                      <SelectItem value="stockSeguridad">Stock Seguridad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {massAction === "consumption" && (
              <p className="text-sm text-muted-foreground">
                Ajuste inteligente: aumenta stock máximo (+20%) y seguridad (+15%) en productos con stock actual por debajo de seguridad. Reduce stock máximo (-10%) en productos con stock cerca del máximo.
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
