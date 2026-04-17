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
