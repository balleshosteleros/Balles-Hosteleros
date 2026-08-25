"use client";

import { useEffect, useMemo, useState } from "react";
import { useTiposAusencia, type TipoAusenciaRow } from "@/features/rrhh/hooks/useHorariosConfig";
import type { ConteoDias } from "@/features/rrhh/actions/horarios-config-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Search, CalendarOff } from "lucide-react";
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
  const { items, loading, update } = useTiposAusencia(empresaId);
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
      }
    }
  }, [showModal, editando]);

  const filtrados = useMemo(() => items.filter((t) =>
    !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase())
  ), [items, busqueda]);

  // Lista cerrada: solo se edita lo existente (no hay alta ni borrado).
  const guardar = async () => {
    if (!editando || !form.nombre.trim()) return;
    setSaving(true);
    try {
      const ok = await update(editando.id, form);
      if (ok) setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarOff className="h-5 w-5 text-primary" />Ausencias</h2>
          <p className="text-sm text-muted-foreground">
            Configura las políticas de las ausencias que pueden pedir tus empleados. Desactiva
            las que no quieras ofrecer: dejarán de aparecer al solicitar.
          </p>
        </div>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {/* Vacaciones no usa este límite: su cupo está en el
                        calendario de cada empleado. */}
                    {t.subtipo === "vacaciones" ? "Según calendario" : formatLimite(t.limite_dias)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatConteo(t.conteo_dias)}</TableCell>
                  <TableCell><Badge variant={t.remunerada ? "default" : "outline"} className="text-xs">{t.remunerada ? "Sí" : "No"}</Badge></TableCell>
                  <TableCell>
                    <Switch
                      checked={t.activo}
                      onCheckedChange={(v) => update(t.id, { activo: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Lista cerrada: se configuran, no se borran. Para retirar
                        una ausencia se desactiva (conserva el histórico). */}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditando(t); setShowModal(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar ausencia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Baja médica" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Es el nombre que verá el empleado al solicitar esta ausencia.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Límite anual (días)</label>
                {/* En vacaciones el cupo NO sale de aquí, sino del calendario
                    asignado a cada empleado. Enseñar el campo aquí engañaba:
                    se rellenaba y no hacía nada. */}
                {editando?.subtipo === "vacaciones" ? (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Los días de vacaciones no se ponen aquí: salen del
                    calendario de vacaciones que tenga asignado cada empleado
                    (RRHH → Calendarios → Vacaciones), porque no todos tienen
                    los mismos.
                  </p>
                ) : (
                  <>
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
                      Días máximos por año natural. Al superarlo, el empleado no
                      puede enviar la solicitud. Déjalo vacío para no poner tope.
                    </p>
                  </>
                )}
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm">Activo</span>
                <p className="text-[11px] text-muted-foreground">
                  Si lo desactivas, el empleado deja de ver esta ausencia y no puede solicitarla.
                </p>
              </div>
              <Switch checked={form.activo} onCheckedChange={v => setForm(f => ({ ...f, activo: v }))} />
            </div>
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
