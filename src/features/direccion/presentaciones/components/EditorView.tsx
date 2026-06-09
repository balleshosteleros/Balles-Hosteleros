"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Sparkles, Save, Loader2, GripVertical, Download, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getPresentacion, actualizarSlide, reordenarSlides,
} from "../actions/presentaciones-actions";
import { SlideRenderer } from "./SlideRenderer";
import type {
  PresentacionConSlides, Slide, Branding, Layout,
} from "../types/presentaciones";
import { LAYOUTS } from "../data/layouts";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

interface Props {
  presentacionId: string;
}

export function EditorView({ presentacionId }: Props) {
  const [data, setData] = useState<PresentacionConSlides | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await getPresentacion(presentacionId);
    if (res.ok && res.data) setData(res.data);
    else toast.error(res.error ?? "Error al cargar");
    setLoading(false);
  }, [presentacionId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const slides = data?.slides ?? [];
  const slide = slides[selectedIdx];
  const branding = (data?.branding_snapshot ?? {}) as Partial<Branding>;

  const actualizarCampo = <K extends keyof Slide>(campo: K, valor: Slide[K]) => {
    if (!slide) return;
    setData((d) =>
      d
        ? {
            ...d,
            slides: d.slides.map((s, i) =>
              i === selectedIdx ? { ...s, [campo]: valor } : s,
            ),
          }
        : d,
    );
  };

  const actualizarBullets = (texto: string) => {
    const arr = texto
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    actualizarCampo("contenido", {
      ...slide!.contenido,
      bullets: arr.length ? arr : undefined,
    });
  };

  const onGuardarSlide = async () => {
    if (!slide) return;
    setGuardando(true);
    const res = await actualizarSlide(slide.id, {
      titulo: slide.titulo,
      contenido: slide.contenido,
      notas: slide.notas,
      layout: slide.layout,
    });
    setGuardando(false);
    if (res.ok) toast.success("Slide guardada");
    else toast.error(res.error ?? "Error al guardar");
  };

  const onRegenerarSlide = async () => {
    if (!slide || !data) return;
    setRegenerando(true);
    const t = toast.loading("Regenerando con Gemini…");
    try {
      const res = await fetch("/api/presentaciones/regenerar-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentacionId: data.id, slideId: slide.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast.success("Slide regenerada", { id: t });
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { id: t });
    } finally {
      setRegenerando(false);
    }
  };

  const onDrop = async (toIdx: number) => {
    if (draggedIdx === null || draggedIdx === toIdx || !data) return;
    const nueva = [...slides];
    const [movido] = nueva.splice(draggedIdx, 1);
    nueva.splice(toIdx, 0, movido);
    setData({ ...data, slides: nueva.map((s, i) => ({ ...s, orden: i + 1 })) });
    setSelectedIdx(toIdx);
    setDraggedIdx(null);
    const res = await reordenarSlides(
      data.id,
      nueva.map((s) => s.id),
    );
    if (!res.ok) {
      toast.error(res.error ?? "Error al reordenar");
      cargar();
    }
  };

  const exportar = async (formato: "pptx") => {
    if (!data) return;
    const t = toast.loading(`Generando ${formato.toUpperCase()}…`);
    try {
      const res = await fetch(`/api/presentaciones/exportar-${formato}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.titulo}.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${formato.toUpperCase()} descargado`, { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { id: t });
    }
  };

  if (loading) {
    return <LoadingSpinner className="p-8" />;
  }
  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Presentación no encontrada</p>
        <Link href="/direccion/presentaciones">
          <Button variant="outline" className="mt-4">
            Volver
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b px-6 py-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/direccion/presentaciones">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{data.titulo}</h1>
            <p className="text-xs text-muted-foreground">
              {data.slides.length} slides · {data.modelo_ia ?? "IA"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportar("pptx")}>
            <Download className="h-4 w-4 mr-1.5" /> Descargar PPTX
          </Button>
          <Link
            href={`/direccion/presentaciones/${data.id}/print`}
            target="_blank"
          >
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1.5" /> PDF (imprimir)
            </Button>
          </Link>
          <Link href={`/direccion/presentaciones/${data.id}/present`}>
            <Button variant="primary" size="lg">
              <Play className="h-4 w-4 mr-2" /> Presentar
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Lista lateral de slides */}
        <aside className="w-64 border-r overflow-y-auto p-3 space-y-2 shrink-0">
          {slides.map((s, i) => (
            <button
              key={s.id}
              draggable
              onDragStart={() => setDraggedIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onClick={() => setSelectedIdx(i)}
              className={`w-full text-left rounded-lg border p-2 transition-colors ${
                selectedIdx === i
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-5 shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    {s.titulo ?? "(sin título)"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{s.layout}</p>
                </div>
              </div>
            </button>
          ))}
        </aside>

        {/* Preview + editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-auto p-6 bg-muted/30">
            {slide && (
              <div className="max-w-4xl mx-auto">
                <div className="shadow-lg rounded-lg overflow-hidden border">
                  <SlideRenderer slide={slide} branding={branding} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{slide.layout}</Badge>
                  <span>Slide {selectedIdx + 1} de {slides.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Panel edición */}
          {slide && (
            <div className="border-t bg-background p-4 space-y-3 max-h-[40vh] overflow-y-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">Editar slide {selectedIdx + 1}</h3>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRegenerarSlide}
                    disabled={regenerando}
                  >
                    {regenerando ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Regenerando…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Regenerar con Gemini
                      </>
                    )}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onGuardarSlide}
                    disabled={guardando}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {guardando ? "Guardando…" : "Guardar"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Layout</Label>
                  <Select
                    value={slide.layout}
                    onValueChange={(v) => actualizarCampo("layout", v as Layout)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LAYOUTS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Título</Label>
                  <Input
                    value={slide.titulo ?? ""}
                    onChange={(e) => actualizarCampo("titulo", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(slide.layout === "bullets" ||
                  slide.layout === "portada" ||
                  slide.layout === "cierre" ||
                  slide.layout === "imagen") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {slide.layout === "bullets"
                        ? "Bullets (uno por línea)"
                        : "Cuerpo / subtítulo"}
                    </Label>
                    {slide.layout === "bullets" ? (
                      <Textarea
                        rows={4}
                        value={(slide.contenido.bullets ?? []).join("\n")}
                        onChange={(e) => actualizarBullets(e.target.value)}
                      />
                    ) : (
                      <Textarea
                        rows={3}
                        value={slide.contenido.cuerpo ?? ""}
                        onChange={(e) =>
                          actualizarCampo("contenido", {
                            ...slide.contenido,
                            cuerpo: e.target.value,
                          })
                        }
                      />
                    )}
                  </div>
                )}

                {slide.layout === "cita" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cita</Label>
                    <Textarea
                      rows={3}
                      value={slide.contenido.cita ?? ""}
                      onChange={(e) =>
                        actualizarCampo("contenido", {
                          ...slide.contenido,
                          cita: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Notas del ponente</Label>
                  <Textarea
                    rows={4}
                    value={slide.notas ?? ""}
                    onChange={(e) => actualizarCampo("notas", e.target.value)}
                    placeholder="Ideas clave que quieres decir al presentar…"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
