"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

/**
 * Pantalla de error de la app móvil.
 *
 * Va aparte de la de escritorio porque el móvil es el caso grave: en la PWA
 * instalada no hay barra de direcciones, así que cuando salía la pantalla de
 * error de Next ("This page couldn't load") el empleado se quedaba encerrado —
 * "Reload" repetía el fallo y "Back" no lleva a ningún sitio en una app sin
 * historial. Sin forma de entrar, y sin poder fichar.
 *
 * Aquí siempre hay salida: reintentar la pantalla, o volver al inicio de la app.
 */
export default function MobileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[movil] error no controlado:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 pb-[max(env(safe-area-inset-bottom),16px)] text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">No se ha podido cargar</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Ha fallado algo al mostrar esta pantalla. Vuelve a intentarlo; si sigue
          igual, entra desde el inicio.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={reset}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-semibold text-white active:bg-emerald-600"
        >
          <RotateCw className="h-4 w-4" />
          Reintentar
        </button>
        {/* Enlace normal, no router.push: con el árbol de React roto la
            navegación del cliente puede no responder. */}
        <a
          href="/m"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-semibold active:bg-muted"
        >
          <Home className="h-4 w-4" />
          Ir al inicio
        </a>
      </div>
      {error.digest && (
        <p className="pt-1 text-[11px] text-muted-foreground">
          Referencia: {error.digest}
        </p>
      )}
    </div>
  );
}
