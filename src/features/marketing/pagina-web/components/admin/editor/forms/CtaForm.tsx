"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import { SubirImagenUnica, ListaImagenes } from "./imagenes";
import type { Bloque, CtaDatos } from "../../../../types";

export function CtaForm({ bloque }: { bloque: Extract<Bloque, { tipo: "cta" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<CtaDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Contenido">
        <Field label="Título *">
          <Input
            value={datos.titulo}
            onChange={(e) => set({ titulo: e.target.value })}
            maxLength={160}
          />
        </Field>
        <Field label="Texto">
          <Textarea
            value={datos.texto ?? ""}
            onChange={(e) => set({ texto: e.target.value })}
            rows={2}
            maxLength={400}
          />
        </Field>
      </Section>

      <Section title="Foto de fondo">
        <SubirImagenUnica
          valor={datos.imagen_url}
          onChange={(url) => set({ imagen_url: url || undefined })}
          etiqueta="Subir foto de fondo"
        />
        {datos.imagen_url ? (
          <Field
            label="Encuadre (altura)"
            hint="La sección es una franja ancha: esto sube o baja el recorte para que no corte las caras."
          >
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={datos.foco_y ?? 30}
                onChange={(e) => set({ foco_y: Number(e.target.value) })}
                className="w-full accent-primary"
              />
              <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                {datos.foco_y ?? 30}%
              </span>
            </div>
          </Field>
        ) : null}
      </Section>

      <Section title="Fotos de acompañamiento">
        <p className="text-[11px] text-muted-foreground">
          Salen difuminadas a los lados del titular (los platos junto a la foto del local). Solo en
          pantalla grande; en el móvil no se pintan. Máximo 4.
        </p>
        <ListaImagenes
          imagenes={datos.fondo_imagenes ?? []}
          onChange={(imagenes) => set({ fondo_imagenes: imagenes.length ? imagenes : undefined })}
          max={4}
        />
      </Section>

      <Section title="Botón">
        <Field label="Texto del botón">
          <Input
            value={datos.boton.label}
            onChange={(e) => set({ boton: { ...datos.boton, label: e.target.value } })}
          />
        </Field>
        <Field label="Enlace">
          <Input
            value={datos.boton.href}
            onChange={(e) => set({ boton: { ...datos.boton, href: e.target.value } })}
          />
        </Field>
        <Field label="Variante">
          <Select
            value={datos.boton.variante}
            onValueChange={(v) =>
              set({ boton: { ...datos.boton, variante: v as "primary" | "ghost" } })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primary (sólido)</SelectItem>
              <SelectItem value="ghost">Ghost (transparente)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>
    </div>
  );
}
