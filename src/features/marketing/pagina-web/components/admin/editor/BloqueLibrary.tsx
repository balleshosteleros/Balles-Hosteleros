"use client";

import { Button } from "@/components/ui/button";
import { BLOQUES_CATALOGO } from "../../../data/bloques-catalogo";
import { useEditorStore } from "../../../hooks/useEditorStore";

export function BloqueLibrary() {
  const agregarBloque = useEditorStore((s) => s.agregarBloque);

  return (
    <aside className="w-64 border-r bg-background flex flex-col">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Biblioteca</h3>
        <p className="text-xs text-muted-foreground">Haz clic para añadir al canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {BLOQUES_CATALOGO.map((b) => {
          const Icon = b.icon;
          return (
            <Button
              key={b.tipo}
              variant="ghost"
              className="w-full justify-start h-auto py-2 px-2 text-left"
              onClick={() => agregarBloque(b.tipo)}
            >
              <Icon className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">{b.label}</div>
                <div className="text-xs text-muted-foreground truncate">{b.descripcion}</div>
              </div>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
