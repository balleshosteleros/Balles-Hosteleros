"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, BolsaInspectoresDatos } from "../../../../types";

export function BolsaInspectoresForm({
  bloque,
}: {
  bloque: Extract<Bloque, { tipo: "bolsa_inspectores" }>;
}) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<BolsaInspectoresDatos>) =>
    actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Mensaje">
        <Field label="Título *">
          <Input
            value={datos.titulo}
            onChange={(e) => set({ titulo: e.target.value })}
            maxLength={200}
          />
        </Field>
        <Field label="Descripción">
          <Textarea
            value={datos.descripcion ?? ""}
            onChange={(e) => set({ descripcion: e.target.value })}
            rows={3}
            maxLength={500}
          />
        </Field>
      </Section>
      <Section title="Botón">
        <Field label="Texto del CTA *">
          <Input
            value={datos.cta_label}
            onChange={(e) => set({ cta_label: e.target.value })}
            maxLength={80}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          El enlace se genera automáticamente apuntando a la bolsa pública de
          esta empresa: <code>/inspectores/bolsa/[slug]</code>.
        </p>
      </Section>
    </div>
  );
}
