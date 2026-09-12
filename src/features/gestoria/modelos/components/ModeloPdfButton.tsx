"use client";

import { useState } from "react";
import { FileDown, Loader2, FileX } from "lucide-react";
import { toast } from "sonner";
import { getModeloPdfSignedUrl } from "../actions/modelos-pdf-actions";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { ToolTooltip } from "@/components/ui/tool-tooltip";

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
      <ToolTooltip label="Sin documento adjunto">
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          <FileX className="h-4 w-4" />
          Sin documento
        </span>
      </ToolTooltip>
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
    } catch (err) {
      toast.error("No se pudo abrir el documento", { description: friendlyError(err, "abrir") });
    } finally {
      setCargando(false);
    }
  }

  return (
    <ToolTooltip label="Ver documento adjunto">
      <button
        type="button"
        onClick={abrir}
        disabled={cargando}
        className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50" aria-label="Ver documento adjunto">
        {cargando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        Documento
      </button>
    </ToolTooltip>
  );
}
