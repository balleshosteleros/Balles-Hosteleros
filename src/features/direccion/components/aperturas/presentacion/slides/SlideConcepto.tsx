"use client";

import type { EstudioApertura } from "@/features/direccion/data/aperturas";

export function SlideConcepto({ estudio }: { estudio: EstudioApertura }) {
  const m = estudio.imagenMarca;
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-10 p-16 text-center"
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-text)" }}
    >
      <p className="text-xs uppercase tracking-[0.4em] opacity-60">Concepto</p>
      {m.claim ? (
        <h2 className="max-w-4xl text-6xl font-bold leading-tight">{m.claim}</h2>
      ) : (
        <h2 className="max-w-4xl text-5xl font-bold leading-tight opacity-50">
          Define el claim en Imagen de marca
        </h2>
      )}
      {m.descripcion && (
        <p className="max-w-3xl text-2xl leading-relaxed opacity-85">{m.descripcion}</p>
      )}
      {m.publicoObjetivo && (
        <p className="text-base uppercase tracking-widest opacity-60">
          Para: {m.publicoObjetivo}
        </p>
      )}
    </div>
  );
}
