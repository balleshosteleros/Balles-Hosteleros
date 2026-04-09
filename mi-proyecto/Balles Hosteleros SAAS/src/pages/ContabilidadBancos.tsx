import { useState } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, RefreshCw, Settings2, Trash2, ChevronDown, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_BANCOS, BancoConectado } from "@/data/contabilidad";

export default function ContabilidadBancos() {
  const { empresaActual } = useEmpresa();
  const [busqueda, setBusqueda] = useState("");
  const [bancos] = useState(SAMPLE_BANCOS);

  const filtrados = bancos.filter(b => !busqueda || b.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <h1 className="text-xl font-bold">Bancos</h1>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Button className="gap-1.5"><Plus className="h-4 w-4" />Conectar banco</Button>
        <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="space-y-3">
        {filtrados.map(b => (
          <div key={b.id} className="border rounded-xl p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
            {/* Icon */}
            <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white shrink-0", b.color)}>
              <Landmark className="h-5 w-5" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-bold text-sm">{b.nombre}</p>
                  <p className="text-xs text-muted-foreground">{b.productos} producto{b.productos !== 1 ? "s" : ""} conectado{b.productos !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </div>

            {/* Sync info */}
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sincronización</p>
              <p className="text-xs">{b.sincronizacion === "MANUAL" ? "Manual" : "Automática"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Última modificación</p>
              <p className="text-xs">{b.ultimaSync}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8"><Search className="h-4 w-4" /></Button>
              {b.sincronizacion === "AUTOMATICA" && <Button variant="ghost" size="icon" className="h-8 w-8"><RefreshCw className="h-4 w-4" /></Button>}
              {b.sincronizacion === "MANUAL" && <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>}
              <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
