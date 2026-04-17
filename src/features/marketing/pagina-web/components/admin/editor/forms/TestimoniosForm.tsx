"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, TestimoniosDatos } from "../../../../types";

export function TestimoniosForm({
  bloque,
}: {
  bloque: Extract<Bloque, { tipo: "testimonios" }>;
}) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<TestimoniosDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  const updateItem = (i: number, patch: Partial<TestimoniosDatos["items"][number]>) => {
    const items = [...datos.items];
    items[i] = { ...items[i], ...patch };
    set({ items });
  };

  const addItem = () => {
    if (datos.items.length >= 30) return;
    set({ items: [...datos.items, { nombre: "Cliente", texto: "Escribe la reseña…", estrellas: 5 }] });
  };

  const removeItem = (i: number) => set({ items: datos.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <Section title={`Testimonios (${datos.items.length}/30)`}>
        {datos.items.map((t, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Reseña #{i + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Field label="Nombre">
              <Input value={t.nombre} onChange={(e) => updateItem(i, { nombre: e.target.value })} />
            </Field>
            <Field label="Reseña">
              <Textarea
                value={t.texto}
                rows={3}
                onChange={(e) => updateItem(i, { texto: e.target.value })}
              />
            </Field>
            <Field label="Estrellas (1-5)">
              <Input
                type="number"
                min={1}
                max={5}
                value={t.estrellas ?? 5}
                onChange={(e) =>
                  updateItem(i, {
                    estrellas: Math.min(5, Math.max(1, Number(e.target.value) || 5)),
                  })
                }
              />
            </Field>
            <Field label="Foto URL (opcional)">
              <Input
                value={t.foto_url ?? ""}
                onChange={(e) => updateItem(i, { foto_url: e.target.value || undefined })}
              />
            </Field>
          </div>
        ))}
        {datos.items.length < 30 && (
          <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir reseña
          </Button>
        )}
      </Section>
    </div>
  );
}
