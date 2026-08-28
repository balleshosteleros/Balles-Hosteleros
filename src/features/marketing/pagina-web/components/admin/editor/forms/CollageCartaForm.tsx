"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import { ListaImagenes } from "./imagenes";
import type { Bloque, CollageCartaDatos } from "../../../../types";

export function CollageCartaForm({
  bloque,
}: {
  bloque: Extract<Bloque, { tipo: "collage_carta" }>;
}) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<CollageCartaDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Textos">
        <Field label="Título">
          <Input value={datos.titulo} onChange={(e) => set({ titulo: e.target.value })} />
        </Field>
        <Field label="Frase">
          <Textarea
            rows={3}
            value={datos.frase ?? ""}
            onChange={(e) => set({ frase: e.target.value })}
          />
        </Field>
        <Field label="Texto del botón">
          <Input value={datos.cta_label} onChange={(e) => set({ cta_label: e.target.value })} />
        </Field>
      </Section>

      <Section title={`Fotos del mosaico (${datos.imagenes?.length ?? 0})`}>
        <ListaImagenes
          imagenes={datos.imagenes ?? []}
          onChange={(imagenes) => set({ imagenes })}
          max={12}
        />
      </Section>
    </div>
  );
}
