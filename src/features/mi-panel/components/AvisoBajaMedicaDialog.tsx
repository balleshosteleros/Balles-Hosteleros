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
import { HeartPulse, Megaphone } from "lucide-react";
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
  /** Dónde vive Comunicados: cambia entre el móvil y el ordenador. */
  hrefComunicados?: string;
}

export function AvisoBajaMedicaDialog({
  open,
  onOpenChange,
  hrefComunicados = "/mi-panel/comunicados",
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
            Hoy figuras de baja, así que no puedes fichar. Cuando te den el alta, ve a
            Comunicados para comunicar tu alta médica y podrás volver a fichar.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              router.push(hrefComunicados);
            }}
          >
            <Megaphone className="mr-2 h-4 w-4" />
            Ir a Comunicados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
