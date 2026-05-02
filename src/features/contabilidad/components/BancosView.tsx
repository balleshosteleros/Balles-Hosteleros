"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Plus, Search, RefreshCw, Settings, Trash2, ChevronDown, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_BANCOS, BancoConectado } from "@/features/contabilidad/data/contabilidad";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";

export function BancosView() {
  const { empresaActual } = useEmpresa();
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [bancos] = useState(SAMPLE_BANCOS);

  const acceso = (b: BancoConectado, campo: string): unknown => {
    if (campo === "nombre") return b.nombre;
    if (campo === "sincronizacion") return b.sincronizacion === "AUTOMATICA" ? "Automática" : "Manual";
    if (campo === "productos") return b.productos;
    if (campo === "ultimaSync") return b.ultimaSync;
    return (b as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = bancos.filter(b => !busqueda || b.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [bancos, busqueda, filtros, orden]);

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar banco..."
        textoNuevo="Conectar banco"
        onNuevo={() => { /* nuevo */ }}
        campos={[
          { campo: "sincronizacion", label: "Sincronización", tipo: "lista", opciones: ["Automática", "Manual"] },
          { campo: "productos", label: "Productos", tipo: "numero" },
        ]}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "nombre", label: "Nombre" },
          { campo: "productos", label: "Productos" },
          { campo: "ultimaSync", label: "Última sync" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
      />

      <div className="space-y-3">
        {filtrados.map(b => (
          <div key={b.id} className="border rounded-xl p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
            <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white shrink-0", b.color)}>
              <Landmark className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-bold text-sm">{b.nombre}</p>
                  <p className="text-xs text-muted-foreground">{b.productos} producto{b.productos !== 1 ? "s" : ""} conectado{b.productos !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sincronización</p>
              <p className="text-xs">{b.sincronizacion === "MANUAL" ? "Manual" : "Automática"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Última modificación</p>
              <p className="text-xs">{b.ultimaSync}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8"><Search className="h-4 w-4" /></Button>
              {b.sincronizacion === "AUTOMATICA" && <Button variant="ghost" size="icon" className="h-8 w-8"><RefreshCw className="h-4 w-4" /></Button>}
              {b.sincronizacion === "MANUAL" && <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>}
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Configuración"><Settings className="h-4 w-4" strokeWidth={1.75} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
