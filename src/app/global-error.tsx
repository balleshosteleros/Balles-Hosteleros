"use client";

import { useEffect } from "react";

/**
 * Último recinto: errores del layout RAÍZ, donde ni `app/error.tsx` llega.
 *
 * Este es el caso que dejaba la pantalla negra con "This page couldn't load":
 * si el fallo ocurre montando el layout de arriba del todo, no hay ningún
 * boundary por debajo que lo recoja y Next pinta su propia página. Como
 * reemplaza el documento entero, tiene que traer sus etiquetas <html> y <body>
 * y no puede apoyarse en el CSS de la app (puede ser justo lo que no cargó):
 * los estilos van en línea a propósito.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] error no controlado:", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#fff",
          color: "#0a0a0a",
          fontFamily:
            "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>⚠️</div>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          No se ha podido cargar la aplicación
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 340,
            fontSize: 14,
            color: "#6b7280",
            lineHeight: 1.5,
          }}
        >
          Ha fallado algo al arrancar. Vuelve a intentarlo; si sigue igual, entra
          desde el inicio.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 16,
              border: "none",
              background: "#10b981",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Reintentar
          </button>
          <a
            href="/"
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              color: "#0a0a0a",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            Ir al inicio
          </a>
        </div>
        {error.digest && (
          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
            Referencia: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
