"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getStockConTemporada,
  CATEGORIAS_STOCK, type ProductoStock, type TemporadaStock,
} from "@/features/logistica/data/stock";
import { listTemporadas, updateTemporada } from "@/features/logistica/actions/temporadas-actions";
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
  ArrowUpDown, Pencil, Check, X, Sun, Settings, ChevronDown, ShoppingCart, FlaskConical, ArrowLeft,
} from "lucide-react";
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
import { IOActions } from "@/shared/io";
import { stockIO } from "@/features/logistica/io/stock.io";
import { toast } from "sonner";

type MassAction =
  | "pct"
  | "fixed"
  | "set"
  | "copy"
  | "copiar-temporada"
  | "consumption"
  | "ratio"
  | "round"
  | "reset"
  | "coverage";
type MassField = "stockMaximo" | "stockSeguridad";
type MassScope = "selected" | "filtered" | "all" | "category" | "status";

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
const statusLabels: Record<string, string> = { critical: "Bajo", warning: "Atención", ok: "Correcto" };

function InventarioBadge({ value }: { value: number }) {
  if (value > 0) return <span className="text-emerald-700 dark:text-emerald-400 font-semibold">+{value}</span>;
  if (value < 0) return <span className="text-red-700 dark:text-red-400 font-semibold">{value}</span>;
  return <span className="text-muted-foreground font-medium">0</span>;
}

export function StockView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("logistica_last", pathname); }, [pathname]);

  const { empresaActual } = useEmpresa();
  const [tipoActivo, setTipoActivo] = useState<"compra" | "elaboracion">("compra");
  const [stockPorTipo, setStockPorTipo] = useState<{ compra: ProductoStock[]; elaboracion: ProductoStock[] }>({ compra: [], elaboracion: [] });
  const [temporadas, setTemporadas] = useState<TemporadaStock[]>([]);
  const [, setLoadingStock] = useState(true);

  const stock = tipoActivo === "compra" ? stockPorTipo.compra : stockPorTipo.elaboracion;
  const setStock = useCallback((updater: ProductoStock[] | ((prev: ProductoStock[]) => ProductoStock[])) => {
    setStockPorTipo((prev) => {
      const current = tipoActivo === "compra" ? prev.compra : prev.elaboracion;
      const next = typeof updater === "function" ? (updater as (p: ProductoStock[]) => ProductoStock[])(current) : updater;
      return tipoActivo === "compra" ? { ...prev, compra: next } : { ...prev, elaboracion: next };
    });
  }, [tipoActivo]);

  const loadStockData = useCallback(async () => {
    setLoadingStock(true);
    try {
      const [stockRes, productosCompra, productosElab] = await Promise.all([
        listStock(),
        listProductos("compra"),
        listProductos("elaboracion"),
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
      const mapToStock = (p: typeof productosCompra[number]): ProductoStock => {
        const s = stockByProductoId.get(p.id) ?? stockByNombre.get(p.nombre.toLowerCase());
        return {
          id: s?.id ?? p.id,
          nombre: p.nombre,
          categoria: p.categoria || "Otros",
          unidad: p.medida,
          stockMaximo: s?.maxima ?? 0,
          stockSeguridad: s?.minima ?? 0,
          stockActual: s?.cantidad ?? 0,
          ultimoInventario: 0,
          ultimoInventarioFecha: null,
          empresaId: empresaActual.id,
        };
      };
      setStockPorTipo({
        compra: productosCompra.map(mapToStock),
        elaboracion: productosElab.map(mapToStock),
      });
    } catch (err) {
      console.error("Error cargando stock:", err);
      setStockPorTipo({ compra: [], elaboracion: [] });
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

  const PRESETS_TEMPORADA = ["Verano", "Invierno"] as const;
  const temporadasPersonalizadas = useMemo(
    () =>
      temporadas.filter(
        (t) => !PRESETS_TEMPORADA.some((p) => p.toLowerCase() === t.nombre.trim().toLowerCase()),
      ),
    [temporadas],
  );

  const temporadaActiva = useMemo(() => {
    if (temporadaSeleccionada === "base") return null;
    if (temporadaSeleccionada === "preset-verano") {
      return temporadas.find((t) => t.nombre.trim().toLowerCase() === "verano") || null;
    }
    if (temporadaSeleccionada === "preset-invierno") {
      return temporadas.find((t) => t.nombre.trim().toLowerCase() === "invierno") || null;
    }
    return temporadas.find((t) => t.id === temporadaSeleccionada) || null;
  }, [temporadaSeleccionada, temporadas]);

  const temporadaLabel = useMemo(() => {
    if (temporadaSeleccionada === "base") return "General";
    if (temporadaSeleccionada === "preset-verano") return "Verano";
    if (temporadaSeleccionada === "preset-invierno") return "Invierno";
    return temporadas.find((t) => t.id === temporadaSeleccionada)?.nombre ?? "General";
  }, [temporadaSeleccionada, temporadas]);

  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ stockMaximo: number; stockSeguridad: number }>({ stockMaximo: 0, stockSeguridad: 0 });

  // Mass edit
  const [massOpen, setMassOpen] = useState(false);
  const [massScope, setMassScope] = useState<MassScope>("selected");
  const [massScopeCategory, setMassScopeCategory] = useState<string>("");
  const [massScopeStatus, setMassScopeStatus] = useState<"critical" | "warning" | "ok">("critical");
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

  const unidadesUsadas = useMemo(
    () => [...new Set(enriched.map((p) => p.unidad).filter(Boolean))].sort(),
    [enriched],
  );

  type EnrichedItem = typeof enriched[number];
  const accesoStock = (p: EnrichedItem, campo: string): unknown => {
    if (campo === "estadoStock") {
      const st = stockStatus(p.stockActual, p.displaySeguridad);
      return st === "critical" ? "Stock bajo" : st === "warning" ? "Atención" : "Correcto";
    }
    if (campo === "stockMaximo") return p.displayMaximo;
    if (campo === "stockSeguridad") return p.displaySeguridad;
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = enriched.filter((p) => coincideBusquedaUniversal(p, search));
    lista = aplicarFiltrosToolbar(lista, filtros, accesoStock);
    lista = aplicarOrdenToolbar(lista, orden, accesoStock);
    return lista;
  }, [enriched, search, filtros, orden]);

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
    const savedId = editingId;
    setEditingId(null);

    // Si hay una temporada activa, el valor editado pertenece a ESA temporada
    // (override), no al stock base. Persistir en la temporada evita pisar el valor general.
    if (temporadaActiva) {
      const newOverrides = {
        ...temporadaActiva.overrides,
        [savedId]: { stockMaximo: editValues.stockMaximo, stockSeguridad: editValues.stockSeguridad },
      };
      setTemporadas((prev) => prev.map((t) => (t.id === temporadaActiva.id ? { ...t, overrides: newOverrides } : t)));
      const res = await updateTemporada(temporadaActiva.id, {
        nombre: temporadaActiva.nombre,
        fechaInicio: temporadaActiva.fechaInicio,
        fechaFin: temporadaActiva.fechaFin,
        overrides: newOverrides,
      });
      if (res.ok) toast.success(`Valores guardados en la temporada ${temporadaActiva.nombre}`);
      else { toast.error(res.error ?? "Error al guardar la temporada"); loadStockData(); }
      return;
    }

    setStock((prev) => prev.map((p) => p.id === savedId ? { ...p, stockMaximo: editValues.stockMaximo, stockSeguridad: editValues.stockSeguridad } : p));
    const res = await updateStockAction(savedId, {
      cantidad_minima: editValues.stockSeguridad,
      cantidad_maxima: editValues.stockMaximo,
    });
    if (res.ok) toast.success("Valores actualizados");
    else { toast.error("Error al actualizar stock"); loadStockData(); }
  };
  const cancelEdit = () => setEditingId(null);

  // Resolve which product ids the mass edit should target based on scope
  const massTargetIds = useMemo<Set<string>>(() => {
    if (massScope === "selected") return new Set(selected);
    if (massScope === "filtered") return new Set(filtered.map((p) => p.id));
    if (massScope === "all") return new Set(stock.map((p) => p.id));
    if (massScope === "category") {
      if (!massScopeCategory) return new Set();
      return new Set(stock.filter((p) => p.categoria === massScopeCategory).map((p) => p.id));
    }
    if (massScope === "status") {
      return new Set(
        enriched.filter((p) => stockStatus(p.stockActual, p.displaySeguridad) === massScopeStatus).map((p) => p.id),
      );
    }
    return new Set();
  }, [massScope, selected, filtered, stock, enriched, massScopeCategory, massScopeStatus]);

  // Mass edit
  const applyMassEdit = async () => {
    if (massTargetIds.size === 0) { toast.info("El ámbito seleccionado no contiene productos"); return; }

    // Copiar stock entre temporadas — persiste las reglas en la temporada destino.
    if (massAction === "copiar-temporada") {
      if (!massCopyTempFrom || !massCopyTempTo) { toast.error("Selecciona temporada origen y destino"); return; }
      if (massCopyTempFrom === massCopyTempTo) { toast.error("Origen y destino deben ser diferentes"); return; }
      const destTemp = temporadas.find((t) => t.id === massCopyTempTo);
      if (!destTemp) { toast.error("La temporada destino no existe"); return; }
      const sourceTemp = massCopyTempFrom === "base" ? null : temporadas.find((t) => t.id === massCopyTempFrom);
      const newOverrides = { ...destTemp.overrides };
      for (const prodId of massTargetIds) {
        const prod = stock.find((p) => p.id === prodId);
        if (!prod) continue;
        const srcVal = sourceTemp?.overrides[prodId] ?? { stockMaximo: prod.stockMaximo, stockSeguridad: prod.stockSeguridad };
        newOverrides[prodId] = { ...srcVal };
      }
      const res = await updateTemporada(massCopyTempTo, {
        nombre: destTemp.nombre,
        fechaInicio: destTemp.fechaInicio,
        fechaFin: destTemp.fechaFin,
        overrides: newOverrides,
      });
      if (!res.ok) { toast.error(res.error ?? "No se pudo guardar la temporada"); return; }
      setTemporadas((prev) => prev.map((t) => (t.id === massCopyTempTo ? { ...t, overrides: newOverrides } : t)));
      toast.success(`Stock copiado a ${destTemp.nombre} para ${massTargetIds.size} producto(s)`);
      setMassOpen(false);
      return;
    }

    const val = parseFloat(massValue);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const apply = (current: number): number => {
      if (massAction === "pct" && !isNaN(val)) return Math.max(0, round2(current * (1 + val / 100)));
      if (massAction === "fixed" && !isNaN(val)) return Math.max(0, round2(current + val));
      if (massAction === "set" && !isNaN(val)) return Math.max(0, val);
      return current;
    };

    // Validaciones específicas por acción
    if ((massAction === "pct" || massAction === "fixed" || massAction === "set") && isNaN(val)) {
      toast.error("Introduce un valor numérico"); return;
    }
    if (massAction === "ratio" && (isNaN(val) || val <= 0 || val >= 100)) {
      toast.error("El ratio debe ser un porcentaje entre 1 y 99"); return;
    }
    if (massAction === "coverage" && (isNaN(val) || val <= 0)) {
      toast.error("Indica un número de días positivo"); return;
    }

    // Calcular nuevos valores primero para poder persistirlos
    const updates: { id: string; cantidad_minima: number; cantidad_maxima: number }[] = [];
    const updatedStock = stock.map((p) => {
      if (!massTargetIds.has(p.id)) return p;
      const updated = { ...p };
      if (massAction === "copy") {
        updated[massCopyTo] = updated[massCopyFrom];
      } else if (massAction === "consumption") {
        if (updated.stockActual < updated.stockSeguridad) {
          updated.stockMaximo = round2(updated.stockMaximo * 1.2);
          updated.stockSeguridad = round2(updated.stockSeguridad * 1.15);
        } else if (updated.stockActual > updated.stockMaximo * 0.9) {
          updated.stockMaximo = round2(updated.stockMaximo * 0.9);
        }
      } else if (massAction === "ratio") {
        // Stock mínimo = val% del Stock Máximo
        updated.stockSeguridad = round2(updated.stockMaximo * (val / 100));
      } else if (massAction === "round") {
        updated.stockMaximo = Math.round(updated.stockMaximo);
        updated.stockSeguridad = Math.round(updated.stockSeguridad);
      } else if (massAction === "reset") {
        updated[massField] = 0;
      } else if (massAction === "coverage") {
        // Cobertura: máx = consumo diario × días. Heurística: consumo diario ≈ stockSeguridad o 1
        const consumoDiario = updated.stockSeguridad > 0 ? updated.stockSeguridad : 1;
        updated.stockMaximo = round2(consumoDiario * val);
      } else {
        updated[massField] = apply(updated[massField]);
      }
      // Coherencia: mínimo nunca puede superar al máximo
      if (updated.stockSeguridad > updated.stockMaximo) {
        updated.stockSeguridad = updated.stockMaximo;
      }
      updates.push({ id: p.id, cantidad_minima: updated.stockSeguridad, cantidad_maxima: updated.stockMaximo });
      return updated;
    });

    setStock(updatedStock);
    setMassOpen(false);
    setMassValue("");

    const res = await updateStockBatch(updates);
    if (res.ok) {
      toast.success(`Edición masiva guardada para ${updates.length} producto(s)`);
    } else {
      toast.error("Error al guardar en base de datos");
      loadStockData();
    }
  };

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Producto", bloqueada: true },
    { campo: "categoria", label: "Categoría" },
    { campo: "unidad", label: "Unidad" },
    { campo: "stockMaximo", label: "Stock Máximo" },
    { campo: "stockSeguridad", label: "Stock Mínimo" },
    { campo: "stockActual", label: "Stock Actual" },
    { campo: "stockReposicion", label: "Stock Reposición" },
    { campo: "estado", label: "Estado" },
    { campo: "ultimoInventario", label: "Últ. Inventario" },
    { campo: "ultimoInventarioFecha", label: "Fecha Inv." },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: ProductoStock & { displayMaximo: number; displaySeguridad: number; esTemporada: boolean }) => ReactNode }> = {
    nombre: {
      th: (
        <TableColumnHeader
          key="nombre"
          label="Producto"
          campo="nombre"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="nombre" className="px-3 py-2.5 font-semibold text-foreground">
          {p.nombre}
          {p.esTemporada && <Sun className="inline h-3 w-3 ml-1 text-primary" />}
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
          opciones={CATEGORIAS_STOCK as unknown as string[]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="categoria" className="px-3 py-2.5 text-xs">
          {p.categoria}
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
        <td key="unidad" className="px-3 py-2.5 text-xs">
          {p.unidad}
        </td>
      ),
    },
    stockMaximo: {
      th: (
        <TableColumnHeader
          key="stockMaximo"
          label="Stock Máximo"
          campo="stockMaximo"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => {
        const isEditing = editingId === p.id;
        return (
          <td key="stockMaximo" className="px-3 py-2.5 text-xs">
            {isEditing
              ? <Input type="number" className="h-7 w-20 text-xs" value={editValues.stockMaximo} onChange={(e) => setEditValues((v) => ({ ...v, stockMaximo: +e.target.value }))} />
              : <span className="font-medium">{p.displayMaximo}</span>}
          </td>
        );
      },
    },
    stockSeguridad: {
      th: (
        <TableColumnHeader
          key="stockSeguridad"
          label="Stock Mínimo"
          campo="stockSeguridad"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => {
        const isEditing = editingId === p.id;
        return (
          <td key="stockSeguridad" className="px-3 py-2.5 text-xs">
            {isEditing
              ? <Input type="number" className="h-7 w-20 text-xs" value={editValues.stockSeguridad} onChange={(e) => setEditValues((v) => ({ ...v, stockSeguridad: +e.target.value }))} />
              : <span className="font-medium">{p.displaySeguridad}</span>}
          </td>
        );
      },
    },
    stockActual: {
      th: (
        <TableColumnHeader
          key="stockActual"
          label="Stock Actual"
          campo="stockActual"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="stockActual" className="px-3 py-2.5 text-xs">
          <span className="font-bold text-foreground">{p.stockActual}</span>
        </td>
      ),
    },
    stockReposicion: {
      th: <TableColumnHeader key="stockReposicion" label="Stock Reposición" />,
      td: (p) => {
        const reposicion = Math.max(0, p.displayMaximo - p.stockActual);
        return (
          <td key="stockReposicion" className="px-3 py-2.5 text-xs">
            {reposicion > 0
              ? <span className="font-medium text-amber-600 dark:text-amber-400">{reposicion}</span>
              : <span className="text-muted-foreground">—</span>}
          </td>
        );
      },
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estadoStock"
          filtroTipo="lista"
          opciones={["Stock bajo", "Atención", "Correcto"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (p) => {
        const st = stockStatus(p.stockActual, p.displaySeguridad);
        return (
          <td key="estado" className="px-3 py-2.5">
            <Badge variant="outline" className={`text-[11px] font-bold px-2 py-0.5 ${statusColors[st]}`}>{statusLabels[st]}</Badge>
          </td>
        );
      },
    },
    ultimoInventario: {
      th: <TableColumnHeader key="ultimoInventario" label="Últ. Inventario" />,
      td: (p) => (
        <td key="ultimoInventario" className="px-3 py-2.5 text-xs">
          <InventarioBadge value={p.ultimoInventario} />
        </td>
      ),
    },
    ultimoInventarioFecha: {
      th: <TableColumnHeader key="ultimoInventarioFecha" label="Fecha Inv." />,
      td: (p) => (
        <td key="ultimoInventarioFecha" className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {p.ultimoInventarioFecha || "—"}
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={tipoActivo === "compra" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("compra"); setSelected(new Set()); }}
        >
          <ShoppingCart className="h-4 w-4" />
          Compra
          <Badge variant="secondary" className="text-[10px] ml-1">{stockPorTipo.compra.length}</Badge>
        </Button>
        <Button
          variant={tipoActivo === "elaboracion" ? "default" : "outline"}
          className="gap-2"
          onClick={() => { setTipoActivo("elaboracion"); setSelected(new Set()); }}
        >
          <FlaskConical className="h-4 w-4" />
          Elaboraciones
          <Badge variant="secondary" className="text-[10px] ml-1">{stockPorTipo.elaboracion.length}</Badge>
        </Button>
      </div>
      <div className="space-y-4">
          {/* Toolbar */}
          <SubmoduleToolbar
            busqueda={search}
            onBusquedaChange={setSearch}
            placeholderBusqueda="Buscar"
            ocultarNuevo
            filtros={filtros}
            onFiltrosChange={setFiltros}
            columnas={columnasDef}
            columnasVisibles={columnasVisibles}
            onColumnasVisiblesChange={setColumnasVisibles}
            columnasOrden={columnasOrden}
            onColumnasOrdenChange={setColumnasOrden}
            extraIzquierda={
              <>
                <Popover open={tempPopoverOpen} onOpenChange={setTempPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="primary" className="gap-1.5">
                      {temporadaLabel}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2" align="start">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">Ver temporada</p>
                    {([
                      { id: "base", label: "General" },
                      { id: "preset-verano", label: "Verano" },
                      { id: "preset-invierno", label: "Invierno" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { setTemporadaSeleccionada(opt.id); setTempPopoverOpen(false); }}
                        className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md transition-colors ${
                          temporadaSeleccionada === opt.id
                            ? "bg-primary/10 text-primary font-semibold"
                            : "hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {temporadasPersonalizadas.length > 0 && (
                      <>
                        <Separator className="my-1.5" />
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">Personalizadas</p>
                        {temporadasPersonalizadas.map((t) => (
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
                      </>
                    )}
                  </PopoverContent>
                </Popover>

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    setMassScope(selected.size > 0 ? "selected" : "filtered");
                    setMassOpen(true);
                  }}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  Edición masiva{selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>
              </>
            }
            extraDerecha={
              <>
                <IOActions config={stockIO} onSuccess={() => loadStockData()} />
                <Button size="icon" variant={showConfig ? "default" : "outline"} className="h-9 w-9" onClick={() => setShowConfig((v) => !v)} title="Configuración" aria-label="Configuración">
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </>
            }
          />

          {showConfig ? (
            <div className="bg-card border rounded-lg p-5 space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfig(false)}
                className="gap-1 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </Button>
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
              <ResizableColumnsProvider storageKey="logistica-stock">
              <div className="bg-card rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-3 w-10">
                        <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                      </th>
                      {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                      <TableColumnHeader label="" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const isEditing = editingId === p.id;
                      return (
                        <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                          </td>
                          {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                          <td className="px-3 py-2.5">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit} title="Guardar" aria-label="Guardar"><Check className="h-3.5 w-3.5 text-emerald-600" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} title="Cancelar" aria-label="Cancelar"><X className="h-3.5 w-3.5 text-destructive" /></Button>
                              </div>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)} title="Editar" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={20} className="text-center py-12 text-muted-foreground">No se encontraron productos.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              </ResizableColumnsProvider>
              <div className="text-xs text-muted-foreground text-right">{filtered.length} de {enriched.length} productos</div>
            </>
          )}
      </div>

      {/* Mass Edit Dialog */}
      <Dialog open={massOpen} onOpenChange={setMassOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edición masiva — {massTargetIds.size} producto(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Modifica Stock Máximo y/o Stock Mínimo de varios productos a la vez. Elige primero el ámbito y luego el tipo de acción.
            </div>

            {/* Ámbito */}
            <div>
              <Label className="text-xs font-bold">Aplicar a</Label>
              <Select value={massScope} onValueChange={(v) => setMassScope(v as MassScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="selected" disabled={selected.size === 0}>
                    Productos seleccionados ({selected.size})
                  </SelectItem>
                  <SelectItem value="filtered">Productos visibles ({filtered.length})</SelectItem>
                  <SelectItem value="all">Todos los productos ({stock.length})</SelectItem>
                  <SelectItem value="category">Por categoría…</SelectItem>
                  <SelectItem value="status">Por estado de stock…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {massScope === "category" && (
              <div>
                <Label className="text-xs font-bold">Categoría</Label>
                <Select value={massScopeCategory} onValueChange={setMassScopeCategory}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría…" /></SelectTrigger>
                  <SelectContent>
                    {[...new Set(stock.map((p) => p.categoria))].sort().map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {massScope === "status" && (
              <div>
                <Label className="text-xs font-bold">Estado</Label>
                <Select value={massScopeStatus} onValueChange={(v) => setMassScopeStatus(v as "critical" | "warning" | "ok")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Stock bajo</SelectItem>
                    <SelectItem value="warning">Atención</SelectItem>
                    <SelectItem value="ok">Correcto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            <div>
              <Label className="text-xs font-bold">Tipo de acción</Label>
              <Select value={massAction} onValueChange={(v) => setMassAction(v as MassAction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct">Por porcentaje (%)</SelectItem>
                  <SelectItem value="fixed">Sumar / restar cantidad</SelectItem>
                  <SelectItem value="set">Igualar a valor fijo</SelectItem>
                  <SelectItem value="copy">Copiar entre campos</SelectItem>
                  <SelectItem value="ratio">Mínimo = % del Máximo</SelectItem>
                  <SelectItem value="coverage">Máximo = días de cobertura</SelectItem>
                  <SelectItem value="round">Redondear valores</SelectItem>
                  <SelectItem value="reset">Reset a cero</SelectItem>
                  {temporadas.length >= 2 && <SelectItem value="copiar-temporada">Copiar entre temporadas</SelectItem>}
                  <SelectItem value="consumption">Ajustar según consumo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(massAction === "pct" || massAction === "fixed" || massAction === "set" || massAction === "reset") && (
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
                {massAction !== "reset" && (
                  <div>
                    <Label className="text-xs font-bold">
                      {massAction === "pct" ? "Porcentaje (ej: 10 para +10%, -15 para -15%)" :
                       massAction === "fixed" ? "Cantidad (ej: 5 para sumar, -2 para restar)" :
                       "Valor fijo para todos"}
                    </Label>
                    <Input type="number" value={massValue} onChange={(e) => setMassValue(e.target.value)} placeholder={massAction === "pct" ? "10" : "5"} />
                  </div>
                )}
              </>
            )}

            {massAction === "ratio" && (
              <div>
                <Label className="text-xs font-bold">Stock Mínimo = X % del Stock Máximo</Label>
                <Input type="number" value={massValue} onChange={(e) => setMassValue(e.target.value)} placeholder="30" />
                <p className="text-xs text-muted-foreground mt-1">Ej: 30 → mínimo se ajusta al 30 % del máximo de cada producto.</p>
              </div>
            )}

            {massAction === "coverage" && (
              <div>
                <Label className="text-xs font-bold">Días de cobertura</Label>
                <Input type="number" value={massValue} onChange={(e) => setMassValue(e.target.value)} placeholder="7" />
                <p className="text-xs text-muted-foreground mt-1">Calcula Stock Máximo = consumo diario × días. Si no hay consumo registrado se usa el Stock Mínimo como referencia.</p>
              </div>
            )}

            {massAction === "round" && (
              <p className="text-sm text-muted-foreground">Redondea Stock Máximo y Mínimo al entero más cercano para todos los productos del ámbito.</p>
            )}

            {massAction === "reset" && (
              <p className="text-sm text-amber-700 dark:text-amber-400">El campo seleccionado se pondrá a 0 en todos los productos del ámbito.</p>
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
