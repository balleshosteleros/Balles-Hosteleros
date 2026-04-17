"use client";

import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "../../../hooks/useEditorStore";
import { useBroadcastBloques } from "../../../hooks/useLivePreview";

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  desktop: 1200,
  tablet: 820,
  mobile: 390,
};

interface Props {
  paginaId: string;
  onCerrar: () => void;
}

export function PreviewPane({ paginaId, onCerrar }: Props) {
  const bloques = useEditorStore((s) => s.bloques);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  // Emite bloques al iframe via BroadcastChannel cada vez que cambian
  useBroadcastBloques(paginaId, bloques);

  // Al montarse, forzar un tick extra para asegurar que el iframe ya escucha
  useEffect(() => {
    const t = setTimeout(() => {
      // El hook ya emite por el efecto anterior; esto es un empuje extra post-carga
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const width = VIEWPORT_WIDTHS[viewport];

  return (
    <div className="w-[min(640px,50vw)] border-l bg-muted/30 flex flex-col">
      <header className="flex items-center gap-2 border-b bg-background px-3 py-2">
        <span className="text-sm font-semibold">Preview</span>
        <div className="ml-2 flex items-center gap-1">
          <Button
            variant={viewport === "desktop" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewport("desktop")}
            title="Desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewport === "tablet" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewport("tablet")}
            title="Tablet"
          >
            <Tablet className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewport === "mobile" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewport("mobile")}
            title="Mobile"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto"
          onClick={onCerrar}
          title="Cerrar preview"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </header>
      <div className="flex-1 overflow-auto p-3">
        <div className="mx-auto bg-white shadow-lg" style={{ width }}>
          <iframe
            src={`/marketing/pagina-web/${paginaId}/preview`}
            className="w-full h-[80vh] border-0"
            title="Preview en vivo"
          />
        </div>
      </div>
    </div>
  );
}
