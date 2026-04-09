import { useState } from "react";
import { getTiposFichaje, type TipoFichaje } from "@/data/horarios";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Fingerprint } from "lucide-react";

export function TiposFichajeSection() {
  const tipos = getTiposFichaje();
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<TipoFichaje | null>(null);

  const filtrados = tipos.filter(t =>
    !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Fingerprint className="h-5 w-5 text-primary" />Tipos de fichaje</h2>
          <p className="text-sm text-muted-foreground">Define los tipos de fichaje que registra el sistema</p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setEditando(null); setShowModal(true); }}><Plus className="h-4 w-4" />Crear tipo</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar tipo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Computa tiempo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-sm">{t.nombre}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs font-mono">{t.codigo}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.descripcion}</TableCell>
                <TableCell><Badge variant={t.computaTiempo ? "default" : "outline"} className="text-xs">{t.computaTiempo ? "Sí" : "No"}</Badge></TableCell>
                <TableCell><Badge variant={t.activo ? "default" : "secondary"} className="text-xs">{t.activo ? "Activo" : "Inactivo"}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditando(t); setShowModal(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin tipos de fichaje</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar tipo de fichaje" : "Crear tipo de fichaje"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Nombre</label><Input defaultValue={editando?.nombre} placeholder="Ej: Entrada" /></div>
              <div><label className="text-sm font-medium">Código</label><Input defaultValue={editando?.codigo} placeholder="Ej: ENT" /></div>
            </div>
            <div><label className="text-sm font-medium">Descripción</label><Input defaultValue={editando?.descripcion} placeholder="Descripción" /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Computa tiempo</span><Switch defaultChecked={editando?.computaTiempo ?? true} /></div>
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
