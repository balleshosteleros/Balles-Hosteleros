"use client";

import { Sparkles } from "lucide-react";

/**
 * Badge ámbar que marca un campo o sección como "sugerido por IA".
 * Se muestra junto al label del campo o flotando sobre la sección.
 *
 * Variante `tono`:
 *  - "normal" — confianza alta, ámbar suave
 *  - "fuerte" — confianza < 0.5 o sin verificar, ámbar más saturado
 */
export function BadgeSugerenciaIA({
  tono = "normal",
  texto = "IA",
  title,
}: {
  tono?: "normal" | "fuerte";
  texto?: string;
  title?: string;
}) {
  const cls =
    tono === "fuerte"
      ? "bg-amber-200 text-amber-900 ring-1 ring-amber-300"
      : "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return (
    <span
      title={title ?? "Sugerencia generada por IA — revísala antes de aceptar"}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${cls}`}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {texto}
    </span>
  );
}
