"use client";

import type { EstudioApertura } from "@/features/direccion/data/aperturas";

export function SlideMarca({ estudio }: { estudio: EstudioApertura }) {
  const m = estudio.imagenMarca;
  return (
    <div
      className="flex h-full w-full flex-col gap-8 p-12"
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-text)" }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] opacity-60">Imagen de marca</p>
        {m.claim && <h2 className="mt-2 text-4xl font-bold">{m.claim}</h2>}
      </div>

      {/* Logo + paleta */}
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-1 flex items-center justify-center rounded-xl bg-white/10 p-6">
          {m.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.logoUrl} alt="Logo" className="max-h-32 max-w-full object-contain" />
          ) : (
            <div className="text-xs opacity-50">Sin logo</div>
          )}
        </div>
        <div className="col-span-2">
          <p className="mb-3 text-xs uppercase tracking-wider opacity-60">Paleta</p>
          {m.paleta && m.paleta.length > 0 ? (
            <div className="grid grid-cols-6 gap-3">
              {m.paleta.slice(0, 6).map((c) => (
                <div key={c.id} className="overflow-hidden rounded-lg">
                  <div
                    className="aspect-square w-full ring-1 ring-white/10"
                    style={{ backgroundColor: c.hex }}
                  />
                  <p className="mt-1 truncate text-[10px] opacity-80">{c.nombre}</p>
                  <p className="font-mono text-[9px] opacity-60">{c.hex}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-50">Sin paleta definida</p>
          )}
        </div>
      </div>

      {/* Tipografías */}
      {(m.tipografiaTitulares || m.tipografiaCuerpo) && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider opacity-60">Titulares</p>
            <p className="text-3xl">{m.tipografiaTitulares || "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider opacity-60">Cuerpo</p>
            <p className="text-xl">{m.tipografiaCuerpo || "—"}</p>
          </div>
        </div>
      )}

      {/* Valores */}
      {m.valores && m.valores.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {m.valores.map((v, i) => (
            <span
              key={i}
              className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium"
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
