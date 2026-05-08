"use client";

import { useEffect, useMemo, useState } from "react";
import { useTiposFichaje, type TipoFichajeRow } from "@/features/rrhh/hooks/useHorariosConfig";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Fingerprint } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

type FormState = {
  nombre: string;
  codigo: string;
  descripcion: string;
  computa_tiempo: boolean;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  codigo: "",
  descripcion: "",
  computa_tiempo: true,
  activo: true,
};

export function TiposFichajeSection() {
  const { items, loading, create, update, remove } = useTiposFichaje();
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<TipoFichajeRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showModal) {
      if (editando) {
        setForm({
          nombre: editando.nombre,
          codigo: editando.codigo,
          descripcion: editando.descripcion ?? "",
          computa_tiempo: editando.computa_tiempo,
          activo: editando.activo,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [showModal, editando]);

  const filtrados = useMemo(() => items.filter((t) =>
    !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase())
  ), [items, busqueda]);

  const guardar = async () => {
    if (!form.nombre.trim() || !form.codigo.trim()) return;
    setSaving(true);
    try {
      const ok = editando
        ? await update(editando.id, form)
        : await create(form);
      if (ok) setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este tipo de fichaje?")) return;
    await remove(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Fingerprint className="h-5 w-5 text-primary" />Tipos de fichaje</h2>
          <p className="text-sm text-muted-foreground">Define los tipos de fichaje que registra el sistema</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditando(null); setShowModal(true); }}><Plus className="h-4 w-4" />Nuevo</Button>
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
            {loading && items.length === 0 ? (
              <TableRow><TableCell colSpan={6}><LoadingSpinner size="sm" className="py-2" /></TableCell></TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin tipos de fichaje</TableCell></TableRow>
            ) : (
              filtrados.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-sm">{t.nombre}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs font-mono">{t.codigo}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.descripcion}</TableCell>
                  <TableCell><Badge variant={t.computa_tiempo ? "default" : "outline"} className="text-xs">{t.computa_tiempo ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell>
                    <Switch
                      checked={t.activo}
                      onCheckedChange={(v) => update(t.id, { activo: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditando(t); setShowModal(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => eliminar(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar tipo de fichaje" : "Crear tipo de fichaje"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Entrada" />
              </div>
              <div>
                <label className="text-sm font-medium">Código</label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="Ej: ENT" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción" />
            </div>
            <div className="flex items-center justify-between"><span className="text-sm">Computa tiempo</span><Switch checked={form.computa_tiempo} onCheckedChange={v => setForm(f => ({ ...f, computa_tiempo: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Switch checked={form.activo} onCheckedChange={v => setForm(f => ({ ...f, activo: v }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving || !form.nombre.trim() || !form.codigo.trim()}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
