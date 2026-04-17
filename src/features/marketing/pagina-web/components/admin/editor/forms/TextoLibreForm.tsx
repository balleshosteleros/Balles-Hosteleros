"use client";

import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, TextoLibreDatos } from "../../../../types";

export function TextoLibreForm({
  bloque,
}: {
  bloque: Extract<Bloque, { tipo: "texto_libre" }>;
}) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<TextoLibreDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-4">
      <Section title="Contenido HTML">
        <Field
          label="HTML (se sanitiza server-side)"
          hint="Etiquetas seguras: p, a, strong, em, ul, li, h2, h3, br. Scripts y handlers se eliminan al guardar."
        >
          <Textarea
            value={datos.html_seguro}
            onChange={(e) => set({ html_seguro: e.target.value })}
            rows={12}
            className="font-mono text-xs"
            maxLength={50000}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {datos.html_seguro.length.toLocaleString("es-ES")} / 50.000 caracteres
          </p>
        </Field>
      </Section>
    </div>
  );
}
