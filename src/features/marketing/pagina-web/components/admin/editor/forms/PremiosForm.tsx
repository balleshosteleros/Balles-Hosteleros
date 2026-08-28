"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import { SubirImagenUnica } from "./imagenes";
import type { Bloque, PremiosDatos } from "../../../../types";

export function PremiosForm({ bloque }: { bloque: Extract<Bloque, { tipo: "premios" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<PremiosDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  const items = datos.items ?? [];
  const setItem = (i: number, patch: Partial<PremiosDatos["items"][number]>) => {
    const copia = [...items];
    copia[i] = { ...copia[i], ...patch };
    set({ items: copia });
  };

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
        <Field label="Enlace" hint="A la ficha pública, para que el visitante pueda comprobarlo.">
          <Input
            value={datos.href ?? ""}
            onChange={(e) => set({ href: e.target.value })}
            placeholder="https://…"
          />
        </Field>
      </Section>

      <Section title={`Reconocimientos (${items.length})`}>
        {items.map((item, i) => (
          <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/20">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground pt-1">Nº {i + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600"
                onClick={() => set({ items: items.filter((_, idx) => idx !== i) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              value={item.nombre}
              onChange={(e) => setItem(i, { nombre: e.target.value })}
              placeholder="Nombre del premio"
            />
            <Input
              value={item.anios}
              onChange={(e) => setItem(i, { anios: e.target.value })}
              placeholder="Años. Ej. 2025 · 2026"
            />
            <Input
              value={item.fuente ?? ""}
              onChange={(e) => setItem(i, { fuente: e.target.value })}
              placeholder="Quién lo concede"
            />
            <SubirImagenUnica
              valor={item.imagen_url}
              onChange={(url) => setItem(i, { imagen_url: url })}
              etiqueta="Subir insignia"
            />
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => set({ items: [...items, { nombre: "", anios: "" }] })}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Añadir reconocimiento
        </Button>
      </Section>
    </div>
  );
}
