"use client";

/**
 * Visor del correo ARCHIVADO: la copia exacta de lo que se envió, tal y como lo
 * recibió su destinatario, aunque después se haya cambiado la plantilla.
 *
 * Lo usan la ficha del candidato (Reclutamiento → Actividad) y el visor de
 * Gestoría → Contrataciones. El pie dice a quién se le mandó, porque por el
 * mismo sitio pasan los correos al candidato y los correos a la gestoría, y no
 * es lo mismo.
 */

import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Mail, X } from "lucide-react";

export interface CorreoArchivadoVisible {
  asunto: string;
  html: string;
  /** A quién se le envió. Por defecto, el candidato. */
  destinatario?: "candidato" | "gestoria";
}

const PIE: Record<"candidato" | "gestoria", string> = {
  candidato: "Correo enviado al candidato (copia exacta archivada)",
  gestoria: "Correo enviado a la gestoría (copia exacta archivada)",
};

const TITULO_IFRAME: Record<"candidato" | "gestoria", string> = {
  candidato: "Correo recibido por el candidato",
  gestoria: "Correo recibido por la gestoría",
};

export function CorreoArchivadoDialog({
  correo,
  onClose,
}: {
  correo: CorreoArchivadoVisible | null;
  onClose: () => void;
}) {
  const destinatario = correo?.destinatario ?? "candidato";
  return (
    <Dialog open={!!correo} onOpenChange={(o) => !o && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-lg focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-start gap-3 border-b px-4 py-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-sm font-semibold">
                {correo?.asunto}
              </DialogPrimitive.Title>
              <p className="text-[11px] text-muted-foreground">{PIE[destinatario]}</p>
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          {/* sandbox vacío: HTML estático sin scripts ni navegación. */}
          <iframe
            title={TITULO_IFRAME[destinatario]}
            sandbox=""
            srcDoc={correo?.html ?? ""}
            className="h-[65vh] w-full border-0 bg-white"
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
