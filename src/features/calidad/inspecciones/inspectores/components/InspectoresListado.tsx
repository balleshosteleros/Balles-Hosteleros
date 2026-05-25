"use client";

import { Badge } from "@/components/ui/badge";
import { FASES_INSPECTOR_CONFIG } from "../data";
import type { InspectorListItem } from "../types";

interface Props {
  inspectores: InspectorListItem[];
  onSelect: (id: string) => void;
}

export function InspectoresListado({ inspectores, onSelect }: Props) {
  if (inspectores.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Aún no hay inspectores en la bolsa.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Nombre</th>
            <th className="px-3 py-2 font-medium">Teléfono</th>
            <th className="px-3 py-2 font-medium">Ciudad</th>
            <th className="px-3 py-2 font-medium">Fase</th>
            <th className="px-3 py-2 font-medium text-center">Inspecciones</th>
            <th className="px-3 py-2 font-medium text-center">Nota media</th>
            <th className="px-3 py-2 font-medium">Última</th>
          </tr>
        </thead>
        <tbody>
          {inspectores.map((i) => {
            const cfg = FASES_INSPECTOR_CONFIG[i.fase];
            return (
              <tr
                key={i.id}
                onClick={() => onSelect(i.id)}
                className="border-t hover:bg-muted/20 cursor-pointer"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  #{i.numero_secuencial ?? "—"}
                </td>
                <td className="px-3 py-2 font-medium">
                  {i.nombre} {i.apellidos ?? ""}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {i.telefono}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {i.ciudad ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={cfg.color}>
                    {cfg.label}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center">{i.num_inspecciones}</td>
                <td className="px-3 py-2 text-center font-semibold">
                  {i.nota_media != null ? i.nota_media.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {i.ultima_inspeccion_at
                    ? new Date(i.ultima_inspeccion_at).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
