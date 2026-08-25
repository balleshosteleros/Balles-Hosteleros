"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type Opciones = {
  title?: string;
  description?: string;
  /** Botón que abandona los cambios. */
  salirLabel?: string;
  /** Botón que se queda para poder guardar. */
  quedarseLabel?: string;
};

/**
 * Confirma abandonar una pantalla con cambios sin guardar, con un diálogo
 * propio — nunca el aviso del navegador, que no se puede estilar y queda
 * fuera de la identidad del software.
 *
 * Cubre las salidas *dentro* de la aplicación: cambiar de pestaña, volver
 * atrás, ir a otro módulo. Cerrar la ventana del navegador entera no se puede
 * interceptar sin `beforeunload`, así que ahí se asume la pérdida: para eso la
 * barra de guardado avisa en todo momento de que hay cambios pendientes.
 *
 *   const { confirmarSalida, dialog } = useConfirmSalida();
 *   async function irAOtroSitio() {
 *     if (hayCambios && !(await confirmarSalida())) return;
 *     ...
 *   }
 */
export function useConfirmSalida() {
  const [pending, setPending] = useState<{
    opts: Opciones;
    resolve: (salir: boolean) => void;
  } | null>(null);
  const pendingRef = useRef<typeof pending>(null);

  const confirmarSalida = useCallback((opts?: Opciones) => {
    return new Promise<boolean>((resolve) => {
      const nuevo = { opts: opts ?? {}, resolve };
      pendingRef.current = nuevo;
      setPending(nuevo);
    });
  }, []);

  const close = useCallback((salir: boolean) => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    p.resolve(salir);
    setPending(null);
  }, []);

  // Si el componente se desmonta con el diálogo abierto, la promesa quedaría
  // colgada y con ella quien la esté esperando.
  useEffect(() => {
    return () => {
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    };
  }, []);

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </span>
            {pending?.opts.title ?? "Tienes cambios sin guardar"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.opts.description ??
              "Si sales ahora se perderán. Vuelve y pulsa Guardar para conservarlos."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.opts.quedarseLabel ?? "Seguir aquí"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending?.opts.salirLabel ?? "Salir sin guardar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmarSalida, dialog };
}
