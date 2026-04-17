"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, FooterDatos, FooterColumna } from "../../../../types";

export function FooterForm({ bloque }: { bloque: Extract<Bloque, { tipo: "footer" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<FooterDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  const updateColumna = (i: number, patch: Partial<FooterColumna>) => {
    const columnas = [...datos.columnas];
    columnas[i] = { ...columnas[i], ...patch };
    set({ columnas });
  };

  const addColumna = () => {
    if (datos.columnas.length >= 6) return;
    set({
      columnas: [
        ...datos.columnas,
        { titulo: "Nueva columna", items: [{ label: "Enlace", href: "#" }] },
      ],
    });
  };

  const removeColumna = (i: number) =>
    set({ columnas: datos.columnas.filter((_, idx) => idx !== i) });

  const updateItem = (ci: number, ii: number, patch: Partial<{ label: string; href: string }>) => {
    const columnas = [...datos.columnas];
    const items = [...columnas[ci].items];
    items[ii] = { ...items[ii], ...patch };
    columnas[ci] = { ...columnas[ci], items };
    set({ columnas });
  };

  const addItem = (ci: number) => {
    const columnas = [...datos.columnas];
    if (columnas[ci].items.length >= 20) return;
    columnas[ci] = {
      ...columnas[ci],
      items: [...columnas[ci].items, { label: "Enlace", href: "#" }],
    };
    set({ columnas });
  };

  const removeItem = (ci: number, ii: number) => {
    const columnas = [...datos.columnas];
    columnas[ci] = {
      ...columnas[ci],
      items: columnas[ci].items.filter((_, idx) => idx !== ii),
    };
    set({ columnas });
  };

  return (
    <div className="space-y-5">
      <Section title={`Columnas (${datos.columnas.length}/6)`}>
        {datos.columnas.map((c, ci) => (
          <div key={ci} className="rounded-md border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <Input
                value={c.titulo}
                onChange={(e) => updateColumna(ci, { titulo: e.target.value })}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600"
                onClick={() => removeColumna(ci)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {c.items.map((it, ii) => (
              <div key={ii} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                <Input
                  value={it.label}
                  onChange={(e) => updateItem(ci, ii, { label: e.target.value })}
                  placeholder="Texto"
                />
                <Input
                  value={it.href}
                  onChange={(e) => updateItem(ci, ii, { href: e.target.value })}
                  placeholder="/url"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600"
                  onClick={() => removeItem(ci, ii)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {c.items.length < 20 && (
              <Button variant="outline" size="sm" onClick={() => addItem(ci)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Enlace
              </Button>
            )}
          </div>
        ))}
        {datos.columnas.length < 6 && (
          <Button variant="outline" size="sm" className="w-full" onClick={addColumna}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir columna
          </Button>
        )}
      </Section>

      <Section title="Texto legal">
        <Field label="Copyright / aviso legal">
          <Textarea
            value={datos.texto_legal ?? ""}
            onChange={(e) => set({ texto_legal: e.target.value || undefined })}
            rows={2}
            maxLength={600}
          />
        </Field>
      </Section>
    </div>
  );
}
