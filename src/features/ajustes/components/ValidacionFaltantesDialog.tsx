"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ValidacionFaltantesDialogProps {
  open: boolean;
  onClose: () => void;
  /** Etiquetas legibles de los campos que faltan (ej: "Email", "DNI"). */
  campos: string[];
  /** Nombre del submódulo, ej: "Empleados", para el mensaje. */
  submoduloLabel?: string;
}

/**
 * Diálogo bloqueante que aparece cuando un usuario intenta crear algo
 * sin haber rellenado los campos exigidos por las reglas del admin.
 */
export function ValidacionFaltantesDialog({
  open,
  onClose,
  campos,
  submoduloLabel,
}: ValidacionFaltantesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <DialogTitle>NO PUEDES CONTINUAR</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {submoduloLabel
                  ? `Faltan datos obligatorios para crear ${submoduloLabel.toLowerCase()}.`
                  : "Faltan datos obligatorios para poder crear este registro."}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-destructive">
            Campos pendientes ({campos.length})
          </p>
          <ul className="mt-2 space-y-1">
            {campos.map((label) => (
              <li
                key={label}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Completa estos campos para poder guardar. Si crees que alguno no
          debería ser obligatorio, pídele al administrador que ajuste las
          reglas en <strong>Ajustes → Departamentos</strong>.
        </p>

        <div className="flex justify-end mt-2">
          <Button onClick={onClose}>ENTENDIDO</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
