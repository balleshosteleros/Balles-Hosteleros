"use client";

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PanelEstadisticas } from "@/features/marketing/estadisticas/components/PanelEstadisticas";
import { PanelComportamiento } from "@/features/marketing/estadisticas/components/PanelComportamiento";
import {
  comportamientoDePaginaWeb,
  visitasDePaginaWeb,
} from "@/features/marketing/estadisticas/actions";

export interface PaginaResumen {
  id: string;
  nombre: string;
  /** Dominio o dirección donde está publicada, si la hay. */
  destino?: string | null;
}

/**
 * Cuánta gente entra en esta página, cuándo, qué pulsa y cuánto se queda.
 *
 * Arriba, el mismo panel que el de los QR (la gráfica de visitas). Debajo, lo
 * que solo tiene sentido en una web: los botones que se pulsan, el tiempo medio
 * y de dónde llega la gente. Los dos leen el periodo del MISMO selector, así
 * que nunca se contradicen.
 */
export function PaginaEstadisticasDialog({
  pagina,
  open,
  onOpenChange,
}: {
  pagina: PaginaResumen | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const id = pagina?.id ?? "";

  const cargar = useCallback(
    (dias: number) => visitasDePaginaWeb({ id, dias }),
    [id],
  );

  const cargarComportamiento = useCallback(
    (dias: number) => comportamientoDePaginaWeb({ id, dias }),
    [id],
  );

  if (!pagina) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Visitas</DialogTitle>
        </DialogHeader>
        <PanelEstadisticas
          titulo={pagina.nombre}
          subtitulo={pagina.destino ?? undefined}
          unidad="visitas"
          cargar={cargar}
          extra={(dias) => (
            <PanelComportamiento dias={dias} cargar={cargarComportamiento} />
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
