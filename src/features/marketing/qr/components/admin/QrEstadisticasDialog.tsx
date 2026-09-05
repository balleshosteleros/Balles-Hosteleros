"use client";

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PanelEstadisticas } from "@/features/marketing/estadisticas/components/PanelEstadisticas";
import { escaneosDeQr } from "@/features/marketing/estadisticas/actions";
import type { CodigoQr } from "../../types";

/** Cuánta gente escanea este QR y cuándo. Mismo panel que el de las páginas
 *  web: es la misma pregunta sobre otra fuente. */
export function QrEstadisticasDialog({
  qr,
  open,
  onOpenChange,
}: {
  qr: CodigoQr | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const id = qr?.id ?? "";

  const cargar = useCallback(
    (dias: number) => escaneosDeQr({ id, dias }),
    [id],
  );

  if (!qr) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Escaneos</DialogTitle>
        </DialogHeader>
        <PanelEstadisticas
          titulo={qr.nombre}
          subtitulo={qr.destino}
          unidad="escaneos"
          cargar={cargar}
        />
      </DialogContent>
    </Dialog>
  );
}
