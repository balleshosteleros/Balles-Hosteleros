"use client";

/**
 * Biblioteca de secciones — PLEGADA por defecto.
 *
 * La forma principal de construir la web es hablando con el asistente. Esta
 * columna es la salida manual para quien la quiera: abierta permanentemente
 * comía un tercio de la pantalla en texto y botones.
 */
import { useState } from "react";
import { Blocks, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BLOQUES_CATALOGO } from "../../../data/bloques-catalogo";
import { useEditorStore } from "../../../hooks/useEditorStore";

export function BloqueLibrary() {
  const agregarBloque = useEditorStore((s) => s.agregarBloque);
  const [abierta, setAbierta] = useState(false);

  if (!abierta) {
    return (
      <aside className="border-r bg-background flex flex-col items-center py-3 px-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setAbierta(true)}
          title="Añadir secciones a mano"
        >
          <Blocks className="h-4 w-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-r bg-background flex flex-col">
      <div className="flex items-start gap-2 px-4 py-3 border-b">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">Secciones</h3>
          <p className="text-xs text-muted-foreground">
            Haz clic para añadirla a la web
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setAbierta(false)}
          title="Ocultar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
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
