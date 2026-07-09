"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPuesto, updatePuesto, deletePuesto, listDepartamentosCatalogo } from "@/features/rrhh/actions/vacantes-actions";
import { upsertPuestoSalario, listNivelesDePuesto } from "@/features/rrhh/actions/puestos-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import type { PuestoSalarial, NivelSalarial } from "@/features/rrhh/data/puestos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = crear puesto nuevo; si viene, se edita el puesto y sus niveles. */
  editing: PuestoSalarial | null;
  onSaved: () => void;
}

type Depto = { id: string; nombre: string };

const ESTADOS: { value: PuestoSalarial["estado"]; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

function nivelVacio(nivel: number): NivelSalarial {
  return {
    nivel,
    vacaciones: "",
    salarioBruto: 0,
    nominaNeta: 0,
    efectivoExtra: 0,
    salarioNeto: 0,
    jornadaContrato: "",
    horasSemanales: 0,
    diasLibres: 0,
    horarioSemanal: [],
    observaciones: "",
    objetivos: [],
    estado: "activo",
  };
}

export function PuestoSalarioDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const esNuevo = editing === null;

  const [departamentos, setDepartamentos] = useState<Depto[]>([]);
  // Datos compartidos del puesto
  const [nombre, setNombre] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  // Datos de gestoría (compartidos por el puesto)
  const [convenio, setConvenio] = useState("");
  // Niveles (condiciones por nivel)
  const [niveles, setNiveles] = useState<NivelSalarial[]>([nivelVacio(1)]);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const cur = niveles[idx] ?? niveles[0];

  const setCur = (patch: Partial<NivelSalarial>) => {
    setNiveles((prev) => prev.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  };

  useEffect(() => {
    if (!open) return;
    void listDepartamentosCatalogo().then((r) => {
      if (r.ok) setDepartamentos(r.data as Depto[]);
    });
    // Datos compartidos
    setNombre(editing?.puesto ?? "");
    setDepartamentoId(editing?.departamentoId ?? "");
    setDescripcion(editing?.descripcion ?? "");
    setConvenio(editing?.convenioColectivo ?? "");
    setIdx(0);
    // Niveles: si edita, cargar de BD; si nuevo, un Nivel 1 vacío.
    if (editing) {
      setNiveles([nivelVacio(1)]); // placeholder mientras carga
      void listNivelesDePuesto(editing.id).then((r) => {
        if (r.ok && r.data.length > 0) setNiveles(r.data);
      });
    } else {
      setNiveles([nivelVacio(1)]);
    }
  }, [open, editing]);

  const addNivel = () => {
    const siguiente = Math.max(0, ...niveles.map((n) => n.nivel)) + 1;
    setNiveles((prev) => [...prev, nivelVacio(siguiente)]);
    setIdx(niveles.length);
  };

  const handleDelete = async () => {
    if (!editing) return;
    const ok = await confirmDelete({
      title: "¿Eliminar puesto?",
      description: `Se eliminará el puesto "${editing.puesto}" y su vacante. No se podrá si tiene empleados o candidatos asociados.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await deletePuesto(editing.id);
      if (!res.ok) { toast.error(res.error ?? "No se pudo eliminar el puesto"); return; }
      toast.success("Puesto eliminado");
      onSaved();
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!nombre.trim()) { toast.error("El nombre del puesto es obligatorio"); return; }
    if (!departamentoId) { toast.error("Selecciona el departamento"); return; }
    setSaving(true);
    try {
      let puestoId = editing?.id ?? "";
      if (esNuevo) {
        const res = await createPuesto({ nombre: nombre.trim(), departamento_id: departamentoId, descripcion: descripcion.trim() || null });
        if (!res.ok || !res.data) { toast.error(res.error ?? "No se pudo crear el puesto"); return; }
        puestoId = (res.data as { id: string }).id;
      } else {
        const upd = await updatePuesto({
          id: puestoId,
          nombre: nombre.trim(),
          departamento_id: departamentoId,
          descripcion: descripcion.trim() || null,
          convenio_colectivo: convenio,
        });
        if (!upd.ok) { toast.error(upd.error ?? "No se pudo actualizar el puesto"); return; }
      }
      // Guardar cada nivel (snapshot por puesto_id + nivel)
      for (const n of niveles) {
        const sal = await upsertPuestoSalario({
          puestoId,
          nivel: n.nivel,
          salarioBruto: n.salarioBruto,
          jornadaContrato: n.jornadaContrato,
          horasSemanales: n.horasSemanales,
          diasLibres: n.diasLibres,
          vacaciones: n.vacaciones,
          observaciones: n.observaciones,
          estado: n.estado,
          horarioSemanal: n.horarioSemanal,
          objetivos: n.objetivos,
        });
        if (!sal.ok) { toast.error(sal.error ?? "No se pudo guardar el nivel"); return; }
      }
      // Guardar datos de gestoría también al crear (updatePuesto tras crear).
      if (esNuevo && convenio) {
        await updatePuesto({
          id: puestoId,
          convenio_colectivo: convenio,
        });
      }
      toast.success(esNuevo ? "Puesto creado" : "Puesto actualizado");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{esNuevo ? "Nuevo puesto" : `Puesto · ${editing?.puesto}`}</DialogTitle>
          <DialogDescription>
            Define el puesto y sus condiciones. Al contratar se copian al empleado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Datos compartidos del puesto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-nombre">Puesto</Label>
              <Input id="ps-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Jefe de cocina" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-depto">Departamento</Label>
              <select
                id="ps-depto"
                value={departamentoId}
                onChange={(e) => setDepartamentoId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Selecciona…</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-desc">Descripción</Label>
            <Textarea id="ps-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Funciones y responsabilidades del puesto" />
          </div>

          {/* Condiciones del puesto (niveles ocultos de momento: se edita uno solo) */}
          <div className="rounded-md border border-border/60 p-3 space-y-4">
            <p className="text-xs font-medium text-muted-foreground">Condiciones del puesto</p>

            <div className="space-y-1.5">
              <Label htmlFor="ps-bruto">Salario bruto mensual (€)</Label>
              <Input id="ps-bruto" type="number" min={0} value={cur?.salarioBruto ?? 0} onChange={(e) => setCur({ salarioBruto: Number(e.target.value) || 0 })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ps-jornada">Jornada</Label>
                <Input id="ps-jornada" value={cur?.jornadaContrato ?? ""} onChange={(e) => setCur({ jornadaContrato: e.target.value })} placeholder="Ej. Completa" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-horas">Horas/semana</Label>
                <Input id="ps-horas" type="number" min={0} value={cur?.horasSemanales ?? 0} onChange={(e) => setCur({ horasSemanales: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-dias">Días libres</Label>
                <Input id="ps-dias" type="number" min={0} value={cur?.diasLibres ?? 0} onChange={(e) => setCur({ diasLibres: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-vac">Vacaciones</Label>
                <Input id="ps-vac" value={cur?.vacaciones ?? ""} onChange={(e) => setCur({ vacaciones: e.target.value })} placeholder="Ej. 30 días" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ps-estado">Estado</Label>
              <select
                id="ps-estado"
                value={cur?.estado === "inactivo" ? "inactivo" : "activo"}
                onChange={(e) => setCur({ estado: e.target.value as PuestoSalarial["estado"] })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {ESTADOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ps-obs">Observaciones</Label>
              <Textarea id="ps-obs" value={cur?.observaciones ?? ""} onChange={(e) => setCur({ observaciones: e.target.value })} rows={2} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ps-objetivos">Objetivos</Label>
              <Textarea
                id="ps-objetivos"
                value={(cur?.objetivos ?? []).join("\n")}
                onChange={(e) => setCur({ objetivos: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                rows={3}
                placeholder="Un objetivo por línea"
              />
            </div>
          </div>

          {/* Datos de gestoría (compartidos por el puesto) */}
          <div className="rounded-md border border-border/60 p-3 space-y-4">
            <p className="text-xs font-medium text-muted-foreground">Datos de gestoría</p>
            <div className="space-y-1.5">
              <Label htmlFor="ps-convenio">Convenio colectivo</Label>
              <Input id="ps-convenio" value={convenio} onChange={(e) => setConvenio(e.target.value)} placeholder="Ej. Hostelería de Madrid" />
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {!esNuevo ? (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> {deleting ? "Eliminando…" : "Eliminar puesto"}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || deleting}>{saving ? "Guardando…" : esNuevo ? "Crear puesto" : "Guardar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {confirmDeleteDialog}
    </Dialog>
  );
}
