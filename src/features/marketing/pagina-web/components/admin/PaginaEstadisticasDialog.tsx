"use client";

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PanelEstadisticas } from "@/features/marketing/estadisticas/components/PanelEstadisticas";
import { visitasDePaginaWeb } from "@/features/marketing/estadisticas/actions";

export interface PaginaResumen {
  id: string;
  nombre: string;
  /** Dominio o dirección donde está publicada, si la hay. */
  destino?: string | null;
}

/** Cuánta gente entra en esta página y cuándo. Mismo panel que el de los QR. */
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

  if (!pagina) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Visitas</DialogTitle>
        </DialogHeader>
        <PanelEstadisticas
          titulo={pagina.nombre}
          subtitulo={pagina.destino ?? undefined}
          unidad="visitas"
          cargar={cargar}
        />
      </DialogContent>
    </Dialog>
  );
}
