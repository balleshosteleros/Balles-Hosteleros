"use client";

import { Input } from "@/components/ui/input";
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
            <Input
              type="number"
              step="0.00001"
              value={datos.lat}
              onChange={(e) => set({ lat: Number(e.target.value) })}
            />
          </Field>
          <Field label="Longitud">
            <Input
              type="number"
              step="0.00001"
              value={datos.lng}
              onChange={(e) => set({ lng: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Zoom (1-20)">
          <Input
            type="number"
            min={1}
            max={20}
            value={datos.zoom}
            onChange={(e) => set({ zoom: Math.min(20, Math.max(1, Number(e.target.value) || 15)) })}
          />
        </Field>
      </Section>
    </div>
  );
}
