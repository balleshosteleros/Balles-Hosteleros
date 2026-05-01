"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DiaTrabajadoAvisoDialogProps {
  open: boolean;
  onAceptar: () => void;
  onCancelar: () => void;
}

export function DiaTrabajadoAvisoDialog({
  open,
  onAceptar,
  onCancelar,
}: DiaTrabajadoAvisoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancelar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">Aviso importante</DialogTitle>
          <DialogDescription className="text-center pt-2">
            La forma habitual de registrar un día trabajado es a través de tu{" "}
            <span className="font-semibold text-foreground">fichaje diario</span> de entrada
            y salida.
            <br />
            <br />
            Esta solicitud es <span className="font-semibold text-foreground">provisional</span>{" "}
            y no debería repetirse. Úsala solo si no pudiste fichar correctamente
            ese día.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button variant="default" onClick={onAceptar}>
            Enterado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
