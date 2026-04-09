import { useState } from "react";
import { getDescansosPorEmpresa, type Descanso } from "@/data/horarios";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Coffee } from "lucide-react";

export function DescansosSection({ empresaId }: { empresaId: string }) {
  const descansos = getDescansosPorEmpresa(empresaId);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Descanso | null>(null);

  const filtrados = descansos.filter(d =>
    !busqueda || d.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Coffee className="h-5 w-5 text-primary" />Descansos</h2>
          <p className="text-sm text-muted-foreground">Configura los descansos dentro de los turnos o la jornada</p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setEditando(null); setShowModal(true); }}><Plus className="h-4 w-4" />Crear descanso</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar descanso..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descanso</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead>Obligatorio</TableHead>
              <TableHead>Remunerado</TableHead>
              <TableHead>Descuenta jornada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{d.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">{d.descripcion}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-right font-semibold">{d.duracionMinutos} min</TableCell>
                <TableCell><Badge variant={d.obligatorio ? "default" : "outline"} className="text-xs">{d.obligatorio ? "Sí" : "No"}</Badge></TableCell>
                <TableCell><Badge variant={d.remunerado ? "default" : "outline"} className="text-xs">{d.remunerado ? "Sí" : "No"}</Badge></TableCell>
                <TableCell><Badge variant={d.descuentaJornada ? "secondary" : "outline"} className="text-xs">{d.descuentaJornada ? "Sí" : "No"}</Badge></TableCell>
                <TableCell><Badge variant={d.activo ? "default" : "secondary"} className="text-xs">{d.activo ? "Activo" : "Inactivo"}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditando(d); setShowModal(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin descansos configurados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar descanso" : "Crear descanso"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Nombre</label><Input defaultValue={editando?.nombre} placeholder="Ej: Pausa comida" /></div>
            <div><label className="text-sm font-medium">Duración (min)</label><Input type="number" defaultValue={editando?.duracionMinutos} /></div>
            <div><label className="text-sm font-medium">Descripción</label><Input defaultValue={editando?.descripcion} placeholder="Descripción del descanso" /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Obligatorio</span><Switch defaultChecked={editando?.obligatorio ?? false} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Remunerado</span><Switch defaultChecked={editando?.remunerado ?? true} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Descuenta jornada</span><Switch defaultChecked={editando?.descuentaJornada ?? false} /></div>
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
