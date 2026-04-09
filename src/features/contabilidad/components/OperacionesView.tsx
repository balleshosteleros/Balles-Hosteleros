"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, ChevronDown, MoreVertical, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_OPERACIONES, OperacionContable, FILTROS_CONTABLES } from "@/features/contabilidad/data/contabilidad";

const TABS = [
  { id: "TODAS", label: "Todas" },
  { id: "ENTRADA", label: "Entradas" },
  { id: "SALIDA", label: "Salidas" },
];

const perioLabel: Record<string, string> = { MENSUAL: "Cada mes", TRIMESTRAL: "Cada trimestre", ANUAL: "Cada año", PUNTUAL: "Puntual", SEMANAL: "Cada semana" };

export function OperacionesView() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [ops] = useState(SAMPLE_OPERACIONES);

  const filtradas = useMemo(() => ops.filter(o => {
    const matchTab = tab === "TODAS" || o.tipo === tab;
    const q = busqueda.toLowerCase();
    return matchTab && (!q || o.descripcion.toLowerCase().includes(q) || o.contacto.toLowerCase().includes(q));
  }), [ops, tab, busqueda]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="w-[220px] shrink-0 border-r bg-muted/20 p-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-bold mb-1">Filtrar operaciones</p>
        <p className="text-[10px] text-muted-foreground mb-3">{filtradas.length} resultados</p>
        {FILTROS_CONTABLES.map(f => (
          <Collapsible key={f}><CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground hover:text-foreground">{f}<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
        ))}
        <div className="border-t pt-3 mt-3"><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="rounded" />Sin ninguna etiqueta</label></div>
        <div className="border-t pt-3 mt-3 grid grid-cols-2 gap-2">
          <div><p className="text-[10px] text-muted-foreground">Desde</p><Input className="h-7 text-xs" defaultValue="0" /></div>
          <div><p className="text-[10px] text-muted-foreground">Hasta</p><Input className="h-7 text-xs" defaultValue="1.000.000" /></div>
        </div>
        <Collapsible><CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground">Contactos<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
        <Collapsible><CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground">Cuentas bancarias<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 pt-4 flex items-center gap-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>
          ))}
        </div>
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
          <Button className="gap-1.5"><Plus className="h-4 w-4" />Añadir operación</Button>
        </div>
        <div className="flex-1 overflow-auto px-6">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="py-2 font-medium">Descripción</th><th className="py-2 font-medium">Periodicidad</th><th className="py-2 font-medium">Finaliza</th><th className="py-2 font-medium">Etiquetas</th><th className="py-2 font-medium text-right">Total</th><th className="py-2 w-24"></th>
            </tr></thead>
            <tbody>
              {filtradas.map(o => (
                <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground shrink-0" /><div><p className="font-semibold">{o.descripcion}</p><p className="text-[10px] text-muted-foreground">{o.contacto || "—"}</p></div></div></td>
                  <td className="py-3 text-muted-foreground">{perioLabel[o.periodicidad] ?? o.periodicidad}</td>
                  <td className="py-3 text-muted-foreground">{o.fechaFin || "—"}</td>
                  <td className="py-3"><div className="flex gap-1 flex-wrap">{o.etiquetas.map(e => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}</div></td>
                  <td className="py-3 text-right font-mono font-semibold">{o.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td>
                  <td className="py-3 flex gap-1 justify-end"><Button variant="outline" size="sm" className="text-xs h-7">Ver facturas</Button><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
