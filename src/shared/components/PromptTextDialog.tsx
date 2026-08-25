"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PromptOptions = {
  title?: string;
  description?: string;
  label?: string;
  placeholder?: string;
  /** Valor de partida del campo. */
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Campo de varias líneas en vez de una sola. */
  multiline?: boolean;
  /** Si es false, se puede aceptar con el campo vacío. Por defecto true. */
  required?: boolean;
};

type PendingState = PromptOptions & {
  resolve: (valor: string | null) => void;
};

/**
 * Pide un texto al usuario con un diálogo propio, en vez del `prompt()` del
 * navegador — que no se puede estilar, cambia de aspecto en cada navegador y
 * delata que la interfaz no es nuestra.
 *
 * Mismo patrón que `useConfirmDelete`: devuelve el texto escrito, o `null` si
 * se cancela.
 *
 *   const { pedirTexto, dialog } = usePromptText();
 *   const motivo = await pedirTexto({ title: "Motivo de anulación" });
 *   if (motivo === null) return; // canceló
 *   ...
 *   return (<>{dialog}...</>)
 */
export function usePromptText() {
  const [pending, setPending] = useState<PendingState | null>(null);
  const [valor, setValor] = useState("");
  // Espeja `pending` fuera del render: `close` necesita leer el pendiente actual
  // desde un manejador de eventos, sin depender de cuándo re-renderiza React.
  const pendingRef = useRef<PendingState | null>(null);

  const pedirTexto = useCallback((opts?: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      // Si ya había uno abierto, se cierra para no dejar su promesa colgada.
      pendingRef.current?.resolve(null);
      const nuevo: PendingState = { ...(opts ?? {}), resolve };
      pendingRef.current = nuevo;
      setValor(opts?.defaultValue ?? "");
      setPending(nuevo);
    });
  }, []);

  const close = useCallback((texto: string | null) => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    p.resolve(texto);
    setPending(null);
    setValor("");
  }, []);

  // Si el componente se desmonta con un diálogo abierto, la promesa quedaría
  // colgada para siempre y con ella el `await` de quien la pidió.
  useEffect(() => {
    return () => {
      pendingRef.current?.resolve(null);
      pendingRef.current = null;
    };
  }, []);

  const obligatorio = pending?.required !== false;
  const puedeAceptar = !obligatorio || valor.trim().length > 0;

  const dialog = (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) close(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pending?.title ?? "Escribe un texto"}</DialogTitle>
          {pending?.description && (
            <DialogDescription>{pending.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-1.5">
          {pending?.label && <Label className="text-xs">{pending.label}</Label>}
          {pending?.multiline ? (
            <Textarea
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={pending?.placeholder}
              rows={4}
              autoFocus
            />
          ) : (
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={pending?.placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && puedeAceptar) close(valor);
              }}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => close(null)}>
            {pending?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button size="sm" onClick={() => close(valor)} disabled={!puedeAceptar}>
            {pending?.confirmLabel ?? "Aceptar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { pedirTexto, dialog };
}
