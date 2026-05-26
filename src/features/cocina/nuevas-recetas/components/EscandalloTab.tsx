"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Tags, Video } from "lucide-react";
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

export function EscandalloTab({ receta, onChanged, definirEtiquetasFinales }: Props) {
  const [nombre, setNombre] = useState(receta.nombre);
  const [descripcion, setDescripcion] = useState(receta.esc_descripcion ?? "");
  const [elaboracion, setElaboracion] = useState(receta.esc_elaboracion ?? "");
  const [tiempo, setTiempo] = useState(receta.esc_tiempo_preparacion?.toString() ?? "");
  const [partida, setPartida] = useState(receta.esc_partida ?? "");
  const [pvp, setPvp] = useState(receta.esc_pvp_propuesto?.toString() ?? "");
  const [coste, setCoste] = useState(receta.esc_coste_estimado?.toString() ?? "");
  const [alergenos, setAlergenos] = useState<string[]>(receta.esc_alergenos ?? []);
  const [nuevoAlergeno, setNuevoAlergeno] = useState("");
  const [etiquetas, setEtiquetas] = useState<string[]>(receta.esc_etiquetas_finales ?? []);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [videoUrl, setVideoUrl] = useState(receta.esc_video_url ?? "");

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
        esc_descripcion: descripcion || null,
        esc_elaboracion: elaboracion || null,
        esc_tiempo_preparacion: tiempo ? parseInt(tiempo, 10) : null,
        esc_partida: partida || null,
        esc_pvp_propuesto: pvp ? parseFloat(pvp) : null,
        esc_coste_estimado: coste ? parseFloat(coste) : null,
        esc_alergenos: alergenos,
        esc_etiquetas_finales: etiquetas,
        esc_video_url: videoUrl.trim() || null,
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

      toast.success("Escandallo guardada");
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

        {/* Video de preparación (MVP: URL externa) */}
        <div className="col-span-2">
          <Label className="inline-flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" /> Video de preparación
            <span className="text-[10px] font-normal text-muted-foreground">(beta — solo URL externa por ahora)</span>
          </Label>
          <Input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtu.be/… · https://vimeo.com/… · https://loom.com/share/…"
            className="mt-1"
          />
          {videoUrl.trim() && (
            <VideoEmbed url={videoUrl.trim()} />
          )}
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
              Etiquetas definitivas que aparecerán en carta y escandallo oficial
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
          {saving ? "Guardando..." : "Guardar escandallo"}
        </Button>
      </div>
    </div>
  );
}

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "loom.com" && u.pathname.startsWith("/share/")) {
      return url.replace("/share/", "/embed/");
    }
    return null;
  } catch {
    return null;
  }
}

function VideoEmbed({ url }: { url: string }) {
  const embed = toEmbedUrl(url);
  if (!embed) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Formato no reconocido para previsualizar. <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">Abrir en pestaña nueva</a>.
      </p>
    );
  }
  return (
    <div className="mt-2 aspect-video w-full max-w-xl overflow-hidden rounded-md border bg-black">
      <iframe
        src={embed}
        title="Video de preparación"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
