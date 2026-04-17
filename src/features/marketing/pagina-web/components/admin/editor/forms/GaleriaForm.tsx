"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import { subirAsset } from "../../../../services/asset-upload";
import type { Bloque, GaleriaDatos } from "../../../../types";

export function GaleriaForm({ bloque }: { bloque: Extract<Bloque, { tipo: "galeria" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const paginaId = useEditorStore((s) => s.paginaId);
  const datos = bloque.datos;
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const set = (patch: Partial<GaleriaDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  const handleFiles = async (files: FileList) => {
    if (!paginaId) {
      toast.error("Guarda la página antes de subir imágenes.");
      return;
    }
    setSubiendo(true);
    const empresaId = await obtenerEmpresaId();
    if (!empresaId) {
      toast.error("Sin contexto de empresa.");
      setSubiendo(false);
      return;
    }
    const nuevas: Array<{ url: string; alt: string }> = [];
    for (const file of Array.from(files)) {
      if (datos.imagenes.length + nuevas.length >= 60) break;
      const res = await subirAsset(file, empresaId, paginaId);
      if (!res.ok) {
        toast.error(res.error);
        continue;
      }
      nuevas.push({ url: res.url, alt: file.name.replace(/\.[^.]+$/, "") });
    }
    if (nuevas.length) {
      set({ imagenes: [...datos.imagenes, ...nuevas] });
      toast.success(`${nuevas.length} imagen${nuevas.length > 1 ? "es" : ""} subida${nuevas.length > 1 ? "s" : ""}`);
    }
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addImg = () => {
    if (datos.imagenes.length >= 60) return;
    set({ imagenes: [...datos.imagenes, { url: "", alt: "" }] });
  };
  const removeImg = (i: number) =>
    set({ imagenes: datos.imagenes.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <Section title="Layout">
        <Field label="Disposición">
          <Select value={datos.layout} onValueChange={(v) => set({ layout: v as GaleriaDatos["layout"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">Grid uniforme</SelectItem>
              <SelectItem value="masonry">Masonry (alturas variables)</SelectItem>
              <SelectItem value="carrusel">Carrusel horizontal</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title={`Imágenes (${datos.imagenes.length}/60)`}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
        >
          {subiendo ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" /> Subir imágenes
            </>
          )}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Se comprimen automáticamente a 1920 px / WebP ≤1.5 MB.
        </p>
        {datos.imagenes.map((img, i) => (
          <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <div
                className="w-12 h-12 rounded bg-muted shrink-0"
                style={img.url ? { backgroundImage: `url(${img.url})`, backgroundSize: "cover" } : undefined}
              />
              <div className="flex-1 space-y-1">
                <Input
                  value={img.url}
                  onChange={(e) => {
                    const imagenes = [...datos.imagenes];
                    imagenes[i] = { ...imagenes[i], url: e.target.value };
                    set({ imagenes });
                  }}
                  placeholder="URL"
                />
                <Input
                  value={img.alt}
                  onChange={(e) => {
                    const imagenes = [...datos.imagenes];
                    imagenes[i] = { ...imagenes[i], alt: e.target.value };
                    set({ imagenes });
                  }}
                  placeholder="Texto alternativo (SEO)"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600"
                onClick={() => removeImg(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {datos.imagenes.length < 60 && (
          <Button variant="outline" size="sm" className="w-full" onClick={addImg}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir URL manualmente
          </Button>
        )}
      </Section>
    </div>
  );
}

async function obtenerEmpresaId(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();
    return (data?.empresa_id as string) ?? null;
  } catch {
    return null;
  }
}
