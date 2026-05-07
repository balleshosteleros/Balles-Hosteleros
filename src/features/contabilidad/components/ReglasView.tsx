"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Pencil, Trash2, Zap, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_REGLAS, ReglaAutomatica } from "@/features/contabilidad/data/contabilidad";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { reglasIO } from "@/features/contabilidad/io/reglas.io";

export function ReglasView() {
  const { empresaActual } = useEmpresa();
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [reglas, setReglas] = useState(SAMPLE_REGLAS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const acceso = (r: ReglaAutomatica, campo: string): unknown => {
    if (campo === "nombre") return r.nombre;
    if (campo === "prioridad") return r.prioridad;
    if (campo === "activa") return r.activa;
    return (r as unknown as Record<string, unknown>)[campo];
  };

  const filtradas = useMemo(() => {
    let lista = reglas.filter(r => !busqueda || r.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [reglas, busqueda, filtros, orden]);

  const toggleRegla = (id: string) => {
    setReglas(prev => prev.map(r => r.id === id ? { ...r, activa: !r.activa } : r));
  };

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => setDialogOpen(true)}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        extraDerecha={
          <>
            <IOActions config={reglasIO} onSuccess={() => window.location.reload()} />
            <Button
              size="icon"
              variant={showConfig ? "default" : "outline"}
              className="h-9 w-9"
              onClick={() => setShowConfig((v) => !v)}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Crear regla automática</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Nombre de la regla</Label><Input placeholder="Ej: Etiquetar pagos Amazon" /></div>
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Condiciones</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Campo</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concepto">Concepto contiene</SelectItem>
                      <SelectItem value="importe_mayor">Importe mayor que</SelectItem>
                      <SelectItem value="importe_menor">Importe menor que</SelectItem>
                      <SelectItem value="banco">Banco es</SelectItem>
                      <SelectItem value="tipo">Tipo es</SelectItem>
                      <SelectItem value="contacto">Contacto es</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Valor</Label><Input placeholder="Ej: AMAZON" /></div>
              </div>
              <Button variant="outline" size="sm" className="text-xs">+ Añadir condición</Button>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acciones</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Acción</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="etiqueta">Asignar etiqueta</SelectItem>
                      <SelectItem value="categoria">Asignar categoría</SelectItem>
                      <SelectItem value="conciliar">Marcar como conciliado</SelectItem>
                      <SelectItem value="contacto">Asociar contacto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Valor</Label><Input placeholder="Ej: Compras" /></div>
              </div>
              <Button variant="outline" size="sm" className="text-xs">+ Añadir acción</Button>
            </div>
            <div><Label className="text-xs">Prioridad</Label>
              <Select defaultValue="MEDIA"><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="MEDIA">Media</SelectItem>
                  <SelectItem value="BAJA">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full">Crear regla</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg divide-y">
        {filtradas.map((r, idx) => (
          <div key={r.id} className={cn("flex items-center gap-3 px-4 py-4 hover:bg-muted/20 transition-colors", !r.activa && "opacity-50")}>
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <Zap className={cn("h-4 w-4", r.activa ? "text-amber-500" : "text-muted-foreground")} />
              <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{r.nombre}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-medium">Si</span> {r.condicionTexto} → <span className="font-medium">{r.accionTexto}</span>
              </p>
            </div>
            <Badge variant={r.prioridad === "ALTA" ? "destructive" : "secondary"} className="text-[10px] shrink-0">
              {r.prioridad}
            </Badge>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={r.activa} onCheckedChange={() => toggleRegla(r.id)} />
              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>

      {filtradas.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay reglas configuradas</p>
        </div>
      )}
    </div>
  );
}
