"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEditorStore } from "../../../hooks/useEditorStore";
import { useAutosave } from "../../../hooks/useAutosave";
import { useBroadcastBloques } from "../../../hooks/useLivePreview";
import { obtenerPagina } from "../../../actions/paginas-actions";
import { BloqueLibrary } from "./BloqueLibrary";
import { Canvas } from "./Canvas";
import { PropiedadesPanel } from "./PropiedadesPanel";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { PreviewPane } from "./PreviewPane";

interface Props {
  paginaId: string;
}

export function EditorShell({ paginaId }: Props) {
  const hydrate = useEditorStore((s) => s.hydrate);
  const reset = useEditorStore((s) => s.reset);
  const nombre = useEditorStore((s) => s.nombre);
  const bloques = useEditorStore((s) => s.bloques);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const { estado: estadoAutosave, ultimoGuardado } = useAutosave(paginaId);

  // Emitir bloques por BroadcastChannel al iframe de preview
  useBroadcastBloques(paginaId, bloques);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const res = await obtenerPagina(paginaId);
      if (cancel) return;
      if (!res.ok) {
        toast.error(res.error);
        setLoading(false);
        return;
      }
      hydrate(res.data);
      setLoading(false);
    })();
    return () => {
      cancel = true;
      reset();
    };
  }, [paginaId, hydrate, reset]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando editor…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Topbar */}
      <header className="flex items-center gap-3 border-b bg-background px-4 py-2.5">
        <Link href="/marketing/pagina-web">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
        </Link>
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm truncate">{nombre}</span>
        <AutosaveIndicator estado={estadoAutosave} ultimoGuardado={ultimoGuardado} />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={showPreview ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" /> Ocultar preview
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" /> Preview
              </>
            )}
          </Button>
          <Button variant="primary" size="sm" disabled>
            Publicar
          </Button>
        </div>
      </header>

      {/* 3 columnas + preview opcional */}
      <div className="flex flex-1 overflow-hidden">
        <BloqueLibrary />
        <Canvas />
        {showPreview ? (
          <PreviewPane paginaId={paginaId} onCerrar={() => setShowPreview(false)} />
        ) : (
          <PropiedadesPanel />
        )}
      </div>
    </div>
  );
}
