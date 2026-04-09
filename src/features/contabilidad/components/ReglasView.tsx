"use client";

import { useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, GripVertical, Pencil, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_REGLAS, ReglaAutomatica } from "@/features/contabilidad/data/contabilidad";

export function ReglasView() {
  const { empresaActual } = useEmpresa();
  const [busqueda, setBusqueda] = useState("");
  const [reglas, setReglas] = useState(SAMPLE_REGLAS);

  const filtradas = reglas.filter(r => !busqueda || r.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const toggleRegla = (id: string) => {
    setReglas(prev => prev.map(r => r.id === id ? { ...r, activa: !r.activa } : r));
  };

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Reglas automáticas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automatiza la categorización de transacciones y operaciones</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" />Nueva regla</Button>
          </DialogTrigger>
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
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar reglas..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
      </div>

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
