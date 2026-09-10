"use client";

import { Input } from "@/components/ui/input";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import { SubirImagenUnica } from "./imagenes";
import type { Bloque, ImagenDatos } from "../../../../types";

export function ImagenForm({ bloque }: { bloque: Extract<Bloque, { tipo: "imagen" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<ImagenDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Imagen">
        <SubirImagenUnica
          valor={datos.url}
          onChange={(url) => set({ url })}
          etiqueta="Subir imagen"
        />
        <Field label="Texto alternativo" hint="Lo que describe la imagen. Lo leen Google y los lectores de pantalla.">
          <Input value={datos.alt ?? ""} onChange={(e) => set({ alt: e.target.value })} />
        </Field>
      </Section>

      <Section title="Cómo se ve">
        <Field label="Ancho">
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={datos.ancho}
            onChange={(e) => set({ ancho: e.target.value as ImagenDatos["ancho"] })}
          >
            <option value="contenido">Centrada, con márgenes</option>
            <option value="completo">De lado a lado</option>
          </select>
        </Field>
        <Field label="Pie de imagen" hint="Opcional. Sale debajo, en pequeño.">
          <Input value={datos.pie ?? ""} onChange={(e) => set({ pie: e.target.value })} />
        </Field>
      </Section>
    </div>
  );
}
