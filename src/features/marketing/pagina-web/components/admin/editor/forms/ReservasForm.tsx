"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, ReservasDatos } from "../../../../types";

export function ReservasForm({ bloque }: { bloque: Extract<Bloque, { tipo: "reservas" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<ReservasDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Modo de reserva">
        <Field label="Cómo se reserva">
          <Select value={datos.modo} onValueChange={(v) => set({ modo: v as ReservasDatos["modo"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="formulario_propio">Formulario propio (captura lead)</SelectItem>
              <SelectItem value="embed_cover">Embed de Cover / TheFork</SelectItem>
              <SelectItem value="enlace_externo">Enlace a plataforma externa</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {datos.modo !== "formulario_propio" && (
          <Field label="URL externa / embed" hint="URL de Cover, TheFork u otra plataforma">
            <Input
              value={datos.url ?? ""}
              onChange={(e) => set({ url: e.target.value || undefined })}
              placeholder="https://…"
            />
          </Field>
        )}
      </Section>
    </div>
  );
}
