"use client";

import type { EstudioApertura } from "@/features/direccion/data/aperturas";

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function fmtEur(n: number): string {
  return `${fmt(n)} €`;
}

export function SlideInversion({ estudio }: { estudio: EstudioApertura }) {
  const totalProcedencia = estudio.procedencia.reduce((s, l) => s + (l.total || 0), 0);
  const totalDestino = estudio.destinos.reduce((s, l) => s + (l.total || 0), 0);

  // Agrega procedencia por origen
  const porOrigen = new Map<string, number>();
  for (const l of estudio.procedencia) {
    porOrigen.set(l.origen, (porOrigen.get(l.origen) ?? 0) + (l.total || 0));
  }
  const origenes = Array.from(porOrigen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Agrega destino por tipo
  const porTipo = new Map<string, number>();
  for (const l of estudio.destinos) {
    porTipo.set(l.tipo, (porTipo.get(l.tipo) ?? 0) + (l.total || 0));
  }
  const tipos = Array.from(porTipo.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div
      className="flex h-full w-full flex-col gap-6 p-12"
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-text)" }}
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] opacity-60">Inversión</p>
          <h2 className="mt-2 text-4xl font-bold">Estructura de capital</h2>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider opacity-60">Total capital</p>
          <p className="text-5xl font-bold">{fmtEur(totalProcedencia)}</p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-6 overflow-hidden">
        <div className="flex flex-col rounded-2xl bg-white/10 p-5">
          <p className="mb-3 text-xs uppercase tracking-wider opacity-70">Procedencia</p>
          {origenes.length > 0 ? (
            <ul className="flex-1 space-y-3 overflow-auto">
              {origenes.map(([origen, total]) => {
                const pct = totalProcedencia > 0 ? (total / totalProcedencia) * 100 : 0;
                return (
                  <li key={origen}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{origen}</span>
                      <span className="font-semibold">{fmtEur(total)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
                      <div className="h-full bg-white/70" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm opacity-50">Sin líneas de procedencia</p>
          )}
        </div>

        <div className="flex flex-col rounded-2xl bg-white/10 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-wider opacity-70">Destinos</p>
            <p className="text-sm font-semibold">{fmtEur(totalDestino)}</p>
          </div>
          {tipos.length > 0 ? (
            <ul className="grid flex-1 grid-cols-2 gap-2 overflow-auto">
              {tipos.map(([tipo, total]) => (
                <li
                  key={tipo}
                  className="flex items-baseline justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span>{tipo}</span>
                  <span className="font-semibold">{fmtEur(total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm opacity-50">Sin líneas de destino</p>
          )}
        </div>
      </div>
    </div>
  );
}
