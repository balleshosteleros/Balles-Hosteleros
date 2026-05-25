"use client";

/**
 * Slide placeholder usada en Fase 7 mientras se construyen las slides reales
 * en Fase 8. Renderiza el título grande con el branding del estudio.
 */
export function SlidePlaceholder({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-4 p-12"
      style={{
        backgroundColor: "var(--brand-primary)",
        color: "var(--brand-text)",
      }}
    >
      <h2 className="text-5xl font-bold">{titulo}</h2>
      {subtitulo && <p className="text-xl opacity-75">{subtitulo}</p>}
      <p className="absolute bottom-8 text-xs opacity-50 uppercase tracking-widest">
        Slide en construcción
      </p>
    </div>
  );
}
