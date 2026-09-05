"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

/**
 * Pantalla de error de la app.
 *
 * Sin este archivo, CUALQUIER excepción no capturada durante el render enseñaba
 * la pantalla de error de Next: fondo negro, "This page couldn't load" en
 * inglés y dos botones que no llevan a ningún sitio útil. Quien se la
 * encontraba —pasó con la avalancha de peticiones de sala— se quedaba dando a
 * "Reload" una y otra vez sobre la misma pantalla, sin forma de salir.
 *
 * Aquí el fallo se contiene y se ofrece una salida real: reintentar sin recargar
 * la app entera (`reset()`), o volver al inicio, que es lo que de verdad
 * desatasca cuando la pantalla concreta está rota.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] error no controlado:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">No se ha podido cargar esta pantalla</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ha fallado algo al mostrarla. Puedes reintentar; si vuelve a pasar,
          entra desde el inicio.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <button
          type="button"
          onClick={reset}
          className="flex h-11 items-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background active:scale-[0.98]"
        >
          <RotateCw className="h-4 w-4" />
          Reintentar
        </button>
        {/* `href` de toda la vida, no router.push: si el árbol de React está
            roto, la navegación del cliente puede no responder. */}
        <a
          href="/"
          className="flex h-11 items-center gap-2 rounded-2xl border border-border px-5 text-sm font-semibold active:bg-muted"
        >
          <Home className="h-4 w-4" />
          Ir al inicio
        </a>
      </div>
      {error.digest && (
        <p className="pt-2 text-[11px] text-muted-foreground">
          Referencia: {error.digest}
        </p>
      )}
    </div>
  );
}
