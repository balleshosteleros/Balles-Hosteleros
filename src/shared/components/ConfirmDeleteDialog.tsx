"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * "destructiva" (por defecto) pinta el aviso en rojo con el triángulo: se va a
   * borrar algo. "normal" es para confirmaciones que no destruyen nada (pedir
   * una devolución, mandar un correo): botón azul y sin alarma, porque ahí
   * "Borrar" en rojo no significa nada y confunde con "Cancelar".
   */
  tono?: "destructiva" | "normal";
};

type PendingState = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

export function useConfirmDelete() {
  const [pending, setPending] = useState<PendingState | null>(null);
  const pendingRef = useRef<PendingState | null>(null);
  pendingRef.current = pending;

  const confirm = useCallback((opts?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...(opts ?? {}), resolve });
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    const p = pendingRef.current;
    if (!p) return;
    p.resolve(ok);
    setPending(null);
  }, []);

  const esDestructiva = (pending?.tono ?? "destructiva") === "destructiva";

  const dialog = (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {esDestructiva && (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            {pending?.title ?? "¿Estás seguro?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.description ??
              (esDestructiva ? "Esta acción no se puede deshacer." : "")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.cancelLabel ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={
              esDestructiva
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {pending?.confirmLabel ?? (esDestructiva ? "Borrar" : "Aceptar")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
