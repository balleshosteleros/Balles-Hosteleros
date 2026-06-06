"use client";

import { useEffect, useMemo, useState } from "react";
import { useTiposAusencia, type TipoAusenciaRow } from "@/features/rrhh/hooks/useHorariosConfig";
import type { ConteoDias } from "@/features/rrhh/actions/horarios-config-actions";
import { SelectorReplicarEmpresas } from "@/features/empresa/components/SelectorReplicarEmpresas";
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
  color: string;
  requiere_aprobacion: boolean;
  requiere_justificante: boolean;
  descuenta_jornada: boolean;
  limite_dias: number | null;
  conteo_dias: ConteoDias;
  remunerada: boolean;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  color: "bg-slate-500",
  requiere_aprobacion: true,
  requiere_justificante: false,
  descuenta_jornada: true,
  limite_dias: null,
  conteo_dias: "naturales",
  remunerada: false,
  activo: true,
};

const formatLimite = (dias: number | null) =>
  dias == null ? "Sin límite anual" : `${dias} días/año`;

const formatConteo = (c: ConteoDias) => (c === "naturales" ? "Naturales" : "Laborables");

export function TiposAusenciaSection({ empresaId }: { empresaId: string }) {
  const { items, loading, create, update, remove } = useTiposAusencia(empresaId);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<TipoAusenciaRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [empresasReplicar, setEmpresasReplicar] = useState<string[]>([empresaId]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showModal) {
      if (editando) {
        setForm({
          nombre: editando.nombre,
          color: editando.color,
          requiere_aprobacion: editando.requiere_aprobacion,
          requiere_justificante: editando.requiere_justificante,
          descuenta_jornada: editando.descuenta_jornada,
          limite_dias: editando.limite_dias,
          conteo_dias: editando.conteo_dias,
          remunerada: editando.remunerada,
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
    if (!form.nombre.trim()) return;
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
    if (!confirm("¿Eliminar este tipo de ausencia?")) return;
    await remove(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarOff className="h-5 w-5 text-primary" />Ausencias</h2>
          <p className="text-sm text-muted-foreground">Crea, configura y asigna las políticas de ausencias necesarias para tus empleados.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditando(null); setShowModal(true); }} className="gap-1.5"><Plus className="h-4 w-4" />Nuevo</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Límite anual</TableHead>
              <TableHead>Conteo días</TableHead>
              <TableHead>Remunerada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow><TableCell colSpan={6}><LoadingSpinner size="sm" className="py-2" /></TableCell></TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin tipos de ausencia</TableCell></TableRow>
            ) : (
              filtrados.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${t.color}`} />
                      <p className="font-medium text-sm">{t.nombre}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatLimite(t.limite_dias)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatConteo(t.conteo_dias)}</TableCell>
                  <TableCell><Badge variant={t.remunerada ? "default" : "outline"} className="text-xs">{t.remunerada ? "Sí" : "No"}</Badge></TableCell>
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
          <DialogHeader><DialogTitle>{editando ? "Editar ausencia" : "Crear ausencia"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Baja médica" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Límite anual (días)</label>
                <Input
                  type="number"
                  min={1}
                  value={form.limite_dias ?? ""}
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => ({ ...f, limite_dias: v === "" ? null : Math.max(1, Number(v)) }));
                  }}
                  placeholder="Sin límite"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Días máximos por año natural. Si se supera, solo un director puede aprobarlo.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Conteo días</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.conteo_dias}
                  onChange={e => setForm(f => ({ ...f, conteo_dias: e.target.value as ConteoDias }))}
                >
                  <option value="naturales">Naturales</option>
                  <option value="laborables">Laborables</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between"><span className="text-sm">Remunerada</span><Switch checked={form.remunerada} onCheckedChange={v => setForm(f => ({ ...f, remunerada: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Requiere aprobación</span><Switch checked={form.requiere_aprobacion} onCheckedChange={v => setForm(f => ({ ...f, requiere_aprobacion: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Requiere justificante</span><Switch checked={form.requiere_justificante} onCheckedChange={v => setForm(f => ({ ...f, requiere_justificante: v }))} /></div>
            <div className="flex items-center justify-between"><span className="text-sm">Descuenta jornada</span><Switch checked={form.descuenta_jornada} onCheckedChange={v => setForm(f => ({ ...f, descuenta_jornada: v }))} /></div>
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
            <Button onClick={guardar} disabled={saving || !form.nombre.trim()}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
