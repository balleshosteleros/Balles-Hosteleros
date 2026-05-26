"use client";

import {
  ESCENARIOS,
  calcularEscenario,
  totalFacturacion,
  type EstudioApertura,
} from "@/features/direccion/data/aperturas";

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function fmtEur(n: number): string {
  return `${fmt(n)} €`;
}

export function SlideEscenarios({ estudio }: { estudio: EstudioApertura }) {
  const ventasBase = totalFacturacion(estudio.facturacion);

  // 3 escenarios destacados: Conservador, Estimado, Optimista (factor 0.8 / 1.0 / 1.2)
  const elegidos = [
    ESCENARIOS.find((e) => e.factor === 0.8) ?? ESCENARIOS[1],
    ESCENARIOS.find((e) => e.factor === 1.0) ?? ESCENARIOS[2],
    ESCENARIOS.find((e) => e.factor === 1.2) ?? ESCENARIOS[3],
  ];

  return (
    <div
      className="flex h-full w-full flex-col gap-8 p-12"
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-text)" }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] opacity-60">Escenarios financieros</p>
        <h2 className="mt-2 text-4xl font-bold">Facturación, beneficio y margen / mes</h2>
      </div>

      <div className="grid flex-1 grid-cols-3 gap-6">
        {elegidos.map((esc) => {
          const r = calcularEscenario(ventasBase, esc.factor, estudio.costes);
          const margenColor =
            r.margen >= 15
              ? "text-emerald-300"
              : r.margen >= 0
                ? "text-amber-300"
                : "text-rose-300";
          return (
            <div
              key={esc.nombre}
              className="flex flex-col justify-between rounded-2xl bg-white/10 p-6"
            >
              <div>
                <p className="text-xs uppercase tracking-wider opacity-60">
                  {esc.nombre}
                </p>
                <p className="mt-1 text-sm opacity-70">×{esc.factor.toFixed(1)}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-60">Facturación</p>
                  <p className="text-4xl font-bold">{fmtEur(r.facturacion)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-60">Beneficio</p>
                  <p className="text-3xl font-semibold">{fmtEur(r.beneficio)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider opacity-60">Margen</p>
                  <p className={`text-3xl font-bold ${margenColor}`}>
                    {r.margen.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
