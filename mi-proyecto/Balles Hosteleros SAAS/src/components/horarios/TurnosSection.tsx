import { useState } from "react";
import { getTurnosConfigPorEmpresa, type Turno } from "@/data/horarios";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Copy, Trash2, Search, Clock } from "lucide-react";

export function TurnosSection({ empresaId }: { empresaId: string }) {
  const turnos = getTurnosConfigPorEmpresa(empresaId);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Turno | null>(null);

  const filtrados = turnos.filter(t =>
    !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase()) || t.codigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Turnos</h2>
          <p className="text-sm text-muted-foreground">Configura los tipos de turno disponibles en la empresa</p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setEditando(null); setShowModal(true); }}><Plus className="h-4 w-4" />Crear turno</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar turno..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Turno</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead>Tolerancia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map(t => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${t.color}`} />
                    <span className="font-medium text-sm">{t.nombre}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-xs font-mono">{t.codigo}</Badge></TableCell>
                <TableCell className="text-sm">{t.horaInicio} — {t.horaFin}</TableCell>
                <TableCell className="text-sm text-right font-semibold">{t.duracion}h</TableCell>
                <TableCell className="text-sm text-muted-foreground">±{t.toleranciaMinutos} min</TableCell>
                <TableCell>
                  <Badge variant={t.activo ? "default" : "secondary"} className="text-xs">
                    {t.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditando(t); setShowModal(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin turnos configurados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar turno" : "Crear turno"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Nombre</label><Input defaultValue={editando?.nombre} placeholder="Ej: Mañana" /></div>
              <div><label className="text-sm font-medium">Código</label><Input defaultValue={editando?.codigo} placeholder="Ej: MAN" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Hora inicio</label><Input type="time" defaultValue={editando?.horaInicio} /></div>
              <div><label className="text-sm font-medium">Hora fin</label><Input type="time" defaultValue={editando?.horaFin} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Duración (h)</label><Input type="number" defaultValue={editando?.duracion} /></div>
              <div><label className="text-sm font-medium">Tolerancia (min)</label><Input type="number" defaultValue={editando?.toleranciaMinutos} /></div>
            </div>
            <div><label className="text-sm font-medium">Descripción</label><Input defaultValue={editando?.descripcion} placeholder="Descripción del turno" /></div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Activo</span>
              <Switch defaultChecked={editando?.activo ?? true} />
            </div>
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
