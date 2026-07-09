"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IDIOMAS } from "../data/layouts";
import type { Tono } from "../types/presentaciones";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ESTILOS_VISUALES = [
  { value: "corporativo", label: "Corporativo" },
  { value: "moderno", label: "Moderno" },
  { value: "elegante", label: "Elegante" },
  { value: "creativo", label: "Creativo" },
  { value: "ejecutivo", label: "Ejecutivo" },
];

export function GeneradorInteligenteModal({ open, onOpenChange, onSuccess }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [tema, setTema] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [area, setArea] = useState("");
  const [numSlides, setNumSlides] = useState(10);
  const [idioma, setIdioma] = useState("es");
  const [estiloVisual, setEstiloVisual] = useState("corporativo");
  const [generando, setGenerando] = useState(false);

  const reset = () => {
    setTitulo("");
    setTema("");
    setDescripcion("");
    setArea("");
    setNumSlides(10);
    setIdioma("es");
    setEstiloVisual("corporativo");
    setGenerando(false);
  };

  const onClose = () => {
    if (!generando) {
      onOpenChange(false);
      setTimeout(reset, 300);
    }
  };

  const onGenerar = async () => {
    if (tema.trim().length < 5 || descripcion.trim().length < 5) {
      toast.error("Por favor completa el tema y la descripción con más detalle");
      return;
    }
    setGenerando(true);
    const t = toast.loading("La IA está analizando tu negocio y generando la presentación…");

    // Construimos el prompt usando todos los campos para que la IA tenga el contexto completo
    const promptConstruido = `
--- CONTEXTO DE LA EMPRESA (Análisis Automático) ---
Giro del negocio: Restauración y Hostelería de alto nivel (Balles Hosteleros).
Objetivos internos principales: Excelencia en el servicio, estandarización de procesos y mejora continua de la experiencia del cliente.
Marca e identidad visual: El sistema inyectará automáticamente los códigos de color y tipografías configurados en la base de datos.
Tipo de audiencia general: Empleados, directivos o clientes de hostelería.

--- SOLICITUD DE LA PRESENTACIÓN ---
Título de la presentación: ${titulo.trim() || "Sugerir título adecuado"}
Tema principal: ${tema.trim()}
Descripción breve: ${descripcion.trim()}
Área solicitante: ${area.trim() || "No especificada"}
Estilo visual y de redacción: ${estiloVisual}
    `.trim();

    // Mapeamos el estilo visual a uno de los tonos permitidos por la DB para no romper el esquema existente
    const tonoMap: Record<string, Tono> = {
      corporativo: "formal",
      moderno: "tecnico",
      elegante: "formal",
      creativo: "motivacional",
      ejecutivo: "formal",
    };

    try {
      const res = await fetch("/api/presentaciones/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptConstruido,
          audiencia: `Área: ${area || "General"}`, // Se usa audiencia para guardar el área sin tocar DB
          numSlides,
          tono: tonoMap[estiloVisual] || "formal",
          idioma,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success("Presentación generada exitosamente", { id: t });
      
      onOpenChange(false);
      setTimeout(reset, 300);
      
      if (onSuccess) onSuccess(); // Para recargar la tabla
      
      // Redirigir a la vista de la presentación
      router.push(`/direccion/presentaciones/${data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(msg, { id: t });
      setGenerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Generador Inteligente de Presentaciones
          </DialogTitle>
          <DialogDescription>
            Configura los detalles de tu empresa y la IA construirá automáticamente la estructura, textos e ideas visuales para ti.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título de la presentación</Label>
              <Input
                id="titulo"
                placeholder="Ej: Resultados del Trimestre T1"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                disabled={generando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area">Área solicitante</Label>
              <Input
                id="area"
                placeholder="Ej: Recursos Humanos, Ventas"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                disabled={generando}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tema">Tema principal *</Label>
            <Input
              id="tema"
              placeholder="Ej: Capacitación de nuevos procesos operativos"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              disabled={generando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción breve *</Label>
            <Textarea
              id="descripcion"
              placeholder="Explica qué quieres lograr con esta presentación, puntos clave a tocar, audiencia objetivo..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              disabled={generando}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="slides">Cantidad de diapositivas</Label>
              <Input
                id="slides"
                type="number"
                min={3}
                max={30}
                value={numSlides}
                onChange={(e) =>
                  setNumSlides(Math.min(30, Math.max(3, Number(e.target.value) || 10)))
                }
                disabled={generando}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label>Estilo visual</Label>
              <Select value={estiloVisual} onValueChange={setEstiloVisual} disabled={generando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTILOS_VISUALES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Idioma</Label>
              <Select value={idioma} onValueChange={setIdioma} disabled={generando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IDIOMAS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={generando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onGenerar}
            disabled={generando || tema.trim().length < 5 || descripcion.trim().length < 5}
          >
            {generando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando con IA…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" /> Crear Presentación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
