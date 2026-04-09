import { useState, useMemo } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_CONCILIACION } from "@/data/contabilidad";

const TABS = [{ id: "PENDIENTE", label: "Para conciliar" }, { id: "CONCILIADA", label: "Conciliadas" }];

export default function ContabilidadConciliacion() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("PENDIENTE");
  const [busqueda, setBusqueda] = useState("");
  const [items] = useState(SAMPLE_CONCILIACION);

  const filtrados = useMemo(() => items.filter(i => {
    const matchTab = tab === "PENDIENTE" ? !i.conciliada : i.conciliada;
    const q = busqueda.toLowerCase();
    return matchTab && (!q || i.transaccion.toLowerCase().includes(q));
  }), [items, tab, busqueda]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b px-6 pt-4 flex items-center gap-6">
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>)}
      </div>
      <div className="px-6 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar transacciones..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>
        <Button variant="outline" size="sm" className="text-xs">📅 Este año</Button>
        <Button variant="outline" size="icon" className="h-8 w-8"><Filter className="h-4 w-4" /></Button>
      </div>
      <div className="flex-1 overflow-auto px-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
            <th className="py-2 font-medium">Transacción ({filtrados.length})</th>
            <th className="py-2 font-medium">Fecha</th>
            <th className="py-2 font-medium text-right">Importe</th>
            <th className="py-2 font-medium text-center w-10"><ArrowLeftRight className="h-3.5 w-3.5 mx-auto" /></th>
            <th className="py-2 font-medium">Facturas</th>
            <th className="py-2 font-medium">Emisión</th>
            <th className="py-2 font-medium text-right">Total IVA inc.</th>
          </tr></thead>
          <tbody>
            {filtrados.map(c => (
              <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-3"><p className="font-semibold">{c.transaccion}</p><p className="text-[10px] text-muted-foreground">{c.banco}</p></td>
                <td className="py-3 text-muted-foreground">{c.fecha}</td>
                <td className={cn("py-3 text-right font-mono font-semibold", c.importe >= 0 ? "text-emerald-600" : "")}>{c.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</td>
                <td className="py-3"></td>
                <td className="py-3">
                  <div className="flex items-center gap-1 text-muted-foreground text-xs"><Search className="h-3 w-3" />Asociar facturas</div>
                </td>
                <td className="py-3 text-muted-foreground">{c.emision || ""}</td>
                <td className="py-3 text-right">
                  <Button variant="outline" size="sm" className="text-xs h-7">Conciliar sin factura</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
