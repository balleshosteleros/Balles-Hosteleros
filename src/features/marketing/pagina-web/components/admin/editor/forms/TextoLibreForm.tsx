"use client";

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
      <Section title="Fondo">
        <Field
          label="Cómo se presenta"
          hint="Con realce el texto va dentro de una tarjeta con el color de la marca, para los avisos que interesa que se lean."
        >
          <Select
            value={datos.fondo ?? "plano"}
            onValueChange={(v) => set({ fondo: v as TextoLibreDatos["fondo"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="plano">Sobre el fondo de la web</SelectItem>
              <SelectItem value="realce">En tarjeta destacada</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

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
