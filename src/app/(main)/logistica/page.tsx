import Link from "next/link";
import { Package, Truck, ShoppingCart, Warehouse, ClipboardList } from "lucide-react";
import { StockAnalyticsSection } from "@/features/logistica/components/stock/StockAnalyticsSection";
import { AgoraSyncStatus } from "@/features/logistica/components/AgoraSyncStatus";
import { listPedidos } from "@/features/logistica/actions/pedidos-actions";
import { listProveedores } from "@/features/logistica/actions/proveedores-actions";
import { listStock } from "@/features/logistica/actions/stock-actions";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import { listInventarios } from "@/features/logistica/actions/inventarios-actions";
import { getControlCompras, getProductosSinCompras } from "@/features/logistica/actions/control-compras-actions";
import { ControlComprasPanel } from "@/features/logistica/components/ControlComprasPanel";

function stockStatus(actual: number, seguridad: number): "critical" | "warning" | "ok" {
  if (actual < seguridad) return "critical";
  if (actual <= seguridad * 1.3) return "warning";
  return "ok";
}

function StatCard({
  value,
  label,
  color = "default",
}: {
  value: number;
  label: string;
  color?: "default" | "emerald" | "amber" | "red" | "blue" | "orange" | "gray";
}) {
  const valueClass: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
    orange: "text-orange-600 dark:text-orange-400",
    gray: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className={`text-2xl font-black ${valueClass[color]}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</div>
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  title,
  href,
  children,
}: {
  icon: React.ElementType;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold tracking-wide">{title}</span>
        <Link
          href={href}
          className="ml-auto text-xs text-primary hover:underline font-medium"
        >
          Ver todo →
        </Link>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default async function LogisticaDashboardPage() {
  // Fetch all data in parallel
  const [pedidosRes, proveedoresRes, stockRes, productosCompra, inventariosRes, controlCompras, sinComprasInit] = await Promise.all([
    listPedidos(),
    listProveedores(),
    listStock(),
    listProductos("compra"),
    listInventarios(),
    getControlCompras(),
    getProductosSinCompras(30),
  ]);

  // Pedidos stats
  const pedidos = pedidosRes.data ?? [];
  const pedidoStats = {
    borrador: pedidos.filter((p) => (p as Record<string, unknown>).estado === "Borrador").length,
    pendiente: pedidos.filter((p) => (p as Record<string, unknown>).estado === "Pendiente").length,
    confirmado: pedidos.filter((p) => (p as Record<string, unknown>).estado === "Confirmado").length,
    enviado: pedidos.filter((p) => (p as Record<string, unknown>).estado === "Enviado").length,
    servido: pedidos.filter((p) => (p as Record<string, unknown>).estado === "Servido").length,
    cancelado: pedidos.filter((p) => (p as Record<string, unknown>).estado === "Cancelado").length,
  };

  // Proveedores stats
  const proveedores = proveedoresRes.data ?? [];
  const provStats = {
    total: proveedores.length,
    activos: proveedores.filter((p) => p.estado === "Activo").length,
    inactivos: proveedores.filter((p) => p.estado === "Inactivo").length,
  };

  // Stock stats
  const stockData = stockRes.data ?? [];
  const stockByProductoId = new Map<string, { cantidad: number; minima: number }>();
  const stockByNombre = new Map<string, { cantidad: number; minima: number }>();
  for (const r of stockData as Array<Record<string, unknown>>) {
    const entry = {
      cantidad: Number(r.cantidad_actual ?? 0),
      minima: Number(r.cantidad_minima ?? 0),
    };
    if (r.producto_id) stockByProductoId.set(r.producto_id as string, entry);
    if (r.producto_nombre) stockByNombre.set(String(r.producto_nombre).toLowerCase(), entry);
  }
  const enriched = productosCompra.map((p) => {
    const s = stockByProductoId.get(p.id) ?? stockByNombre.get(p.nombre.toLowerCase());
    return { stockActual: s?.cantidad ?? 0, stockSeguridad: s?.minima ?? 0 };
  });
  const stockStats = {
    total: enriched.length,
    critical: enriched.filter((e) => stockStatus(e.stockActual, e.stockSeguridad) === "critical").length,
    warning: enriched.filter((e) => stockStatus(e.stockActual, e.stockSeguridad) === "warning").length,
    ok: enriched.filter((e) => stockStatus(e.stockActual, e.stockSeguridad) === "ok").length,
  };

  // Inventarios stats
  const inventarios = inventariosRes.data ?? [];
  const invStats = {
    total: inventarios.length,
    borrador: inventarios.filter((i) => (i as Record<string, unknown>).estado === "Borrador").length,
    confirmado: inventarios.filter((i) => (i as Record<string, unknown>).estado === "Confirmado").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Logística</h1>
          <p className="text-sm text-muted-foreground">Cuadro de mando — estado actual de todos los módulos</p>
        </div>
      </div>

      {/* Ágora POS — estado de sincronización */}
      <AgoraSyncStatus />

      {/* Control de compras: asociación a venta/elaboración + productos sin compras */}
      <ControlComprasPanel control={controlCompras} sinComprasInit={sinComprasInit} />

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/logistica/pedidos" className="rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pedidos activos</span>
          </div>
          <div className="text-3xl font-black text-foreground">
            {pedidoStats.pendiente + pedidoStats.confirmado + pedidoStats.enviado}
          </div>
        </Link>
        <Link href="/logistica/stock" className="rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stock bajo</span>
          </div>
          <div className="text-3xl font-black text-red-600 dark:text-red-400">{stockStats.critical}</div>
        </Link>
        <Link href="/logistica/proveedores" className="rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proveedores</span>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{provStats.activos}</div>
        </Link>
        <Link href="/logistica/inventarios" className="rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inventarios</span>
          </div>
          <div className="text-3xl font-black text-foreground">{invStats.total}</div>
        </Link>
      </div>

      {/* Detailed module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pedidos */}
        <ModuleCard icon={ShoppingCart} title="PEDIDOS" href="/logistica/pedidos">
          <div className="grid grid-cols-3 gap-2">
            <StatCard value={pedidoStats.borrador} label="BORRADOR" color="gray" />
            <StatCard value={pedidoStats.pendiente} label="PENDIENTE" color="amber" />
            <StatCard value={pedidoStats.confirmado} label="CONFIRMADO" color="blue" />
            <StatCard value={pedidoStats.enviado} label="ENVIADO" color="emerald" />
            <StatCard value={pedidoStats.servido} label="SERVIDO" color="default" />
            <StatCard value={pedidoStats.cancelado} label="CANCELADO" color="red" />
          </div>
        </ModuleCard>

        {/* Stock */}
        <ModuleCard icon={Warehouse} title="STOCK" href="/logistica/stock">
          <div className="grid grid-cols-2 gap-2">
            <StatCard value={stockStats.total} label="PRODUCTOS" color="default" />
            <StatCard value={stockStats.critical} label="STOCK BAJO" color="red" />
            <StatCard value={stockStats.warning} label="ATENCIÓN" color="amber" />
            <StatCard value={stockStats.ok} label="CORRECTO" color="emerald" />
          </div>
        </ModuleCard>

        {/* Proveedores */}
        <ModuleCard icon={Truck} title="PROVEEDORES" href="/logistica/proveedores">
          <div className="grid grid-cols-3 gap-2">
            <StatCard value={provStats.total} label="TOTAL" color="default" />
            <StatCard value={provStats.activos} label="ACTIVOS" color="emerald" />
            <StatCard value={provStats.inactivos} label="INACTIVOS" color="amber" />
          </div>
        </ModuleCard>

        {/* Inventarios */}
        <ModuleCard icon={ClipboardList} title="INVENTARIOS" href="/logistica/inventarios">
          <div className="grid grid-cols-3 gap-2">
            <StatCard value={invStats.total} label="TOTAL" color="default" />
            <StatCard value={invStats.borrador} label="BORRADOR" color="amber" />
            <StatCard value={invStats.confirmado} label="CONFIRMADOS" color="emerald" />
          </div>
        </ModuleCard>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { href: "/logistica/proveedores", icon: Truck, label: "Proveedores" },
          { href: "/logistica/productos", icon: Package, label: "Productos" },
          { href: "/logistica/pedidos", icon: ShoppingCart, label: "Pedidos" },
          { href: "/logistica/stock", icon: Warehouse, label: "Stock" },
          { href: "/logistica/inventarios", icon: ClipboardList, label: "Inventarios" },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors text-center"
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {/* Analítica de stock */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-wide">ANALÍTICA DE STOCK</span>
          <Link href="/logistica/stock" className="ml-auto text-xs text-primary hover:underline font-medium">
            Ver stock →
          </Link>
        </div>
        <div className="p-4">
          <StockAnalyticsSection />
        </div>
      </div>
    </div>
  );
}
