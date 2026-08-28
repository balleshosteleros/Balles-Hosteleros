"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import { ListaImagenes, SubirImagenUnica } from "./imagenes";
import type { Bloque, InstagramDatos } from "../../../../types";

export function InstagramForm({ bloque }: { bloque: Extract<Bloque, { tipo: "instagram" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<InstagramDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Perfil">
        <Field label="Usuario" hint="Sin la arroba.">
          <Input
            value={datos.usuario}
            onChange={(e) => set({ usuario: e.target.value.replace(/^@/, "") })}
            placeholder="mirestaurante"
          />
        </Field>
        <Field label="Seguidores" hint="Se escribe a mano: Instagram no da el dato sin su API.">
          <Input
            value={datos.seguidores ?? ""}
            onChange={(e) => set({ seguidores: e.target.value })}
            placeholder="12,4 mil"
          />
        </Field>
        <Field label="Publicaciones">
          <Input
            value={datos.publicaciones ?? ""}
            onChange={(e) => set({ publicaciones: e.target.value })}
            placeholder="480"
          />
        </Field>
        <div className="flex items-center justify-between rounded-md border p-2">
          <span className="text-xs">Cuenta verificada</span>
          <Switch
            checked={datos.verificado ?? false}
            onCheckedChange={(v) => set({ verificado: v })}
          />
        </div>
        <Field label="Avatar">
          <SubirImagenUnica
            valor={datos.avatar_url}
            onChange={(url) => set({ avatar_url: url })}
            etiqueta="Subir avatar"
          />
        </Field>
      </Section>

      <Section title="Textos">
        <Field label="Título">
          <Input value={datos.titulo} onChange={(e) => set({ titulo: e.target.value })} />
        </Field>
        <Field label="Frase">
          <Textarea
            rows={2}
            value={datos.frase ?? ""}
            onChange={(e) => set({ frase: e.target.value })}
          />
        </Field>
        <Field label="Texto del botón">
          <Input value={datos.cta_label} onChange={(e) => set({ cta_label: e.target.value })} />
        </Field>
      </Section>

      <Section title="Enlace del perfil">
        <Field label="Web" hint="La que sale bajo la bio en tu perfil.">
          <Input
            value={datos.web ?? ""}
            onChange={(e) => set({ web: e.target.value })}
            placeholder="www.mirestaurante.com"
          />
        </Field>
      </Section>

      <Section title={`Historias destacadas (${datos.destacados?.length ?? 0}/5)`}>
        {(datos.destacados ?? []).map((d, i) => {
          const lista = datos.destacados ?? [];
          const setItem = (patch: Partial<{ nombre: string; imagen_url: string }>) => {
            const copia = [...lista];
            copia[i] = { ...copia[i], ...patch };
            set({ destacados: copia });
          };
          return (
            <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/20">
              <div className="flex items-center gap-2">
                <Input
                  value={d.nombre}
                  onChange={(e) => setItem({ nombre: e.target.value })}
                  placeholder="CÓCTELES"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-red-600"
                  onClick={() => set({ destacados: lista.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <SubirImagenUnica
                valor={d.imagen_url}
                onChange={(url) => setItem({ imagen_url: url })}
                etiqueta="Subir portada"
              />
            </div>
          );
        })}
        {(datos.destacados?.length ?? 0) < 5 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => set({ destacados: [...(datos.destacados ?? []), { nombre: "" }] })}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir destacada
          </Button>
        )}
      </Section>

      <Section title={`Fotos del feed (${datos.feed?.length ?? 0}/9)`}>
        <ListaImagenes
          imagenes={datos.feed ?? []}
          onChange={(feed) => set({ feed })}
          max={9}
        />
      </Section>
    </div>
  );
}
