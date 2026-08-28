"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import { SubirImagenUnica } from "./imagenes";
import type { Bloque, HistoriaDatos } from "../../../../types";

export function HistoriaForm({ bloque }: { bloque: Extract<Bloque, { tipo: "historia" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<HistoriaDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  const parrafos = datos.parrafos ?? [];

  return (
    <div className="space-y-5">
      <Section title="Textos">
        <Field label="Título">
          <Input value={datos.titulo} onChange={(e) => set({ titulo: e.target.value })} />
        </Field>
        <Field label="Desde el año" hint="Se muestra destacado junto a la historia.">
          <Input
            value={datos.desde ?? ""}
            onChange={(e) => set({ desde: e.target.value })}
            placeholder="2022"
          />
        </Field>
      </Section>

      <Section title="Párrafos">
        {parrafos.map((p, i) => (
          <div key={i} className="flex gap-2">
            <Textarea
              rows={4}
              value={p}
              onChange={(e) => {
                const copia = [...parrafos];
                copia[i] = e.target.value;
                set({ parrafos: copia });
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-600 shrink-0"
              onClick={() => set({ parrafos: parrafos.filter((_, idx) => idx !== i) })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => set({ parrafos: [...parrafos, ""] })}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Añadir párrafo
        </Button>
      </Section>

      <Section title="Foto">
        <SubirImagenUnica
          valor={datos.imagen_url}
          onChange={(url) => set({ imagen_url: url })}
          etiqueta="Subir foto"
        />
      </Section>

      <Section title="Valoración de Google">
        <Field label="Nota" hint="Ej. 4,7. Déjalo vacío para no mostrarla.">
          <Input
            value={datos.rating ?? ""}
            onChange={(e) => set({ rating: e.target.value })}
            placeholder="4,7"
          />
        </Field>
        <Field label="Número de reseñas">
          <Input
            value={datos.rating_total ?? ""}
            onChange={(e) => set({ rating_total: e.target.value })}
            placeholder="1.200"
          />
        </Field>
        <Field label="Enlace a las reseñas">
          <Input
            value={datos.rating_href ?? ""}
            onChange={(e) => set({ rating_href: e.target.value })}
            placeholder="https://…"
          />
        </Field>
      </Section>
    </div>
  );
}
