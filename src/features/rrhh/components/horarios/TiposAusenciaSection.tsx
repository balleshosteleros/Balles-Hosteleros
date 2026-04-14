import { useState } from "react";
import { getTiposAusencia, type TipoAusencia } from "@/features/rrhh/data/horarios";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, CalendarOff } from "lucide-react";

export function TiposAusenciaSection() {
  const tipos = getTiposAusencia();
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<TipoAusencia | null>(null);

  const filtrados = tipos.filter(t =>
    !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase()) || t.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarOff className="h-5 w-5 text-primary" />Tipos de ausencia</h2>
          <p className="text-sm text-muted-foreground">Define las ausencias reconocidas por el sistema</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditando(null); setShowModal(true); }}><Plus className="h-4 w-4" />Nuevo</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar tipo de ausencia..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Aprobación</TableHead>
              <TableHead>Justificante</TableHead>
              <TableHead>Desc. jornada</TableHead>
              <TableHead>Calendario</TableHead>
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
                    <div>
                      <p className="font-medium text-sm">{t.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">{t.descripcion}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{t.categoria}</Badge></TableCell>
                <TableCell><Badge variant={t.requiereAprobacion ? "default" : "outline"} className="text-xs">{t.requiereAprobacion ? "Sí" : "No"}</Badge></TableCell>
                <TableCell><Badge variant={t.requiereJustificante ? "default" : "outline"} className="text-xs">{t.requiereJustificante ? "Sí" : "No"}</Badge></TableCell>
                <TableCell><Badge variant={t.descuentaJornada ? "secondary" : "outline"} className="text-xs">{t.descuentaJornada ? "Sí" : "No"}</Badge></TableCell>
                <TableCell><Badge variant={t.reflejaCalendario ? "default" : "outline"} className="text-xs">{t.reflejaCalendario ? "Sí" : "No"}</Badge></TableCell>
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
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin tipos de ausencia</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar tipo de ausencia" : "Crear tipo de ausencia"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Nombre</label><Input defaultValue={editando?.nombre} placeholder="Ej: Vacaciones" /></div>
            <div><label className="text-sm font-medium">Descripción</label><Input defaultValue={editando?.descripcion} placeholder="Descripción" /></div>
            <div><label className="text-sm font-medium">Categoría</label><Input defaultValue={editando?.categoria} placeholder="Ej: Vacaciones, Bajas médicas..." /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Requiere aprobación</span><Switch defaultChecked={editando?.requiereAprobacion ?? true} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Requiere justificante</span><Switch defaultChecked={editando?.requiereJustificante ?? false} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Descuenta jornada</span><Switch defaultChecked={editando?.descuentaJornada ?? true} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Se refleja en calendario</span><Switch defaultChecked={editando?.reflejaCalendario ?? true} /></div>
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
