"use client";

import type { EstudioApertura } from "@/features/direccion/data/aperturas";

function fmtEur(n: number): string {
  if (!n) return "—";
  return `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`;
}

export function SlideGastronomia({ estudio }: { estudio: EstudioApertura }) {
  const p = estudio.propuesta;
  const platos = (p.platos ?? []).slice(0, 6);
  return (
    <div
      className="flex h-full w-full flex-col gap-6 p-12"
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-text)" }}
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] opacity-60">Gastronomía</p>
          <h2 className="mt-2 text-4xl font-bold">
            {p.concepto || "Propuesta gastronómica"}
          </h2>
          {p.estiloServicio && <p className="mt-1 text-lg opacity-80">{p.estiloServicio}</p>}
        </div>
        {p.rangoPrecioMedio && (
          <div className="rounded-xl bg-white/10 px-5 py-3 text-right">
            <p className="text-3xl font-bold">{p.rangoPrecioMedio}</p>
            <p className="text-xs uppercase tracking-wider opacity-70">Ticket medio</p>
          </div>
        )}
      </div>

      {p.descripcion && (
        <p className="max-w-4xl text-lg leading-relaxed opacity-85">{p.descripcion}</p>
      )}

      {platos.length > 0 ? (
        <div className="grid flex-1 grid-cols-3 gap-4 overflow-hidden">
          {platos.map((plato) => (
            <div
              key={plato.id}
              className="flex flex-col overflow-hidden rounded-xl bg-white/10"
            >
              <div className="aspect-[4/3] bg-white/5">
                {plato.foto?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={plato.foto.url}
                    alt={plato.nombre}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs opacity-40">
                    Sin foto
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight">{plato.nombre || "Sin nombre"}</p>
                  {plato.precio > 0 && (
                    <p className="text-sm font-bold whitespace-nowrap">{fmtEur(plato.precio)}</p>
                  )}
                </div>
                {plato.categoria && (
                  <p className="text-[10px] uppercase tracking-wider opacity-60">{plato.categoria}</p>
                )}
                {plato.descripcion && (
                  <p className="line-clamp-2 text-xs opacity-75">{plato.descripcion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-white/20 text-sm opacity-50">
          Aún no hay platos destacados
        </div>
      )}
    </div>
  );
}
