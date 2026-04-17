"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, VideoDatos } from "../../../../types";

export function VideoForm({ bloque }: { bloque: Extract<Bloque, { tipo: "video" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<VideoDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Fuente">
        <Field label="Proveedor">
          <Select
            value={datos.proveedor}
            onValueChange={(v) => set({ proveedor: v as VideoDatos["proveedor"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="vimeo">Vimeo</SelectItem>
              <SelectItem value="url_directa">MP4 directo</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="URL del video">
          <Input value={datos.url} onChange={(e) => set({ url: e.target.value })} />
        </Field>
      </Section>
      <Section title="Reproducción">
        <div className="flex items-center justify-between">
          <span className="text-xs">Autoplay</span>
          <Switch checked={datos.autoplay} onCheckedChange={(v) => set({ autoplay: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs">Silenciado (recomendado si autoplay)</span>
          <Switch checked={datos.muted} onCheckedChange={(v) => set({ muted: v })} />
        </div>
      </Section>
    </div>
  );
}
