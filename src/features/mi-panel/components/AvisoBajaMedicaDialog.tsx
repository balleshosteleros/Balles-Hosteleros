"use client";

/**
 * Lo que ve quien intenta fichar estando de baja médica.
 *
 * Es un aviso propio y no un mensajito que se desvanece: si alguien de baja llega
 * al reloj y pulsa, hay que pararle en seco y decirle qué hacer, no dejar que se
 * le escape un texto en tres segundos. Lleva el botón que le deja donde tiene que
 * ir, para que no tenga que buscarlo.
 */

import { useRouter } from "next/navigation";
import { HeartPulse, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Dónde vive Solicitudes: cambia entre el móvil y el ordenador. */
  hrefSolicitudes?: string;
}

export function AvisoBajaMedicaDialog({
  open,
  onOpenChange,
  hrefSolicitudes = "/mi-panel/ausencias",
}: Props) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-rose-600" />
            Estás de baja médica
          </DialogTitle>
          <DialogDescription>
            Hoy figuras de baja, así que no puedes fichar. Cuando te den el alta,
            comunícala desde Solicitudes y podrás volver a fichar.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              router.push(hrefSolicitudes);
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Comunicar mi alta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
