"use client";

import { Input } from "@/components/ui/input";
import { NumberInput } from "@/shared/components/NumberInput";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, MapaDatos } from "../../../../types";

export function MapaForm({ bloque }: { bloque: Extract<Bloque, { tipo: "mapa" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<MapaDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Ubicación">
        <Field label="Dirección visible">
          <Input
            value={datos.direccion_texto}
            onChange={(e) => set({ direccion_texto: e.target.value })}
            maxLength={300}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Latitud">
            <NumberInput
              step="0.00001"
              value={datos.lat}
              onValueChange={(v) => set({ lat: v })}
            />
          </Field>
          <Field label="Longitud">
            <NumberInput
              step="0.00001"
              value={datos.lng}
              onValueChange={(v) => set({ lng: v })}
            />
          </Field>
        </div>
        <Field label="Zoom (1-20)">
          <NumberInput
            min={1}
            max={20}
            emptyValue={15}
            decimales={false}
            value={datos.zoom}
            onValueChange={(v) => set({ zoom: v })}
          />
        </Field>
      </Section>
    </div>
  );
}
