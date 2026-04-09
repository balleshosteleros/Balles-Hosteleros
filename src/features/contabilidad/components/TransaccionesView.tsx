"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, ChevronDown, Download, Sparkles, Paperclip, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_TRANSACCIONES, TransaccionContable, FILTROS_CONTABLES } from "@/features/contabilidad/data/contabilidad";

const TABS = [{ id: "TODAS", label: "Todas" }, { id: "COBRO", label: "Cobros" }, { id: "PAGO", label: "Pagos" }];

export function TransaccionesView() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [txs] = useState(SAMPLE_TRANSACCIONES);

  const filtradas = useMemo(() => txs.filter(t => {
    const matchTab = tab === "TODAS" || t.tipo === tab;
    const q = busqueda.toLowerCase();
    return matchTab && (!q || t.concepto.toLowerCase().includes(q) || t.banco.toLowerCase().includes(q));
  }), [txs, tab, busqueda]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="w-[220px] shrink-0 border-r bg-muted/20 p-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-bold mb-1">Filtrar transacciones</p>
        <p className="text-[10px] text-muted-foreground mb-3">{filtradas.length} resultados</p>
        {["Conciliada", "Sin conciliar"].map(f => <label key={f} className="flex items-center gap-2 text-sm text-muted-foreground py-1"><input type="checkbox" className="rounded" />{f}</label>)}
        <div className="border-t pt-2 mt-2" />
        {FILTROS_CONTABLES.map(f => (
          <Collapsible key={f}><CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground hover:text-foreground">{f}<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
        ))}
        <div className="border-t pt-2 mt-2" />
        {["Efectivo", "Revolut", "BBVA"].map(b => (
          <Collapsible key={b}><CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground hover:text-foreground">{b}<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
        ))}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 pt-4 flex items-center gap-6">
          {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>)}
        </div>
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar transacciones de todos tus bancos..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
          <Button className="gap-1.5"><Plus className="h-4 w-4" />Añadir transacción</Button>
          <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="text-xs">Desde el inicio</Button>
          <Button variant="secondary" className="gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5" />Etiquetar con IA</Button>
        </div>
        <div className="flex-1 overflow-auto px-6">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="py-2 w-8"></th><th className="py-2 font-medium">Concepto</th><th className="py-2 font-medium">Etiquetas</th><th className="py-2 font-medium">Fecha</th><th className="py-2 font-medium">Documentos</th><th className="py-2 font-medium text-right">Cantidad</th><th className="py-2 w-8"></th>
            </tr></thead>
            <tbody>
              {filtradas.map(t => (
                <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 text-muted-foreground text-xs font-mono">℞</td>
                  <td className="py-3"><p className="font-semibold">{t.concepto}</p><p className="text-[10px] text-muted-foreground">{t.banco}</p></td>
                  <td className="py-3"><div className="flex gap-1 flex-wrap">{t.etiquetas.map((e, i) => <Badge key={i} className={cn("text-[9px] border", e.color)} variant="outline">{e.categoria}{e.detalle ? ` · ${e.detalle}` : ""}</Badge>)}{t.etiquetas.length > 0 && <span className="text-muted-foreground text-[10px]">+</span>}</div></td>
                  <td className="py-3 text-muted-foreground">{t.fecha}</td>
                  <td className="py-3">{t.documentos > 0 && <span className="flex items-center gap-1 text-muted-foreground text-xs"><Paperclip className="h-3 w-3" /><Badge variant="destructive" className="text-[9px] h-4 w-4 p-0 flex items-center justify-center rounded-full">{t.documentos}</Badge></span>}</td>
                  <td className={cn("py-3 text-right font-mono font-semibold", t.importe >= 0 ? "text-emerald-600" : "")}>{t.importe >= 0 ? "" : "↙ "}{t.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td>
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
