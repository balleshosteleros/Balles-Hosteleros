import { useState } from "react";
import { getPatronesPorEmpresa, type Patron } from "@/data/horarios";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Copy, Trash2, Search, Layers } from "lucide-react";

const DIAS_LABEL: Record<string, string> = { L: "Lun", M: "Mar", X: "Mié", J: "Jue", V: "Vie", S: "Sáb", D: "Dom" };

export function PatronesSection({ empresaId }: { empresaId: string }) {
  const patrones = getPatronesPorEmpresa(empresaId);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Patron | null>(null);

  const filtrados = patrones.filter(p =>
    !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Patrones</h2>
          <p className="text-sm text-muted-foreground">Combinaciones de turnos para asignar fácilmente</p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setEditando(null); setShowModal(true); }}><Plus className="h-4 w-4" />Crear patrón</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar patrón..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtrados.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{p.nombre}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.descripcion}</p>
                </div>
                <Badge variant={p.activo ? "default" : "secondary"} className="text-xs shrink-0">{p.activo ? "Activo" : "Inactivo"}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {p.dias.map(d => (
                  <Badge key={d} variant="outline" className="text-[10px] px-1.5">{DIAS_LABEL[d] || d}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{p.duracionDias} días · {p.repetible ? "Repetible" : "No repetible"}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditando(p); setShowModal(true); }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Copy className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">Sin patrones configurados</div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar patrón" : "Crear patrón"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Nombre</label><Input defaultValue={editando?.nombre} placeholder="Ej: L-V Mañana" /></div>
            <div><label className="text-sm font-medium">Descripción</label><Input defaultValue={editando?.descripcion} placeholder="Descripción del patrón" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Duración (días)</label><Input type="number" defaultValue={editando?.duracionDias} /></div>
              <div className="flex items-center justify-between pt-5"><span className="text-sm">Repetible</span><Switch defaultChecked={editando?.repetible ?? true} /></div>
            </div>
            <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Switch defaultChecked={editando?.activo ?? true} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={() => setShowModal(false)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
