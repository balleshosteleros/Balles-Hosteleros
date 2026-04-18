"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Tags } from "lucide-react";
import { toast } from "sonner";
import { updateReceta, upsertIngredientes } from "../actions/recetas-actions";
import type { RecetaConExtras } from "../actions/recetas-actions";
import { IngredientesEditor, type IngredienteLinea } from "./IngredientesEditor";

interface Props {
  receta: RecetaConExtras;
  onChanged: () => void;
  // Si true, permite definir etiquetas finales (solo visible en fase Cata 2 en adelante)
  definirEtiquetasFinales?: boolean;
}

export function FichaTecnicaTab({ receta, onChanged, definirEtiquetasFinales }: Props) {
  const [nombre, setNombre] = useState(receta.nombre);
  const [descripcion, setDescripcion] = useState(receta.ft_descripcion ?? "");
  const [elaboracion, setElaboracion] = useState(receta.ft_elaboracion ?? "");
  const [tiempo, setTiempo] = useState(receta.ft_tiempo_preparacion?.toString() ?? "");
  const [partida, setPartida] = useState(receta.ft_partida ?? "");
  const [pvp, setPvp] = useState(receta.ft_pvp_propuesto?.toString() ?? "");
  const [coste, setCoste] = useState(receta.ft_coste_estimado?.toString() ?? "");
  const [alergenos, setAlergenos] = useState<string[]>(receta.ft_alergenos ?? []);
  const [nuevoAlergeno, setNuevoAlergeno] = useState("");
  const [etiquetas, setEtiquetas] = useState<string[]>(receta.ft_etiquetas_finales ?? []);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");

  const [ingredientes, setIngredientes] = useState<IngredienteLinea[]>(
    (receta.ingredientes ?? []).map((i) => ({
      tempId: i.id,
      producto_id: i.producto_id,
      nombre_libre: i.nombre_libre,
      cantidad: i.cantidad,
      unidad: i.unidad,
      prioridad: i.prioridad,
    })),
  );
  const [saving, setSaving] = useState(false);

  function addAlergeno() {
    if (!nuevoAlergeno.trim()) return;
    setAlergenos([...alergenos, nuevoAlergeno.trim()]);
    setNuevoAlergeno("");
  }

  function addEtiqueta() {
    if (!nuevaEtiqueta.trim()) return;
    setEtiquetas([...etiquetas, nuevaEtiqueta.trim()]);
    setNuevaEtiqueta("");
  }

  async function guardar() {
    setSaving(true);
    try {
      const res1 = await updateReceta(receta.id, {
        nombre,
        ft_descripcion: descripcion || null,
        ft_elaboracion: elaboracion || null,
        ft_tiempo_preparacion: tiempo ? parseInt(tiempo, 10) : null,
        ft_partida: partida || null,
        ft_pvp_propuesto: pvp ? parseFloat(pvp) : null,
        ft_coste_estimado: coste ? parseFloat(coste) : null,
        ft_alergenos: alergenos,
        ft_etiquetas_finales: etiquetas,
      });
      if (!res1.ok) { toast.error(res1.error); return; }

      const res2 = await upsertIngredientes(
        receta.id,
        ingredientes
          .filter((i) => i.producto_id || (i.nombre_libre ?? "").trim())
          .map((i) => ({
            producto_id: i.producto_id,
            nombre_libre: i.nombre_libre,
            cantidad: i.cantidad,
            unidad: i.unidad,
            prioridad: i.prioridad,
          })),
      );
      if (!res2.ok) { toast.error(res2.error); return; }

      toast.success("Ficha técnica guardada");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nombre de la receta</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="col-span-2">
          <Label>Descripción</Label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="mt-1 w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label>Partida</Label>
          <Input value={partida} onChange={(e) => setPartida(e.target.value)} placeholder="Caliente, fría, postres..." />
        </div>

        <div>
          <Label>Tiempo (min)</Label>
          <Input type="number" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
        </div>

        <div>
          <Label>PVP propuesto (€)</Label>
          <Input type="number" step="0.01" value={pvp} onChange={(e) => setPvp(e.target.value)} />
        </div>

        <div>
          <Label>Coste estimado (€)</Label>
          <Input type="number" step="0.01" value={coste} onChange={(e) => setCoste(e.target.value)} />
        </div>

        <div className="col-span-2">
          <Label>Elaboración</Label>
          <textarea
            value={elaboracion}
            onChange={(e) => setElaboracion(e.target.value)}
            className="mt-1 w-full min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Alérgenos */}
        <div className="col-span-2">
          <Label>Alérgenos</Label>
          <div className="flex flex-wrap gap-1 mt-1 mb-2">
            {alergenos.map((a, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="gap-1 cursor-pointer"
                onClick={() => setAlergenos(alergenos.filter((_, j) => j !== i))}
              >
                {a} <Trash2 className="h-3 w-3" />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Gluten, lactosa, frutos secos..."
              value={nuevoAlergeno}
              onChange={(e) => setNuevoAlergeno(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAlergeno())}
              className="h-8"
            />
            <Button size="sm" variant="outline" onClick={addAlergeno}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Etiquetas finales (solo en fase Cata 2 +) */}
        {definirEtiquetasFinales && (
          <div className="col-span-2">
            <Label className="inline-flex items-center gap-1.5">
              <Tags className="h-3.5 w-3.5" /> Etiquetas finales
            </Label>
            <p className="text-[11px] text-muted-foreground mb-1">
              Etiquetas definitivas que aparecerán en carta y ficha técnica oficial
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              {etiquetas.map((e, i) => (
                <Badge
                  key={i}
                  className="gap-1 cursor-pointer bg-primary/10 text-primary border-primary/30"
                  onClick={() => setEtiquetas(etiquetas.filter((_, j) => j !== i))}
                >
                  {e} <Trash2 className="h-3 w-3" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Temporada, vegano, picante, estrella..."
                value={nuevaEtiqueta}
                onChange={(e) => setNuevaEtiqueta(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEtiqueta())}
                className="h-8"
              />
              <Button size="sm" variant="outline" onClick={addEtiqueta}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Ingredientes */}
      <div className="border-t pt-3">
        <IngredientesEditor value={ingredientes} onChange={setIngredientes} />
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={guardar} disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Guardando..." : "Guardar ficha técnica"}
        </Button>
      </div>
    </div>
  );
}
