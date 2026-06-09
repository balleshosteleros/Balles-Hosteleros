"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createPuesto, listDepartamentosCatalogo } from "@/features/rrhh/actions/vacantes-actions";
import { upsertPuestoSalario } from "@/features/rrhh/actions/salarios-actions";
import type { PuestoSalarial } from "@/features/rrhh/data/salarios";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = crear puesto nuevo; si viene, se edita su salario. */
  editing: PuestoSalarial | null;
  onSaved: () => void;
}

type Depto = { id: string; nombre: string };

const ESTADOS: { value: PuestoSalarial["estado"]; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

export function PuestoSalarioDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const esNuevo = editing === null;

  const [departamentos, setDepartamentos] = useState<Depto[]>([]);
  const [nombre, setNombre] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [nominaNeta, setNominaNeta] = useState(0);
  const [efectivoExtra, setEfectivoExtra] = useState(0);
  const [jornadaContrato, setJornadaContrato] = useState("");
  const [horasSemanales, setHorasSemanales] = useState(0);
  const [diasLibres, setDiasLibres] = useState(0);
  const [vacaciones, setVacaciones] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [estado, setEstado] = useState<PuestoSalarial["estado"]>("borrador");
  const [saving, setSaving] = useState(false);

  const salarioNeto = nominaNeta + efectivoExtra;

  useEffect(() => {
    if (!open) return;
    void listDepartamentosCatalogo().then((r) => {
      if (r.ok) setDepartamentos(r.data as Depto[]);
    });
    // Prefill
    setNombre(editing?.puesto ?? "");
    setDepartamentoId("");
    setNominaNeta(editing?.nominaNeta ?? 0);
    setEfectivoExtra(editing?.efectivoExtra ?? 0);
    setJornadaContrato(editing?.jornadaContrato ?? "");
    setHorasSemanales(editing?.horasSemanales ?? 0);
    setDiasLibres(editing?.diasLibres ?? 0);
    setVacaciones(editing?.vacaciones ?? "");
    setObservaciones(editing?.observaciones ?? "");
    setEstado(editing?.estado ?? "borrador");
  }, [open, editing]);

  const handleSave = async () => {
    if (esNuevo) {
      if (!nombre.trim()) { toast.error("El nombre del puesto es obligatorio"); return; }
      if (!departamentoId) { toast.error("Selecciona el departamento"); return; }
    }
    setSaving(true);
    try {
      let puestoId = editing?.id ?? "";
      if (esNuevo) {
        const res = await createPuesto({ nombre: nombre.trim(), departamento_id: departamentoId });
        if (!res.ok || !res.data) { toast.error(res.error ?? "No se pudo crear el puesto"); return; }
        puestoId = (res.data as { id: string }).id;
      }
      const sal = await upsertPuestoSalario({
        id: undefined,
        puestoId,
        nominaNeta,
        efectivoExtra,
        salarioNeto,
        jornadaContrato,
        horasSemanales,
        diasLibres,
        vacaciones,
        observaciones,
        estado,
        horarioSemanal: editing?.horarioSemanal ?? [],
        objetivos: editing?.objetivos ?? [],
      });
      if (!sal.ok) { toast.error(sal.error ?? "No se pudo guardar el salario"); return; }
      toast.success(esNuevo ? "Puesto creado" : "Salario actualizado");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{esNuevo ? "Nuevo puesto" : `Salario · ${editing?.puesto}`}</DialogTitle>
          <DialogDescription>
            {esNuevo
              ? "Crea un puesto de trabajo (hijo de un departamento) y define su salario."
              : "Edita las condiciones salariales del puesto."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {esNuevo ? (
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
          ) : (
            <p className="text-sm text-muted-foreground">
              Departamento: <span className="font-medium text-foreground">{editing?.departamento || "—"}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-nomina">Nómina neta (€)</Label>
              <Input id="ps-nomina" type="number" min={0} value={nominaNeta} onChange={(e) => setNominaNeta(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-efectivo">Efectivo extra (€)</Label>
              <Input id="ps-efectivo" type="number" min={0} value={efectivoExtra} onChange={(e) => setEfectivoExtra(Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm flex justify-between">
            <span className="text-muted-foreground">Salario neto total</span>
            <span className="font-semibold">{eur(salarioNeto)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-jornada">Jornada</Label>
              <Input id="ps-jornada" value={jornadaContrato} onChange={(e) => setJornadaContrato(e.target.value)} placeholder="Ej. Completa" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-horas">Horas/semana</Label>
              <Input id="ps-horas" type="number" min={0} value={horasSemanales} onChange={(e) => setHorasSemanales(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-dias">Días libres</Label>
              <Input id="ps-dias" type="number" min={0} value={diasLibres} onChange={(e) => setDiasLibres(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-vac">Vacaciones</Label>
              <Input id="ps-vac" value={vacaciones} onChange={(e) => setVacaciones(e.target.value)} placeholder="Ej. 30 días" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-estado">Estado</Label>
            <select
              id="ps-estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as PuestoSalarial["estado"])}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {ESTADOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-obs">Observaciones</Label>
            <Textarea id="ps-obs" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : esNuevo ? "Crear puesto" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
