"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, FormularioDatos, FormularioCampo } from "../../../../types";

export function FormularioForm({ bloque }: { bloque: Extract<Bloque, { tipo: "formulario" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<FormularioDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  const updateCampo = (idx: number, patch: Partial<FormularioCampo>) => {
    const campos = [...datos.campos];
    campos[idx] = { ...campos[idx], ...patch };
    set({ campos });
  };

  const addCampo = () => {
    if (datos.campos.length >= 15) return;
    set({
      campos: [
        ...datos.campos,
        { name: `campo_${datos.campos.length + 1}`, label: "Nuevo campo", tipo: "text", required: false },
      ],
    });
  };

  const removeCampo = (idx: number) =>
    set({ campos: datos.campos.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-5">
      <Section title="Encabezado">
        <Field label="Título *">
          <Input value={datos.titulo} onChange={(e) => set({ titulo: e.target.value })} />
        </Field>
        <Field label="Mensaje de éxito">
          <Input
            value={datos.mensaje_exito}
            onChange={(e) => set({ mensaje_exito: e.target.value })}
          />
        </Field>
      </Section>

      <Section title={`Campos (${datos.campos.length}/15)`}>
        {datos.campos.map((c, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Campo #{i + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600"
                onClick={() => removeCampo(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Field label="Nombre interno (a-z, 0-9, _)">
              <Input
                value={c.name}
                onChange={(e) =>
                  updateCampo(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })
                }
              />
            </Field>
            <Field label="Etiqueta visible">
              <Input value={c.label} onChange={(e) => updateCampo(i, { label: e.target.value })} />
            </Field>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Field label="Tipo">
                  <Select
                    value={c.tipo}
                    onValueChange={(v) => updateCampo(i, { tipo: v as FormularioCampo["tipo"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="tel">Teléfono</SelectItem>
                      <SelectItem value="textarea">Texto largo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={c.required}
                  onCheckedChange={(v) => updateCampo(i, { required: v })}
                />
                <span className="text-xs">Obligatorio</span>
              </div>
            </div>
          </div>
        ))}
        {datos.campos.length < 15 && (
          <Button variant="outline" size="sm" className="w-full" onClick={addCampo}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir campo
          </Button>
        )}
      </Section>
    </div>
  );
}
