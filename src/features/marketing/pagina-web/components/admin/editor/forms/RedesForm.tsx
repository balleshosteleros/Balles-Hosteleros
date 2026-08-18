"use client";

import { Input } from "@/components/ui/input";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, RedesDatos } from "../../../../types";

/**
 * Solo se edita el texto. Los enlaces se leen de Ajustes → datos generales,
 * así que no hay campos de URL que mantener en dos sitios.
 */
export function RedesForm({ bloque }: { bloque: Extract<Bloque, { tipo: "redes" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<RedesDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Redes sociales">
        <Field label="Título">
          <Input value={datos.titulo} onChange={(e) => set({ titulo: e.target.value })} />
        </Field>
        <Field label="Descripción">
          <Input
            value={datos.descripcion ?? ""}
            onChange={(e) => set({ descripcion: e.target.value || undefined })}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Los enlaces salen de Ajustes → Datos generales de la empresa. Si
          cambias allí el Instagram, la web se actualiza sola. Las redes que no
          tengas rellenas no se muestran.
        </p>
      </Section>
    </div>
  );
}
