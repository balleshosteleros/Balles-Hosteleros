"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Package,
  Plus,
  Search,
  ShoppingCart,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import {
  getSugerenciasPorStock,
  getSugerenciasPorVentas,
  getCatalogoProveedor,
  type SugerenciaLinea,
  type CatalogoProductoProveedor,
} from "@/features/logistica/actions/sugerencias-actions";
import { createPedido } from "@/features/logistica/actions/pedidos-actions";
import { toast } from "sonner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

type Modo = "stock" | "ventas";
type Step = "mode" | "list";

interface GroupState {
  proveedor_id: string | null;
  proveedor_nombre: string;
  productos: SugerenciaLinea[];
  expanded: boolean;
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function SugerenciasPedidoModal({
  open,
  onClose,
  onOrdersCreated,
}: {
  open: boolean;
  onClose: () => void;
  onOrdersCreated: () => void;
}) {
  const [step, setStep] = useState<Step>("mode");
  const [modo, setModo] = useState<Modo | null>(null);
  const [groups, setGroups] = useState<GroupState[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  useGlobalLoadingSync(loading || creating);

  useEffect(() => {
    if (!open) {
      setStep("mode");
      setModo(null);
      setGroups([]);
    }
  }, [open]);

  const cargar = async (m: Modo) => {
    setLoading(true);
    setModo(m);
    setStep("list");
    const res = m === "stock" ? await getSugerenciasPorStock() : await getSugerenciasPorVentas();
    if (res.ok) {
      setGroups(res.data.map((g) => ({ ...g, expanded: false })));
    } else {
      toast.error("Error al cargar sugerencias");
      setGroups([]);
    }
    setLoading(false);
  };

  const volverAModo = () => {
    setStep("mode");
    setModo(null);
    setGroups([]);
  };

  const toggleExpand = (provKey: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        (g.proveedor_id ?? "__none__") === provKey ? { ...g, expanded: !g.expanded } : g
      )
    );
  };

  const updateCantidad = (provKey: string, productoId: string, val: string) => {
    const num = parseNum(val);
    setGroups((prev) =>
      prev.map((g) => {
        if ((g.proveedor_id ?? "__none__") !== provKey) return g;
        return {
          ...g,
          productos: g.productos.map((p) =>
            p.producto_id === productoId ? { ...p, cantidad_propuesta: num } : p
          ),
        };
      })
    );
  };

  const removeLinea = (provKey: string, productoId: string) => {
    setGroups((prev) =>
      prev
        .map((g) => {
          if ((g.proveedor_id ?? "__none__") !== provKey) return g;
          return { ...g, productos: g.productos.filter((p) => p.producto_id !== productoId) };
        })
        .filter((g) => g.productos.length > 0)
    );
  };

  const addLinea = (provKey: string, item: CatalogoProductoProveedor) => {
    setGroups((prev) =>
      prev.map((g) => {
        if ((g.proveedor_id ?? "__none__") !== provKey) return g;
        if (g.productos.some((p) => p.producto_id === item.producto_id)) return g;
        const nueva: SugerenciaLinea = {
          producto_id: item.producto_id,
          nombre: item.nombre,
          unidad: item.unidad,
          stock_actual: item.stock_actual,
          stock_maximo: item.stock_maximo,
          cantidad_propuesta: Math.max(
            Math.ceil(item.stock_maximo - item.stock_actual),
            1
          ),
          precio_estimado: item.precio_unitario,
          ventas_dia_promedio: item.ventas_dia_promedio,
        };
        return { ...g, productos: [...g.productos, nueva] };
      })
    );
  };

  const totales = useMemo(() => {
    let prods = 0;
    let coste = 0;
    for (const g of groups) {
      for (const p of g.productos) {
        prods++;
        coste += p.cantidad_propuesta * p.precio_estimado;
      }
    }
    return { productos: prods, pedidos: groups.length, coste };
  }, [groups]);

  const handleCreateOrders = async () => {
    if (groups.length === 0) {
      toast.error("No hay productos para pedir");
      return;
    }
    setCreating(true);
    let ok = 0;
    let err = 0;

    for (const g of groups) {
      const res = await createPedido({
        proveedorNombre: g.proveedor_nombre,
        proveedorId: g.proveedor_id ?? undefined,
        lineas: g.productos.map((p) => ({
          productoId: p.producto_id,
          productoNombre: p.nombre,
          cantidad: p.cantidad_propuesta,
          unidad: p.unidad,
          precioUnitario: p.precio_estimado,
        })),
        notas:
          modo === "stock"
            ? "Pedido generado automáticamente por sugerencia de stock."
            : "Pedido generado automáticamente por sugerencia de ventas.",
      });
      if (res.ok) ok++;
      else err++;
    }

    setCreating(false);
    if (ok > 0) {
      toast.success(`${ok} pedido(s) generado(s) como borrador`);
      onOrdersCreated();
      onClose();
    }
    if (err > 0) toast.error(`Error al generar ${err} pedido(s)`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <ShoppingCart className="h-5 w-5 text-primary" />
            SUGERENCIAS DE COMPRA AUTOMÁTICA
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {step === "mode"
              ? "Elige cómo quieres calcular las sugerencias de compra."
              : modo === "stock"
              ? "Productos con stock por debajo del máximo. Reposición hasta el techo."
              : "Productos con poca cobertura según ventas medias diarias."}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6 pt-2">
          {step === "mode" && (
            <ModeChooser onPick={cargar} />
          )}

          {step === "list" && (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={volverAModo}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Cambiar modo
                </Button>
                <Badge variant="outline" className="font-medium">
                  Modo: {modo === "stock" ? "Por stock" : "Por ventas"}
                </Badge>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 flex-1">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground font-medium italic">
                    Analizando stock y necesidades…
                  </p>
                </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-muted/30 rounded-xl border border-dashed flex-1">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <div>
                    <p className="font-bold text-foreground">¡Todo en orden!</p>
                    <p className="text-sm text-muted-foreground">
                      No hay productos que requieran reposición con este criterio.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={volverAModo}>
                    Probar otro modo
                  </Button>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>{groups.length} proveedor(es)</strong> con productos a reponer.
                      Despliega cada proveedor para ajustar cantidades, eliminar líneas o añadir
                      nuevos productos. Se creará un pedido en <strong>Borrador</strong> por proveedor.
                    </p>
                  </div>

                  <ScrollArea className="flex-1 border rounded-lg bg-card">
                    <div className="divide-y">
                      {groups.map((g) => (
                        <ProveedorRow
                          key={g.proveedor_id ?? "__none__"}
                          group={g}
                          modo={modo!}
                          onToggle={() => toggleExpand(g.proveedor_id ?? "__none__")}
                          onUpdateCantidad={(pid, val) =>
                            updateCantidad(g.proveedor_id ?? "__none__", pid, val)
                          }
                          onRemove={(pid) =>
                            removeLinea(g.proveedor_id ?? "__none__", pid)
                          }
                          onAdd={(item) =>
                            addLinea(g.proveedor_id ?? "__none__", item)
                          }
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-muted/20">
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              {step === "list" && groups.length > 0 ? (
                <>
                  {totales.productos} productos &rarr;{" "}
                  <strong>{totales.pedidos} pedidos</strong> &middot;{" "}
                  <strong>{formatEur(totales.coste)}</strong> estimado
                </>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={creating}>
                Cancelar
              </Button>
              {step === "list" && (
                <Button
                  onClick={handleCreateOrders}
                  disabled={groups.length === 0 || creating || loading}
                  className="gap-2"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  Generar {totales.pedidos} pedidos
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ModeChooser ────────────────────────────────────────────

function ModeChooser({ onPick }: { onPick: (m: Modo) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
      <ModeCard
        icon={<Package className="h-7 w-7" />}
        title="Por stock"
        description="Productos por debajo del stock máximo. Calcula la cantidad para llenar hasta el techo."
        accent="bg-primary/10 text-primary border-primary/30"
        onClick={() => onPick("stock")}
      />
      <ModeCard
        icon={<TrendingUp className="h-7 w-7" />}
        title="Por ventas"
        description="Productos con poca cobertura según ventas medias diarias. Repone para 14 días."
        accent="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
        onClick={() => onPick("ventas")}
      />
    </div>
  );
}

function ModeCard({
  icon,
  title,
  description,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-xl border bg-card p-5 text-left transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className={`inline-flex items-center justify-center h-12 w-12 rounded-lg border ${accent} mb-3`}>
        {icon}
      </div>
      <div className="font-bold text-foreground mb-1">{title}</div>
      <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>
    </button>
  );
}

// ─── ProveedorRow (acordeón) ─────────────────────────────────

function ProveedorRow({
  group,
  modo,
  onToggle,
  onUpdateCantidad,
  onRemove,
  onAdd,
}: {
  group: GroupState;
  modo: Modo;
  onToggle: () => void;
  onUpdateCantidad: (productoId: string, val: string) => void;
  onRemove: (productoId: string) => void;
  onAdd: (item: CatalogoProductoProveedor) => void;
}) {
  const totalCoste = group.productos.reduce(
    (acc, p) => acc + p.cantidad_propuesta * p.precio_estimado,
    0
  );

  return (
    <div className="bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        {group.expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Truck className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 text-left">
          <div className="font-semibold text-foreground">{group.proveedor_nombre}</div>
          <div className="text-[11px] text-muted-foreground">
            {group.productos.length} producto{group.productos.length === 1 ? "" : "s"} a
            reponer
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-[11px]">
          {formatEur(totalCoste)}
        </Badge>
      </button>

      {group.expanded && (
        <div className="bg-muted/20 border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold text-muted-foreground uppercase">
                <th className="px-4 py-2 text-left">Producto</th>
                <th className="px-4 py-2 text-right w-24">Stock actual</th>
                <th className="px-4 py-2 text-right w-24">Stock máx.</th>
                {modo === "ventas" && (
                  <th className="px-4 py-2 text-right w-24">Vta./día</th>
                )}
                <th className="px-4 py-2 text-center w-32">Cant. propuesta</th>
                <th className="px-4 py-2 text-right w-24">Subtotal</th>
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {group.productos.map((p) => (
                <tr key={p.producto_id} className="border-t hover:bg-card transition-colors">
                  <td className="px-4 py-2">
                    <div className="font-medium text-foreground">{p.nombre}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{p.unidad}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {p.stock_actual}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {p.stock_maximo}
                  </td>
                  {modo === "ventas" && (
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {p.ventas_dia_promedio.toFixed(1)}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 text-right font-bold"
                      value={p.cantidad_propuesta}
                      onChange={(e) => onUpdateCantidad(p.producto_id, e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {formatEur(p.cantidad_propuesta * p.precio_estimado)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(p.producto_id)}
                      title="Eliminar línea"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t flex justify-end">
            <AddProductoPopover
              proveedorId={group.proveedor_id}
              proveedorNombre={group.proveedor_nombre}
              excludeIds={group.productos.map((p) => p.producto_id)}
              onAdd={onAdd}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AddProductoPopover ──────────────────────────────────────

function AddProductoPopover({
  proveedorId,
  proveedorNombre,
  excludeIds,
  onAdd,
}: {
  proveedorId: string | null;
  proveedorNombre: string;
  excludeIds: string[];
  onAdd: (item: CatalogoProductoProveedor) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CatalogoProductoProveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || items.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getCatalogoProveedor(proveedorId);
      if (!cancelled) {
        setItems(res.ok ? res.data : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, proveedorId, items.length]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtrados = useMemo(() => {
    const base = items.filter((i) => !excludeIds.includes(i.producto_id));
    const s = query.trim().toLowerCase();
    if (!s) return base;
    return base.filter((i) => i.nombre.toLowerCase().includes(s));
  }, [items, excludeIds, query]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button type="button" variant="outline" size="sm" className="gap-1 h-8" onClick={() => setOpen((v) => !v)}>
        <Plus className="h-3.5 w-3.5" />
        Añadir producto
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") { setOpen(false); }
              }}
              placeholder={`Buscar en ${proveedorNombre}…`}
              className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {loading && (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Cargando catálogo…
              </div>
            )}
            {!loading && filtrados.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {items.length === 0
                  ? "Sin productos disponibles."
                  : "Todos los productos ya están en la lista."}
              </div>
            )}
            {!loading &&
              filtrados.map((it) => (
                <button
                  type="button"
                  key={it.producto_id}
                  onClick={() => {
                    onAdd(it);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{it.nombre}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Stock: {it.stock_actual} / {it.stock_maximo} {it.unidad}
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {formatEur(it.precio_unitario)}
                  </Badge>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
