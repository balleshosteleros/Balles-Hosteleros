"use client";

import { Settings2 } from "lucide-react";
import { useEditorStore } from "../../../hooks/useEditorStore";
import { getCatalogo } from "../../../data/bloques-catalogo";
import { BloqueForm } from "./forms";

export function PropiedadesPanel() {
  const seleccionadoId = useEditorStore((s) => s.seleccionadoId);
  const bloque = useEditorStore((s) =>
    s.seleccionadoId ? s.bloques.find((b) => b.id === s.seleccionadoId) : null,
  );

  if (!seleccionadoId || !bloque) {
    return (
      <aside className="w-80 border-l bg-background flex flex-col">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Propiedades</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-2 text-muted-foreground">
          <Settings2 className="h-8 w-8 opacity-40" />
          <p className="text-xs">Selecciona un bloque del canvas para editar sus propiedades.</p>
        </div>
      </aside>
    );
  }

  const catalogo = getCatalogo(bloque.tipo);
  const Icon = catalogo.icon;

  return (
    <aside className="w-80 border-l bg-background flex flex-col">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">{catalogo.label}</h3>
          <p className="text-xs text-muted-foreground">{catalogo.descripcion}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <BloqueForm bloque={bloque} />
      </div>
    </aside>
  );
}
