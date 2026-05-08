"use client";

import { useEffect, useMemo, useState } from "react";
import { useTiposAusencia, type TipoAusenciaRow } from "@/features/rrhh/hooks/useHorariosConfig";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, CalendarOff } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

type FormState = {
  nombre: string;
  descripcion: string;
  categoria: string;
  color: string;
  requiere_aprobacion: boolean;
  requiere_justificante: boolean;
  descuenta_jornada: boolean;
  refleja_calendario: boolean;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  descripcion: "",
  categoria: "",
  color: "bg-slate-500",
  requiere_aprobacion: true,
  requiere_justificante: false,
  descuenta_jornada: true,
  refleja_calendario: true,
  activo: true,
};

export function TiposAusenciaSection() {
  const { items, loading, create, update, remove } = useTiposAusencia();
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<TipoAusenciaRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showModal) {
      if (editando) {
        setForm({
          nombre: editando.nombre,
          descripcion: editando.descripcion ?? "",
          categoria: editando.categoria,
          color: editando.color,
          requiere_aprobacion: editando.requiere_aprobacion,
          requiere_justificante: editando.requiere_justificante,
          descuenta_jornada: editando.descuenta_jornada,
          refleja_calendario: editando.refleja_calendario,
          activo: editando.activo,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [showModal, editando]);

  const filtrados = useMemo(() => items.filter((t) =>
    !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase()) || t.categoria.toLowerCase().includes(busqueda.toLowerCase())
  ), [items, busqueda]);

  const guardar = async () => {
    if (!form.nombre.trim()) return;
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
    if (!confirm("¿Eliminar este tipo de ausencia?")) return;
    await remove(id);
  };

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
            {loading && items.length === 0 ? (
              <TableRow><TableCell colSpan={8}><LoadingSpinner size="sm" className="py-2" /></TableCell></TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin tipos de ausencia</TableCell></TableRow>
            ) : (
              filtrados.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${t.color}`} />
                      <div>
                        <p className="font-medium text-sm">{t.nombre}</p>
                        {t.descripcion && <p className="text-[10px] text-muted-foreground">{t.descripcion}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{t.categoria}</Badge></TableCell>
                  <TableCell><Badge variant={t.requiere_aprobacion ? "default" : "outline"} className="text-xs">{t.requiere_aprobacion ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Badge variant={t.requiere_justificante ? "default" : "outline"} className="text-xs">{t.requiere_justificante ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Badge variant={t.descuenta_jornada ? "secondary" : "outline"} className="text-xs">{t.descuenta_jornada ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell><Badge variant={t.refleja_calendario ? "default" : "outline"} className="text-xs">{t.refleja_calendario ? "Sí" : "No"}</Badge></TableCell>
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
          <DialogHeader><DialogTitle>{editando ? "Editar tipo de ausencia" : "Crear tipo de ausencia"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Vacaciones" />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción" />
            </div>
            <div>
              <label className="text-sm font-medium">Categoría</label>
              <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ej: Vacaciones, Bajas médicas..." />
            </div>
            <div className="flex items-center justify-between"><span className="text-sm">Requiere aprobación</span><Switch checked={form.requiere_aprobacion} onCheckedChange={v => setForm(f => ({ ...f, requiere_aprobacion: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Requiere justificante</span><Switch checked={form.requiere_justificante} onCheckedChange={v => setForm(f => ({ ...f, requiere_justificante: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Descuenta jornada</span><Switch checked={form.descuenta_jornada} onCheckedChange={v => setForm(f => ({ ...f, descuenta_jornada: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Se refleja en calendario</span><Switch checked={form.refleja_calendario} onCheckedChange={v => setForm(f => ({ ...f, refleja_calendario: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Switch checked={form.activo} onCheckedChange={v => setForm(f => ({ ...f, activo: v }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving || !form.nombre.trim()}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
