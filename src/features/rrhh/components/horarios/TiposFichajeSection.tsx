"use client";

import { useEffect, useMemo, useState } from "react";
import { useTiposFichaje, type TipoFichajeRow } from "@/features/rrhh/hooks/useHorariosConfig";
import { SelectorReplicarEmpresas } from "@/features/empresa/components/SelectorReplicarEmpresas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Fingerprint, Check } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { FICHAJE_COLOR_PALETTE, fichajeColorDot } from "@/features/rrhh/data/fichajes";

type FormState = {
  nombre: string;
  codigo: string;
  descripcion: string;
  computa_tiempo: boolean;
  color: string;
  requiere_solicitud: boolean;
  margen_antes_min: number;
  margen_despues_min: number;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  codigo: "",
  descripcion: "",
  computa_tiempo: true,
  color: "sky",
  requiere_solicitud: false,
  margen_antes_min: 15,
  margen_despues_min: 15,
  activo: true,
};

export function TiposFichajeSection({ empresaId }: { empresaId: string }) {
  const { items, loading, create, update, remove } = useTiposFichaje(empresaId);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<TipoFichajeRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [empresasReplicar, setEmpresasReplicar] = useState<string[]>([empresaId]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showModal) {
      if (editando) {
        setForm({
          nombre: editando.nombre,
          codigo: editando.codigo,
          descripcion: editando.descripcion ?? "",
          computa_tiempo: editando.computa_tiempo,
          color: editando.color ?? "sky",
          requiere_solicitud: editando.requiere_solicitud ?? false,
          margen_antes_min: editando.margen_antes_min ?? 0,
          margen_despues_min: editando.margen_despues_min ?? 0,
          activo: editando.activo,
        });
      } else {
        setForm(EMPTY_FORM);
        setEmpresasReplicar([empresaId]);
      }
    }
  }, [showModal, editando, empresaId]);

  const filtrados = useMemo(() => items.filter((t) =>
    !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase())
  ), [items, busqueda]);

  const guardar = async () => {
    if (!form.nombre.trim() || !form.codigo.trim()) return;
    setSaving(true);
    try {
      const ok = editando
        ? await update(editando.id, form)
        : await create(form, empresasReplicar);
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
        <Button variant="primary" size="sm" onClick={() => { setEditando(null); setShowModal(true); }} className="gap-1.5"><Plus className="h-4 w-4" />Nuevo</Button>
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
              <TableHead>Modo</TableHead>
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
                  <TableCell className="font-medium text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${fichajeColorDot(t.color)}`} />
                      {t.nombre}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs font-mono">{t.codigo}</Badge></TableCell>
                  <TableCell>
                    {t.requiere_solicitud ? (
                      <Badge variant="outline" className="text-xs">Solo por solicitud</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Normal · −{t.margen_antes_min ?? 0}/+{t.margen_despues_min ?? 0} min
                      </span>
                    )}
                  </TableCell>
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

            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {FICHAJE_COLOR_PALETTE.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    title={c.label}
                    onClick={() => setForm(f => ({ ...f, color: c.key }))}
                    className={`h-7 w-7 rounded-full flex items-center justify-center ${fichajeColorDot(c.key)} ${form.color === c.key ? "ring-2 ring-offset-2 ring-foreground/40" : ""}`}
                  >
                    {form.color === c.key && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Color con el que se marca este tipo en la lista de fichajes.</p>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Solo por solicitud</span>
                  <p className="text-[11px] text-muted-foreground">Si se activa, este tipo solo está disponible cuando el empleado tiene una solicitud de trabajo aprobada para ese día.</p>
                </div>
                <Switch checked={form.requiere_solicitud} onCheckedChange={v => setForm(f => ({ ...f, requiere_solicitud: v }))} />
              </div>

              {!form.requiere_solicitud && (
                <div className="space-y-2 pt-1 border-t">
                  <p className="text-[11px] text-muted-foreground pt-2">Fichaje normal: el empleado debe tener horario asignado ese día. Sin horario no podrá fichar con este tipo. Define el margen permitido respecto a su horario.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Margen antes (min)</label>
                      <Input
                        type="number"
                        min={0}
                        value={form.margen_antes_min}
                        onChange={e => setForm(f => ({ ...f, margen_antes_min: Math.max(0, Number(e.target.value) || 0) }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Margen después (min)</label>
                      <Input
                        type="number"
                        min={0}
                        value={form.margen_despues_min}
                        onChange={e => setForm(f => ({ ...f, margen_despues_min: Math.max(0, Number(e.target.value) || 0) }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between"><span className="text-sm">Computa tiempo</span><Switch checked={form.computa_tiempo} onCheckedChange={v => setForm(f => ({ ...f, computa_tiempo: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Switch checked={form.activo} onCheckedChange={v => setForm(f => ({ ...f, activo: v }))} /></div>
            {!editando && (
              <SelectorReplicarEmpresas
                empresaActualId={empresaId}
                seleccionadas={empresasReplicar}
                onChange={setEmpresasReplicar}
              />
            )}
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
