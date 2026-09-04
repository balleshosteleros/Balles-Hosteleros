"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getTendenciaCanales,
  type PeriodoTendencia,
  type TendenciaCanalesResult,
} from "@/features/sala/actions/tendencia-canales-actions";
import type { CampoFecha, FiltroEstado } from "@/features/sala/actions/analitica-origen-actions";
import { colorOrigen, labelOrigen } from "@/features/sala/data/origenes";
import { cn } from "@/lib/utils";

/** Cuántos canales se dibujan como línea. El resto vive en la tabla de abajo. */
const LINEAS_VISIBLES = 6;

function Flecha({ v }: { v: number | null }) {
  // Sin periodo anterior con el que comparar no se inventa una tendencia.
  if (v === null) return <span className="text-muted-foreground">—</span>;
  if (v === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />0 %
      </span>
    );
  }
  const sube = v > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        sube ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
      )}
    >
      {sube ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {sube ? "+" : ""}{v} %
    </span>
  );
}

export function TendenciaCanalesPanel({
  campoFecha,
  estado,
}: {
  campoFecha: CampoFecha;
  estado: FiltroEstado;
}) {
  const { empresaActual, empresaResuelta } = useEmpresa();
  const empresaDbId = empresaActual?.dbId ?? null;

  const [periodo, setPeriodo] = useState<PeriodoTendencia>("mes");
  const [data, setData] = useState<TendenciaCanalesResult | null>(null);
  const [pending, startTransition] = useTransition();
  /** Canales apagados al pulsar su fila: la gráfica se lee mejor de uno en uno. */
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());

  const anioActual = new Date().getFullYear();

  const cargar = useCallback(() => {
    startTransition(async () => {
      const res = await getTendenciaCanales({
        // Desde el principio: la gracia de la tendencia es ver los años enteros
        // seguidos, no un año suelto.
        desdeAnio: 2022,
        hastaAnio: anioActual,
        periodo,
        campoFecha,
        estado,
      });
      setData(res);
    });
  }, [periodo, campoFecha, estado, anioActual]);

  useEffect(() => {
    if (!empresaResuelta) return;
    cargar();
  }, [cargar, empresaResuelta, empresaDbId]);

  /** Canales ordenados por volumen: los primeros son los que se dibujan. */
  const canales = useMemo(() => data?.resumen ?? [], [data?.resumen]);
  const canalesLinea = useMemo(
    () => canales.slice(0, LINEAS_VISIBLES).map((c) => c.canal),
    [canales],
  );

  // Recharts necesita una fila por punto con una columna por canal.
  const filas = useMemo(() => {
    return (data?.puntos ?? []).map((p) => {
      const fila: Record<string, string | number> = { label: p.label, total: p.total };
      for (const c of canales) fila[c.canal] = p.porCanal[c.canal] ?? 0;
      return fila;
    });
  }, [data?.puntos, canales]);

  const datosCircular = useMemo(
    () => canales.filter((c) => c.total > 0).map((c) => ({
      name: labelOrigen(c.canal),
      value: c.total,
      canal: c.canal,
    })),
    [canales],
  );

  const alternar = (canal: string) => {
    setOcultos((prev) => {
      const s = new Set(prev);
      if (s.has(canal)) s.delete(canal);
      else s.add(canal);
      return s;
    });
  };

  const total = data?.total ?? 0;
  const ultimoLabel = data?.puntos.at(-1)?.label ?? "";

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    fontSize: 12,
  } as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tendencia por canal</h2>
          <p className="text-xs text-muted-foreground">
            Evolución en el tiempo · 2022–{anioActual} · Total {total.toLocaleString("es-ES")} reservas
          </p>
        </div>
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoTendencia)}>
          <TabsList>
            <TabsTrigger value="mes">Meses</TabsTrigger>
            <TabsTrigger value="trimestre">Trimestres</TabsTrigger>
            <TabsTrigger value="anio">Años</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Líneas: solo los canales con más volumen, o la gráfica se convierte en
          una maraña ilegible. Los demás se leen en la tabla de abajo. */}
      <Card className="p-4">
        <div className="mb-2 text-xs text-muted-foreground">
          Los {LINEAS_VISIBLES} canales con más reservas. Pulsa una fila de la tabla para
          esconder o mostrar su línea.
        </div>
        <div className="h-72">
          {filas.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {pending ? "Cargando…" : "Sin reservas en este periodo"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filas} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {canalesLinea
                  .filter((c) => !ocultos.has(c))
                  .map((c) => (
                    <Line
                      key={c}
                      type="monotone"
                      dataKey={c}
                      name={labelOrigen(c)}
                      stroke={colorOrigen(c)}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Circular: el reparto del total, para ver de un vistazo quién manda. */}
        <Card className="p-4">
          <div className="mb-1 text-sm font-semibold">Reparto del total</div>
          <div className="mb-2 text-xs text-muted-foreground">2022–{anioActual}</div>
          <div className="h-56">
            {datosCircular.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sin datos
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={datosCircular}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    innerRadius={45}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {datosCircular.map((d) => (
                      <Cell key={d.canal} fill={colorOrigen(d.canal)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString("es-ES")} reservas`,
                      name,
                    ]}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Tabla con TODOS los canales, incluidos los de pocas reservas: es donde
            se ven Calidad, Fidelización, Experiencia, Google Ads, TikTok y SMS,
            que en la gráfica quedarían pegados al cero. */}
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-2.5">
            <div className="text-sm font-semibold">Todos los canales</div>
            <div className="text-xs text-muted-foreground">
              La variación compara {ultimoLabel || "el último periodo"} con el anterior
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Canal</th>
                  <th className="px-3 py-2 text-right font-medium">Reservas</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                  <th className="px-3 py-2 text-right font-medium">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {canales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      {pending ? "Cargando…" : "Sin reservas"}
                    </td>
                  </tr>
                )}
                {canales.map((c) => {
                  const enGrafica = canalesLinea.includes(c.canal);
                  const oculto = ocultos.has(c.canal);
                  return (
                    <tr
                      key={c.canal}
                      onClick={() => enGrafica && alternar(c.canal)}
                      className={cn(
                        "border-t transition-colors",
                        enGrafica && "cursor-pointer hover:bg-accent/50",
                        oculto && "opacity-40",
                      )}
                      title={enGrafica ? "Pulsa para esconder o mostrar su línea" : undefined}
                    >
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: colorOrigen(c.canal) }}
                          />
                          {labelOrigen(c.canal)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {c.total.toLocaleString("es-ES")}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {c.porcentaje.toLocaleString("es-ES")} %
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        <Flecha v={c.variacion} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {pending && (
        <div className="text-center text-xs text-muted-foreground">Actualizando…</div>
      )}
      {!pending && data && !data.ok && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          No se pudo cargar la tendencia.
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={cargar}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
