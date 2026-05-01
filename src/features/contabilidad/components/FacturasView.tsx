"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreVertical, Download, Settings, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacturaContable, EstadoFactura, TipoFactura } from "@/features/contabilidad/data/contabilidad";
import { listFacturas } from "@/features/contabilidad/actions/contabilidad-actions";
import { FiltrosAvanzados, type FiltroActivo, type CampoFiltro } from "@/features/logistica/components/FiltrosAvanzados";
import { toast } from "sonner";

const TABS = [{ id: "TODAS", label: "Todas" }, { id: "VENTA", label: "Ventas" }, { id: "COMPRA", label: "Compras" }];

const estadoStyles: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 border-amber-300",
  PAGADO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  COBRADO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  VENCIDO: "bg-red-100 text-red-800 border-red-300",
};

type CampoFactura = "estado" | "tipo" | "cliente" | "total" | "fechaEmision";

function mapDbToFactura(row: Record<string, unknown>): FacturaContable {
  return {
    id: row.id as string,
    tipo: ((row.tipo as string) ?? "COMPRA") as TipoFactura,
    cliente: (row.contacto_nombre as string) ?? "",
    numeroFactura: (row.numero as string) ?? "",
    tipoFactura: "Ordinaria",
    fechaEmision: (row.fecha as string) ?? "",
    fechaPago: (row.fecha_cobro as string) ?? "",
    estado: ((row.estado as string) ?? "PENDIENTE") as EstadoFactura,
    total: (row.total as number) ?? 0,
    diasTarde: undefined,
  };
}

export function FacturasView() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [facturas, setFacturas] = useState<FacturaContable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FiltroActivo<CampoFactura>[]>([]);
  const [showConfig, setShowConfig] = useState(false);

  const loadFacturas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFacturas();
      if (res.ok) {
        setFacturas(res.data.map(mapDbToFactura));
      } else {
        toast.error("Error al cargar facturas");
      }
    } catch {
      toast.error("Error de conexion al cargar facturas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFacturas();
  }, [loadFacturas]);

  const camposFiltro = useMemo((): CampoFiltro<CampoFactura>[] => {
    const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
    return [
      { campo: "estado", label: "Estado", tipo: "lista", opciones: ["PENDIENTE", "PAGADO", "COBRADO", "VENCIDO"] },
      { campo: "tipo", label: "Tipo", tipo: "lista", opciones: ["VENTA", "COMPRA"] },
      { campo: "cliente", label: "Cliente", tipo: "lista", opciones: uniq(facturas.map(f => f.cliente)) },
      { campo: "total", label: "Total €", tipo: "numero" },
      { campo: "fechaEmision", label: "Fecha emisión", tipo: "fecha" },
    ];
  }, [facturas]);

  const filtradas = useMemo(() => facturas.filter(f => {
    const matchTab = tab === "TODAS" || f.tipo === tab;
    if (!matchTab) return false;
    for (const fl of filtros) {
      if (fl.campo === "estado" && fl.valores?.length && !fl.valores.includes(f.estado)) return false;
      if (fl.campo === "tipo" && fl.valores?.length && !fl.valores.includes(f.tipo)) return false;
      if (fl.campo === "cliente" && fl.valores?.length && !fl.valores.includes(f.cliente)) return false;
      if (fl.campo === "total" && fl.numVal !== undefined) {
        if (fl.operador === "mayor" && !(f.total > fl.numVal)) return false;
        if (fl.operador === "menor" && !(f.total < fl.numVal)) return false;
        if (fl.operador === "igual" && !(f.total === fl.numVal)) return false;
      }
      if (fl.campo === "fechaEmision") {
        if (fl.desde && f.fechaEmision < fl.desde) return false;
        if (fl.hasta && f.fechaEmision > fl.hasta) return false;
      }
    }
    const q = busqueda.toLowerCase();
    return !q || f.cliente.toLowerCase().includes(q) || f.numeroFactura.toLowerCase().includes(q);
  }), [facturas, tab, busqueda, filtros]);

  const estadoLabel = (f: FacturaContable) => {
    if (f.estado === "VENCIDO" && f.diasTarde) return `⏳ ${f.diasTarde} días tarde`;
    if (f.estado === "PAGADO") return "✓ Pagado";
    if (f.estado === "COBRADO") return "✓ Cobrado";
    return "✗ Pendiente";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Tabs */}
      <div className="border-b px-6 pt-4 flex items-center gap-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("pb-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3">
        <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
          <Button variant="primary" size="sm">
            <Plus className="h-4 w-4" />Nuevo
          </Button>
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por descripción, número…" className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <FiltrosAvanzados campos={camposFiltro} filtros={filtros} onChange={setFiltros} />
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Descargar">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs">Desde el inicio</Button>
          <Button size="icon" variant={showConfig ? "default" : "ghost"} className="h-8 w-8"
            onClick={() => setShowConfig(v => !v)} title="Configuración" aria-label="Configuración">
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {showConfig && (
        <div className="mx-6 mb-3 rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Configuración de facturas — próximamente.</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="text-[10px] text-muted-foreground mb-2">{filtradas.length} resultados</div>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Fecha de emisión</th>
                <th className="px-3 py-3 font-medium">Fecha de pago</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium text-right">Total</th>
                <th className="px-3 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(f => (
                <tr key={f.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3"><FileText className="h-4 w-4 text-muted-foreground" /></td>
                  <td className="px-3 py-3">
                    <p className="font-semibold">{f.cliente}</p>
                    <p className="text-[10px] text-muted-foreground">{f.numeroFactura} · {f.tipoFactura}</p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{f.fechaEmision}</td>
                  <td className="px-3 py-3 text-muted-foreground">{f.fechaPago || "—"}</td>
                  <td className="px-3 py-3">
                    <Badge className={cn("text-[10px]", estadoStyles[f.estado])} variant="outline">{estadoLabel(f)}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold">
                    {f.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                  </td>
                  <td className="px-3 py-3"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No se encontraron facturas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
