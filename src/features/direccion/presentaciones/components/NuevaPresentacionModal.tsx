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
import { TONOS, IDIOMAS } from "../data/layouts";
import type { Tono } from "../types/presentaciones";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NuevaPresentacionModal({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [audiencia, setAudiencia] = useState("");
  const [numSlides, setNumSlides] = useState(10);
  const [tono, setTono] = useState<Tono>("formal");
  const [idioma, setIdioma] = useState("es");
  const [generando, setGenerando] = useState(false);

  const reset = () => {
    setPrompt("");
    setAudiencia("");
    setNumSlides(10);
    setTono("formal");
    setIdioma("es");
    setGenerando(false);
  };

  const onClose = () => {
    if (!generando) {
      onOpenChange(false);
      setTimeout(reset, 300);
    }
  };

  const onGenerar = async () => {
    if (prompt.trim().length < 10) {
      toast.error("Describe el tema con al menos 10 caracteres");
      return;
    }
    setGenerando(true);
    const t = toast.loading("Gemini está generando tu presentación…");
    try {
      const res = await fetch("/api/presentaciones/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          audiencia: audiencia.trim() || undefined,
          numSlides,
          tono,
          idioma,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success("Presentación lista", { id: t });
      onOpenChange(false);
      setTimeout(reset, 300);
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
            <Sparkles className="h-5 w-5" /> Nueva presentación
          </DialogTitle>
          <DialogDescription>
            Describe el tema y Gemini genera slides con tu marca aplicada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="prompt">Tema / descripción *</Label>
            <Textarea
              id="prompt"
              placeholder="Ej: Resultados del trimestre T1 2026 y plan de acción para mejorar la satisfacción de cliente en sala."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={generando}
            />
            <p className="text-xs text-muted-foreground">
              {prompt.length} caracteres · mínimo 10, máximo 2000
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audiencia">Audiencia (opcional)</Label>
            <Input
              id="audiencia"
              placeholder="Ej: Equipo de sala y cocina, unos 15 empleados"
              value={audiencia}
              onChange={(e) => setAudiencia(e.target.value)}
              disabled={generando}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="slides">Nº slides</Label>
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
              <Label>Tono</Label>
              <Select value={tono} onValueChange={(v) => setTono(v as Tono)} disabled={generando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
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
            disabled={generando || prompt.trim().length < 10}
          >
            {generando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" /> Generar con Gemini
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
