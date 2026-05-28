"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PoliticaCancelacion } from "@/features/sala/data/reservas";
import {
  listPoliticasCancelacion,
  createPoliticaCancelacion,
  updatePoliticaCancelacion,
  deletePoliticaCancelacion,
} from "@/features/sala/actions/politicas-cancelacion-actions";

export function PoliticasCancelacionTab() {
  const [politicas, setPoliticas] = useState<PoliticaCancelacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    horasAntes: "",
    penalizacionPct: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listPoliticasCancelacion();
    if (res.ok) setPoliticas(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setCreando(true);
    const res = await createPoliticaCancelacion({
      nombre: form.nombre,
      descripcion: form.descripcion.trim() || null,
      horasAntes: form.horasAntes ? Number(form.horasAntes) : null,
      penalizacionPct: form.penalizacionPct ? Number(form.penalizacionPct) : null,
      orden: politicas.length + 1,
    });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear");
      return;
    }
    toast.success("Política añadida");
    setForm({ nombre: "", descripcion: "", horasAntes: "", penalizacionPct: "" });
    load();
  }

  async function patch(id: string, p: Parameters<typeof updatePoliticaCancelacion>[1]) {
    const res = await updatePoliticaCancelacion(id, p);
    if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
    else load();
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Borrar la política "${nombre}"?`)) return;
    const res = await deletePoliticaCancelacion(id);
    if (!res.ok) toast.error(res.error ?? "No se pudo borrar");
    else {
      toast.success("Política borrada");
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-1">Políticas de cancelación</h4>
        <p className="text-xs text-muted-foreground">
          Reglas que se aplican cuando un cliente cancela. Ejemplo: &quot;Si cancela con
          menos de 24 horas, se cobra el 50%&quot;. Al asignar una política a una reserva,
          aparece el icono de escudo azul en la lista.
        </p>
      </div>

      <div className="border rounded-md divide-y">
        <div className="grid grid-cols-[1fr_2fr_90px_90px_90px_40px] gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
          <span>Nombre</span>
          <span>Descripción</span>
          <span className="text-right">Horas antes</span>
          <span className="text-right">% Penaliz.</span>
          <span className="text-center">Activa</span>
          <span></span>
        </div>
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Cargando…</div>
        ) : politicas.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Sin políticas. Crea la primera abajo.
          </div>
        ) : (
          politicas.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1fr_2fr_90px_90px_90px_40px] gap-2 px-3 py-2 items-center"
            >
              <Input
                defaultValue={p.nombre}
                className="h-8 text-xs"
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== p.nombre &&
                  patch(p.id, { nombre: e.target.value })
                }
              />
              <Input
                defaultValue={p.descripcion ?? ""}
                className="h-8 text-xs"
                onBlur={(e) =>
                  e.target.value !== (p.descripcion ?? "") &&
                  patch(p.id, { descripcion: e.target.value || null })
                }
              />
              <Input
                type="number"
                min={0}
                defaultValue={p.horasAntes ?? ""}
                className="h-8 text-xs text-right"
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== p.horasAntes) patch(p.id, { horasAntes: v });
                }}
              />
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={p.penalizacionPct ?? ""}
                className="h-8 text-xs text-right"
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== p.penalizacionPct) patch(p.id, { penalizacionPct: v });
                }}
              />
              <div className="flex justify-center">
                <Switch
                  checked={p.activa}
                  onCheckedChange={(v) => patch(p.id, { activa: v })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(p.id, p.nombre)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="border rounded-md p-3 bg-muted/30 space-y-2">
        <div className="text-xs font-medium">Añadir política</div>
        <div className="grid grid-cols-[1fr_90px_90px_120px] gap-2">
          <Input
            placeholder="Nombre (p.ej. 'Cancelación 24h')"
            value={form.nombre}
            onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            type="number"
            min={0}
            placeholder="Horas"
            value={form.horasAntes}
            onChange={(e) => setForm((p) => ({ ...p, horasAntes: e.target.value }))}
            className="h-8 text-xs text-right"
          />
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            placeholder="% Penaliz."
            value={form.penalizacionPct}
            onChange={(e) => setForm((p) => ({ ...p, penalizacionPct: e.target.value }))}
            className="h-8 text-xs text-right"
          />
          <Button size="sm" onClick={handleCreate} disabled={creando} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
          </Button>
        </div>
        <Textarea
          placeholder="Descripción (opcional) — qué se cobra y cuándo."
          value={form.descripcion}
          onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
          className="text-xs min-h-[60px]"
        />
      </div>
    </div>
  );
}
