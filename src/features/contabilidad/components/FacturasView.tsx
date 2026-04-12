"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, ChevronDown, MoreVertical, Download, Settings2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacturaContable, EstadoFactura, TipoFactura } from "@/features/contabilidad/data/contabilidad";
import { listFacturas, createFactura, updateFactura } from "@/features/contabilidad/actions/contabilidad-actions";
import { toast } from "sonner";

const TABS = [{ id: "TODAS", label: "Todas" }, { id: "VENTA", label: "Ventas" }, { id: "COMPRA", label: "Compras" }];

const estadoStyles: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 border-amber-300",
  PAGADO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  COBRADO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  VENCIDO: "bg-red-100 text-red-800 border-red-300",
};

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

  const filtradas = useMemo(() => facturas.filter(f => {
    const matchTab = tab === "TODAS" || f.tipo === tab;
    const q = busqueda.toLowerCase();
    return matchTab && (!q || f.cliente.toLowerCase().includes(q) || f.numeroFactura.toLowerCase().includes(q));
  }), [facturas, tab, busqueda]);

  const estadoLabel = (f: FacturaContable) => {
    if (f.estado === "VENCIDO" && f.diasTarde) return `⏳ ${f.diasTarde} días tarde`;
    if (f.estado === "PAGADO") return "✓ Pagado";
    if (f.estado === "COBRADO") return "✓ Cobrado";
    return "✗ Pendiente";
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="w-[220px] shrink-0 border-r bg-muted/20 p-4 space-y-2 overflow-y-auto">
        <p className="text-xs font-bold mb-1">Filtrar facturas</p>
        <p className="text-[10px] text-muted-foreground mb-3">{filtradas.length} resultados</p>
        {["Cobrado / Pagado", "Pendiente", "Vencido"].map(f => (
          <label key={f} className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="rounded" />{f}</label>
        ))}
        <Collapsible><CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground">Tipos de factura<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
        <div className="border-t pt-3 mt-2 grid grid-cols-2 gap-2">
          <div><p className="text-[10px] text-muted-foreground">Desde €</p><Input className="h-7 text-xs" defaultValue="0" /></div>
          <div><p className="text-[10px] text-muted-foreground">Hasta €</p><Input className="h-7 text-xs" defaultValue="1.000.000" /></div>
        </div>
        <Collapsible><CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground">Contactos<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
        <Collapsible><CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground">Cuentas bancarias<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 pt-4 flex items-center gap-6">
          {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>)}
        </div>
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por descripción, número..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
          <Button className="gap-1.5"><Plus className="h-4 w-4" />Nueva factura</Button>
          <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon"><Settings2 className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="text-xs">Desde el inicio</Button>
        </div>
        <div className="flex-1 overflow-auto px-6">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="py-2 font-medium w-8"></th>
              <th className="py-2 font-medium">Cliente</th><th className="py-2 font-medium">Fecha de emisión</th><th className="py-2 font-medium">Fecha de pago</th><th className="py-2 font-medium">Estado</th><th className="py-2 font-medium text-right">Total</th><th className="py-2 w-8"></th>
            </tr></thead>
            <tbody>
              {filtradas.map(f => (
                <tr key={f.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3"><FileText className="h-4 w-4 text-muted-foreground" /></td>
                  <td className="py-3"><p className="font-semibold">{f.cliente}</p><p className="text-[10px] text-muted-foreground">{f.numeroFactura} · {f.tipoFactura}</p></td>
                  <td className="py-3 text-muted-foreground">{f.fechaEmision}</td>
                  <td className="py-3 text-muted-foreground">{f.fechaPago || "—"}</td>
                  <td className="py-3"><Badge className={cn("text-[10px]", estadoStyles[f.estado])} variant="outline">{estadoLabel(f)}</Badge></td>
                  <td className="py-3 text-right font-mono font-semibold">{f.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td>
                  <td className="py-3"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
