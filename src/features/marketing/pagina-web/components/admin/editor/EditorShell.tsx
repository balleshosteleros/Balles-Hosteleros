"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Globe, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEditorStore } from "../../../hooks/useEditorStore";
import { useAutosave } from "../../../hooks/useAutosave";
import { useBroadcastBloques } from "../../../hooks/useLivePreview";
import { obtenerPagina } from "../../../actions/paginas-actions";
import { despublicarPagina, publicarPagina } from "../../../actions/publicar-actions";
import { BloqueLibrary } from "./BloqueLibrary";
import { Canvas } from "./Canvas";
import { PropiedadesPanel } from "./PropiedadesPanel";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { ChatWebPane } from "./ChatWebPane";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

interface Props {
  paginaId: string;
}

export function EditorShell({ paginaId }: Props) {
  const { empresaActual } = useEmpresa();
  const hydrate = useEditorStore((s) => s.hydrate);
  const reset = useEditorStore((s) => s.reset);
  const nombre = useEditorStore((s) => s.nombre);
  const bloques = useEditorStore((s) => s.bloques);
  const seleccionadoId = useEditorStore((s) => s.seleccionadoId);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [estadoPagina, setEstadoPagina] = useState<"BORRADOR" | "PUBLICADA" | "ARCHIVADA">("BORRADOR");
  const [publicando, setPublicando] = useState(false);
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
      setEstadoPagina(res.data.estado);
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
        <Loader2 className="h-5 w-5 animate-spin" />
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
        <AutosaveIndicator estado={estadoAutosave} ultimoGuardado={ultimoGuardado} zonaHoraria={empresaActual.zonaHoraria} />
        <div className="ml-auto flex items-center gap-2">
          {/* Importar desde una web existente vive DENTRO del asistente: es una
              tarea de IA, no un botón suelto de la barra.
              La dirección web es de la EMPRESA, no de una página suelta: se
              gestiona en Ajustes › Departamentos › Marketing › Página web. */}
          <Button
            variant={showChat ? "default" : "outline"}
            size="sm"
            onClick={() => setShowChat((v) => !v)}
            title="Cambia la web hablando con el asistente"
          >
            <Sparkles className="h-4 w-4 mr-1" /> Asistente
          </Button>
          {/* Ver la web: pestaña nueva y a pantalla completa. Un panel lateral
              estrecho no deja juzgar cómo queda de verdad. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(`/pagina-web-preview/${paginaId}`, "_blank", "noopener,noreferrer")
            }
            title="Ver la web a pantalla completa en una pestaña nueva"
          >
            <Eye className="h-4 w-4 mr-1" /> Ver
          </Button>
          {estadoPagina === "PUBLICADA" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={publicando}
              onClick={async () => {
                setPublicando(true);
                const r = await despublicarPagina(paginaId);
                if (r.ok) {
                  setEstadoPagina("BORRADOR");
                  toast.success("Página despublicada");
                } else toast.error(r.error);
                setPublicando(false);
              }}
            >
              {publicando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Despublicar
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={publicando}
              onClick={async () => {
                setPublicando(true);
                const r = await publicarPagina(paginaId);
                if (r.ok) {
                  setEstadoPagina("PUBLICADA");
                  toast.success("¡Página publicada!");
                } else toast.error(r.error);
                setPublicando(false);
              }}
            >
              {publicando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Publicar
            </Button>
          )}
        </div>
      </header>

      {/* Propiedades solo cuando hay bloque seleccionado: una columna vacía
          permanente come un tercio de la pantalla sin aportar nada.
          El asistente, si está abierto, ocupa ese mismo hueco. */}
      <div className="flex flex-1 overflow-hidden">
        <BloqueLibrary />
        <Canvas />
        {showChat ? (
          <ChatWebPane paginaId={paginaId} onCerrar={() => setShowChat(false)} />
        ) : (
          seleccionadoId && <PropiedadesPanel />
        )}
      </div>

    </div>
  );
}
