"use client";

import { useState } from "react";
import { FileDown, Loader2, FileX } from "lucide-react";
import { toast } from "sonner";
import { getModeloPdfSignedUrl } from "../actions/modelos-pdf-actions";

/**
 * Icono clicable que abre el PDF adjunto de un modelo en una pestaña nueva
 * mediante URL firmada temporal. Va dentro de un <Link> (la card), por eso
 * detiene la propagación para no navegar al editor.
 */
export function ModeloPdfButton({
  modeloId,
  tienePdf,
}: {
  modeloId: string;
  tienePdf: boolean;
}) {
  const [cargando, setCargando] = useState(false);

  if (!tienePdf) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        title="Sin documento adjunto"
      >
        <FileX className="h-4 w-4" />
        Sin documento
      </span>
    );
  }

  async function abrir(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCargando(true);
    try {
      const res = await getModeloPdfSignedUrl(modeloId);
      if (res.ok && res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(res.error ?? "No se pudo abrir el documento");
      }
    } catch {
      toast.error("No se pudo abrir el documento");
    } finally {
      setCargando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={cargando}
      title="Ver documento adjunto"
      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
    >
      {cargando ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      Documento
    </button>
  );
}
