"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createReceta } from "../actions/recetas-actions";
import { IngredientesEditor, type IngredienteLinea } from "./IngredientesEditor";

// Destinos UI → valor BD. "sala" se muestra como "Barra" según convención del cliente.
const DESTINO_OPCIONES = [
  { value: "cocina" as const, label: "Cocina" },
  { value: "sala" as const,   label: "Barra" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NuevaRecetaDialog({ open, onOpenChange, onCreated }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [destino, setDestino] = useState<"cocina" | "sala">("cocina");
  const [elaboracion, setElaboracion] = useState("");
  const [tiempo, setTiempo] = useState("");
  const [pvp, setPvp] = useState("");
  const [ingredientes, setIngredientes] = useState<IngredienteLinea[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nombre.trim()) {
      toast.error("Falta el nombre de la receta");
      return;
    }
    setSaving(true);
    try {
      const res = await createReceta({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        destino,
        esc_elaboracion: elaboracion.trim() || undefined,
        esc_tiempo_preparacion: tiempo ? parseInt(tiempo, 10) : undefined,
        esc_pvp_propuesto: pvp ? parseFloat(pvp) : undefined,
        ingredientes: ingredientes
          .filter((i) => i.producto_id || (i.nombre_libre ?? "").trim())
          .map((i) => ({
            producto_id: i.producto_id,
            nombre_libre: i.nombre_libre,
            cantidad: i.cantidad ?? undefined,
            unidad: i.unidad,
            prioridad: i.prioridad,
          })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Receta propuesta");
      setNombre(""); setDescripcion(""); setElaboracion("");
      setTiempo(""); setPvp("");
      setIngredientes([]);
      onCreated();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proponer nueva receta</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Los datos son los mismos que los de un escandallo. Al aprobarse se publicarán oficialmente.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nombre de la receta *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Tataki de atún"
            />
          </div>

          <div className="col-span-2">
            <Label>Descripción</Label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Idea general, inspiración, presentación..."
              className="mt-1 w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <Label>Destino</Label>
            <Select value={destino} onValueChange={(v) => setDestino(v as typeof destino)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESTINO_OPCIONES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tiempo preparación (min)</Label>
            <Input type="number" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
          </div>

          <div>
            <Label>PVP propuesto (€)</Label>
            <Input type="number" step="0.01" value={pvp} onChange={(e) => setPvp(e.target.value)} />
          </div>

          <div />

          <div className="col-span-2">
            <Label>Elaboración</Label>
            <textarea
              value={elaboracion}
              onChange={(e) => setElaboracion(e.target.value)}
              placeholder="Pasos de preparación..."
              className="mt-1 w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="col-span-2">
            <IngredientesEditor value={ingredientes} onChange={setIngredientes} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Creando..." : "Proponer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
