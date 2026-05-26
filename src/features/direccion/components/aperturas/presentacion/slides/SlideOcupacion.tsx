"use client";

import {
  DIAS_SEMANA,
  FRANJAS_HORARIAS,
  ocupacionMedia,
  type EstudioApertura,
} from "@/features/direccion/data/aperturas";

function cellColor(v: number): string {
  // Escala blanco/transparente → ámbar saturado (sin depender del CSS var primario).
  if (v <= 0) return "rgba(255,255,255,0.05)";
  const alpha = 0.15 + (v / 100) * 0.75;
  return `rgba(251, 191, 36, ${alpha.toFixed(2)})`; // ámbar 400
}

export function SlideOcupacion({ estudio }: { estudio: EstudioApertura }) {
  const escenarios = estudio.ocupacion.escenarios ?? [];
  const realista = escenarios.find((e) => /realista/i.test(e.nombre)) ?? escenarios[0];

  return (
    <div
      className="flex h-full w-full flex-col gap-6 p-12"
      style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-text)" }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] opacity-60">Ocupación estimada</p>
        <h2 className="mt-2 text-4xl font-bold">
          Escenario realista
        </h2>
      </div>

      {realista ? (
        <>
          <div className="flex gap-6">
            {escenarios.slice(0, 3).map((e) => (
              <div key={e.id} className="rounded-xl bg-white/10 px-5 py-3">
                <p className="text-3xl font-bold">{ocupacionMedia(e.matriz).toFixed(0)}%</p>
                <p className="text-xs uppercase tracking-wider opacity-70">{e.nombre}</p>
              </div>
            ))}
          </div>

          {/* Heatmap día × franja */}
          <div className="flex-1 overflow-hidden rounded-xl bg-white/5 p-4">
            <div className="grid grid-cols-[100px_repeat(7,1fr)] gap-1 text-xs">
              <div />
              {DIAS_SEMANA.map((d) => (
                <div key={d.key} className="text-center font-semibold opacity-80">
                  {d.corto}
                </div>
              ))}
              {FRANJAS_HORARIAS.map((f) => (
                <Row
                  key={f.key}
                  label={f.label}
                  values={DIAS_SEMANA.map((d) => realista.matriz[d.key]?.[f.key] ?? 0)}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm opacity-50">
          Sin ocupación definida
        </div>
      )}
    </div>
  );
}

function Row({ label, values }: { label: string; values: number[] }) {
  return (
    <>
      <div className="flex items-center pr-2 text-right opacity-80">{label}</div>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex aspect-square items-center justify-center rounded text-sm font-medium"
          style={{ backgroundColor: cellColor(v) }}
          title={`${v}%`}
        >
          {v > 0 ? `${v}` : ""}
        </div>
      ))}
    </>
  );
}
