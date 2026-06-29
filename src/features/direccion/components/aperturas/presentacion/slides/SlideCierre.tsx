"use client";

import type { EstudioApertura } from "@/features/direccion/data/aperturas";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";

export function SlideCierre({ estudio }: { estudio: EstudioApertura }) {
  const { empresaActual } = useEmpresa();
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-8 p-16 text-center"
      style={{
        backgroundColor: "var(--brand-secondary)",
        color: "var(--brand-text)",
      }}
    >
      <div
        className="h-20 w-40"
        style={{
          backgroundImage: "var(--brand-logo)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "contain",
        }}
      />
      <div className="space-y-3">
        <h2 className="text-7xl font-bold leading-tight">¿Hablamos?</h2>
        <p className="text-2xl opacity-80">
          {estudio.datos.nombre || "Proyecto de apertura"}
        </p>
      </div>
      <p className="absolute bottom-8 text-xs opacity-60 uppercase tracking-widest">
        Dossier generado · {formatFechaEnZona(new Date().toISOString(), empresaActual.zonaHoraria)}
      </p>
    </div>
  );
}
