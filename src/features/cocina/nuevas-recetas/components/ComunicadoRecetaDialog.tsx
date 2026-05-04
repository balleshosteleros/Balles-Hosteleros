"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Send, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { createComunicado } from "@/features/gerencia/actions/comunicados-actions";
import type { RecetaConExtras } from "../actions/recetas-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receta: RecetaConExtras;
}

// Plantilla de contenido con fórmulas predefinidas rellenadas.
function construirPlantilla(receta: RecetaConExtras, diaEntrada: string): { titulo: string; contenido: string } {
  const fechaLegible = diaEntrada
    ? new Date(diaEntrada).toLocaleDateString("es-ES", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "próximamente";

  const linkFicha = receta.ficha_tecnica_id
    ? `/cocina/fichas-tecnicas?id=${receta.ficha_tecnica_id}`
    : null;

  const titulo = `Nueva receta en carta: ${receta.nombre}`;
  const contenido =
    `¡Nueva receta disponible en carta!\n\n` +
    `Plato: ${receta.nombre}\n` +
    (receta.ft_descripcion ? `Descripción: ${receta.ft_descripcion}\n` : "") +
    (receta.ft_pvp_propuesto ? `Precio: ${receta.ft_pvp_propuesto.toFixed(2)} €\n` : "") +
    `Entra en carta oficial: ${fechaLegible}\n\n` +
    (linkFicha ? `Ver ficha técnica completa: ${linkFicha}\n\n` : "") +
    `Recordad revisar alérgenos y preparación antes del servicio.\n\n` +
    `— El equipo de cocina`;

  return { titulo, contenido };
}

export function ComunicadoRecetaDialog({ open, onOpenChange, receta }: Props) {
  const [diaEntrada, setDiaEntrada] = useState<string>(new Date().toISOString().slice(0, 10));
  const [prioridad, setPrioridad] = useState<"baja" | "normal" | "alta" | "urgente">("normal");
  const [destino, setDestino] = useState<"empresa" | "departamento">("empresa");
  const [saving, setSaving] = useState(false);

  const { titulo: tituloInit, contenido: contenidoInit } = construirPlantilla(receta, diaEntrada);
  const [titulo, setTitulo] = useState(tituloInit);
  const [contenido, setContenido] = useState(contenidoInit);

  function regenerarPlantilla() {
    const p = construirPlantilla(receta, diaEntrada);
    setTitulo(p.titulo);
    setContenido(p.contenido);
  }

  async function enviar() {
    if (!titulo.trim()) {
      toast.error("Falta título");
      return;
    }
    setSaving(true);
    try {
      const res = await createComunicado({
        titulo: titulo.trim(),
        cuerpo: contenido.trim(),
        prioridad,
        todaEmpresa: destino === "empresa",
        rolesDestinatarios: destino === "empresa" ? [] : ["Cocina"],
      });
      if (!res.ok) {
        toast.error((res as { error?: string }).error ?? "Error al enviar");
        return;
      }
      toast.success("Comunicado enviado a Gerencia → Comunicados");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Comunicar al equipo
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Plantilla auto-generada con los datos de la receta. Puedes editarla antes de enviar.
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Día entrada en carta</Label>
              <Input
                type="date"
                value={diaEntrada}
                onChange={(e) => {
                  setDiaEntrada(e.target.value);
                }}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Destinatarios</Label>
            <Select value={destino} onValueChange={(v) => setDestino(v as typeof destino)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="empresa">Toda la empresa</SelectItem>
                <SelectItem value="departamento">Elegir en Gerencia → Comunicados</SelectItem>
              </SelectContent>
            </Select>
            {destino === "departamento" && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Se creará como borrador. Edita destinatarios específicos en Gerencia → Comunicados.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Título</Label>
              <Button size="sm" variant="ghost" onClick={regenerarPlantilla} className="h-6 text-[10px]">
                Regenerar plantilla
              </Button>
            </div>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9" />
          </div>

          <div>
            <Label className="text-xs">Contenido</Label>
            <Textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              className="min-h-[220px] text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Fórmulas ya rellenadas: título, PVP, día entrada en carta, link ficha técnica.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={enviar} disabled={saving}>
            <Send className="h-4 w-4 mr-1" /> {saving ? "Enviando..." : "Enviar comunicado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
