"use client";

import type { EstudioApertura } from "@/features/direccion/data/aperturas";

/**
 * Slide 1 — Portada del dossier.
 *
 * Usa los CSS vars del contenedor (--brand-primary, --brand-text, --brand-logo).
 * Si no hay logo en empresas.*, oculta el espacio del logo.
 */
export function SlidePortada({ estudio }: { estudio: EstudioApertura }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-8 p-12"
      style={{
        backgroundColor: "var(--brand-primary)",
        color: "var(--brand-text)",
      }}
    >
      <div
        className="h-24 w-48"
        style={{
          backgroundImage: "var(--brand-logo)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "contain",
        }}
      />
      <div className="text-center space-y-4 max-w-3xl">
        <h1 className="text-6xl font-bold tracking-tight">{estudio.datos.nombre || "Estudio de apertura"}</h1>
        {(estudio.datos.ciudad || estudio.datos.zona) && (
          <p className="text-2xl opacity-90">
            {[estudio.datos.zona, estudio.datos.ciudad].filter(Boolean).join(" · ")}
          </p>
        )}
        {estudio.datos.tipoLocal && (
          <p className="text-xl opacity-75">{estudio.datos.tipoLocal}</p>
        )}
      </div>
      <p className="absolute bottom-8 text-xs opacity-60 uppercase tracking-widest">
        Estudio de viabilidad · {new Date(estudio.creado).toLocaleDateString("es-ES")}
      </p>
    </div>
  );
}
