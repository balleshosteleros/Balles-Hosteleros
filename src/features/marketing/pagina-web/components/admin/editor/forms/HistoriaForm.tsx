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

      <Section title="Botones">
        {(datos.enlaces ?? []).map((e, i) => {
          const enlaces = datos.enlaces ?? [];
          const cambiar = (patch: Partial<(typeof enlaces)[number]>) => {
            const copia = [...enlaces];
            copia[i] = { ...copia[i], ...patch };
            set({ enlaces: copia });
          };
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-1">
              <Input
                value={e.label}
                onChange={(ev) => cambiar({ label: ev.target.value })}
                placeholder="Texto"
              />
              <Input
                value={e.href}
                onChange={(ev) => cambiar({ href: ev.target.value })}
                placeholder="https://…"
              />
              <input
                type="color"
                aria-label={`Color del botón ${e.label}`}
                title="Color del botón (vacío = el de la web)"
                value={e.color ?? "#d0a000"}
                onChange={(ev) => cambiar({ color: ev.target.value })}
                className="h-8 w-8 cursor-pointer rounded border bg-transparent p-0.5"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600"
                onClick={() => set({ enlaces: enlaces.filter((_, idx) => idx !== i) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {(datos.enlaces?.length ?? 0) < 4 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              set({ enlaces: [...(datos.enlaces ?? []), { label: "Ver la carta", href: "/carta" }] })
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir botón
          </Button>
        )}
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
