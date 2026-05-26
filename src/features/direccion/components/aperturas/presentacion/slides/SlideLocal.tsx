"use client";

import { CATEGORIAS_FOTOS_LOCAL, type EstudioApertura } from "@/features/direccion/data/aperturas";

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

export function SlideLocal({ estudio }: { estudio: EstudioApertura }) {
  const c = estudio.local.caracteristicas;
  const u = estudio.local.ubicacion;
  const ubicTexto = [u.direccion, u.codigoPostal, u.ciudad].filter(Boolean).join(", ");

  // Aplana hasta 6 fotos de cualquier categoría (prioridad: fachada, interior, terraza, etc.)
  const fotos = CATEGORIAS_FOTOS_LOCAL.flatMap((cat) =>
    (estudio.local.fotos[cat.key] ?? []).map((f) => ({ ...f, categoria: cat.label })),
  ).slice(0, 6);

  const stats = [
    { label: "m² útiles", value: c.metrosUtiles ? fmt(c.metrosUtiles) : "—" },
    { label: "Plazas", value: fmt((c.plazasInterior ?? 0) + (c.plazasTerraza ?? 0)) || "—" },
    { label: "Alquiler/mes", value: c.alquilerMensual ? `${fmt(c.alquilerMensual)} €` : "—" },
    { label: "Traspaso", value: c.traspaso ? `${fmt(c.traspaso)} €` : "—" },
  ];

  return (
    <div
      className="flex h-full w-full flex-col gap-6 p-12"
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-text)" }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] opacity-60">Local</p>
        <h2 className="mt-2 text-4xl font-bold">{c.tipoEstablecimiento || "Tipo de local sin definir"}</h2>
        {ubicTexto && <p className="mt-1 text-lg opacity-80">{ubicTexto}</p>}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-white/10 p-4 backdrop-blur-sm"
          >
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wider opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {fotos.length > 0 ? (
        <div className="grid flex-1 grid-cols-3 gap-3 overflow-hidden">
          {fotos.map((f) => (
            <div
              key={f.id}
              className="relative overflow-hidden rounded-lg bg-white/5"
            >
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.url}
                  alt={f.caption ?? f.categoria}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs opacity-50">
                  {f.categoria}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-white/20 text-sm opacity-50">
          Sin fotos del local
        </div>
      )}
    </div>
  );
}
