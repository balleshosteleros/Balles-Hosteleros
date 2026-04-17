"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import { subirAsset } from "../../../../services/asset-upload";
import { createClient } from "@/lib/supabase/client";
import type { Bloque, HeroDatos } from "../../../../types";

async function obtenerEmpresaId(): Promise<string | null> {
  try {
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

export function HeroForm({ bloque }: { bloque: Extract<Bloque, { tipo: "hero" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const paginaId = useEditorStore((s) => s.paginaId);
  const datos = bloque.datos;
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const set = (patch: Partial<HeroDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  const handleFile = async (file: File) => {
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
    const res = await subirAsset(file, empresaId, paginaId);
    if (res.ok) {
      set({ foto_url: res.url });
      toast.success("Imagen subida");
    } else {
      toast.error(res.error);
    }
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      <Section title="Contenido">
        <Field label="Título *">
          <Input
            value={datos.titulo}
            onChange={(e) => set({ titulo: e.target.value })}
            maxLength={200}
          />
        </Field>
        <Field label="Subtítulo">
          <Textarea
            value={datos.subtitulo ?? ""}
            onChange={(e) => set({ subtitulo: e.target.value })}
            rows={2}
            maxLength={400}
          />
        </Field>
      </Section>

      <Section title="Imagen de fondo">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {datos.foto_url ? (
          <div className="space-y-2">
            <div
              className="aspect-[16/9] rounded-md bg-cover bg-center border"
              style={{ backgroundImage: `url(${datos.foto_url})` }}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileRef.current?.click()}
                disabled={subiendo}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Reemplazar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => set({ foto_url: undefined })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
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
                <Upload className="h-4 w-4 mr-2" /> Subir foto de fondo
              </>
            )}
          </Button>
        )}
        <Field label="O URL directa">
          <Input
            value={datos.foto_url ?? ""}
            onChange={(e) => set({ foto_url: e.target.value || undefined })}
            placeholder="https://…"
          />
        </Field>
        <Field label="Overlay oscuro" hint="0 = sin overlay, 1 = negro opaco">
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={datos.overlay ?? 0.4}
            onChange={(e) => set({ overlay: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })}
          />
        </Field>
      </Section>

      <Section title="Call-to-action">
        <Field label="Texto del botón">
          <Input
            value={datos.cta?.label ?? ""}
            onChange={(e) =>
              set({ cta: { label: e.target.value, href: datos.cta?.href ?? "#" } })
            }
            placeholder="Reservar"
          />
        </Field>
        <Field label="Enlace del botón">
          <Input
            value={datos.cta?.href ?? ""}
            onChange={(e) =>
              set({ cta: { label: datos.cta?.label ?? "Reservar", href: e.target.value } })
            }
            placeholder="#reservas"
          />
        </Field>
      </Section>
    </div>
  );
}
