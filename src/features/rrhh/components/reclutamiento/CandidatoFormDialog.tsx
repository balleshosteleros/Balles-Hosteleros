"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createCandidato } from "@/features/rrhh/actions/candidatos-actions";
import { listVacantes } from "@/features/rrhh/actions/vacantes-actions";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";
import { ORIGEN_LABELS } from "@/features/rrhh/data/reclutamiento";

type Origen =
  | "web" | "formulario" | "redes_sociales" | "recomendacion"
  | "base_datos" | "portal_empleo" | "otros";

interface VacanteRef { id: string; titulo: string; estado_publicacion: string }

interface FormState {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  vacante_id: string;
  origen: Origen;
  notas: string;
}

const FORM_VACIO: FormState = {
  nombre: "",
  apellidos: "",
  email: "",
  telefono: "",
  vacante_id: "",
  origen: "base_datos",
  notas: "",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export function CandidatoFormDialog({ open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [vacantes, setVacantes] = useState<VacanteRef[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setForm(FORM_VACIO);
      return;
    }
    void listVacantes().then((res) => {
      const vs = (res.data ?? []) as VacanteRef[];
      // Solo vacantes activas (publicadas o en borrador, no cerradas/archivadas)
      setVacantes(vs.filter((v) => v.estado_publicacion !== "cerrada" && v.estado_publicacion !== "archivada"));
    });
  }, [open]);

  function guardar() {
    if (!form.nombre.trim() || !form.email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    startTransition(async () => {
      const res = await createCandidato({
        nombre: form.nombre,
        apellidos: form.apellidos,
        email: form.email,
        telefono: form.telefono,
        vacante_id: form.vacante_id || null,
        origen: form.origen,
        notas: form.notas,
      });
      if (res.ok) {
        toast.success("Candidato añadido");
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(res.error || "Error al guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo candidato</DialogTitle>
          <DialogDescription>
            Añade a una persona a la base de candidatos. Entrará en la fase <b>Nuevo</b> y podrás moverla por el pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                onBlur={() => setForm((f) => ({ ...f, nombre: normalizarNombre(f.nombre) }))}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellidos">Apellidos</Label>
              <Input
                id="apellidos"
                value={form.apellidos}
                onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                onBlur={() => setForm((f) => ({ ...f, apellidos: normalizarNombre(f.apellidos) }))}
                placeholder="Apellidos"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nombre@ejemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                inputMode="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="+34 600 000 000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vacante</Label>
              <Select
                value={form.vacante_id || "__none__"}
                onValueChange={(v) => setForm({ ...form, vacante_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sin vacante asignada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin vacante asignada</SelectItem>
                  {vacantes.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origen</Label>
              <Select value={form.origen} onValueChange={(v) => setForm({ ...form, origen: v as Origen })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ORIGEN_LABELS) as Origen[]).map((o) => (
                    <SelectItem key={o} value={o}>{ORIGEN_LABELS[o]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={4}
              placeholder="Información relevante sobre el candidato (opcional)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Añadir candidato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
