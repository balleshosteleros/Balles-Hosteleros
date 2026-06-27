"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analiticaMargenesEscandallos,
  albaranesRecientesConProducto,
  type EscandalloMargenRow,
  type IngredienteSubida,
  type AlbaranConProducto,
  type PeriodoMargen,
} from "@/features/cocina/actions/escandallos-analitica-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { TrendingDown, Euro, ChevronRight, FileText, AlertTriangle, ArrowRight } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { formatEur, formatNumero } from "@/shared/lib/numero";

const PERIODOS: { value: PeriodoMargen; label: string }[] = [
  { value: "ultimo_cambio", label: "Último cambio de precio" },
  { value: "mes", label: "Último mes" },
  { value: "trimestre", label: "Último trimestre" },
  { value: "ano", label: "Último año" },
];

const chartConfig = {
  margenAntes: { label: "Margen antes", color: "hsl(var(--chart-2, 160 60% 45%))" },
  margenAhora: { label: "Margen ahora", color: "hsl(var(--destructive))" },
};

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

// ─── Drill-down: por qué bajó (ingredientes + albaranes) ───────────────────────
function DetalleSubida({ row }: { row: EscandalloMargenRow }) {
  const [productoSel, setProductoSel] = useState<IngredienteSubida | null>(
    row.culpables.find((c) => c.productoId) ?? null,
  );
  const [albaranes, setAlbaranes] = useState<AlbaranConProducto[]>([]);
  const [loadingAlb, setLoadingAlb] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pid = productoSel?.productoId;
    if (!pid) {
      setAlbaranes([]);
      return;
    }
    setLoadingAlb(true);
    albaranesRecientesConProducto(pid).then((res) => {
      if (!cancelled) {
        setAlbaranes(res.data);
        setLoadingAlb(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [productoSel?.productoId]);

  return (
    <div className="space-y-4 border-t pt-4 mt-1">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Por qué ha bajado el margen
      </div>

      {/* Ingredientes que subieron de precio */}
      <div className="space-y-1.5">
        {row.culpables.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            El sobrecoste no se atribuye a ningún ingrediente con histórico de precios.
          </p>
        ) : (
          row.culpables.map((c, i) => {
            const sel = productoSel?.nombre === c.nombre && productoSel?.productoId === c.productoId;
            const subidaPct =
              c.precioAntes > 0 ? ((c.precioAhora - c.precioAntes) / c.precioAntes) * 100 : 0;
            return (
              <button
                key={`${c.productoId ?? c.nombre}-${i}`}
                type="button"
                disabled={!c.productoId}
                onClick={() => setProductoSel(c)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                  sel ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"
                } ${!c.productoId ? "cursor-default opacity-80" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{c.nombre}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatEur(c.precioAntes, { max: 4 })}
                      <ArrowRight className="inline h-3 w-3 mx-0.5" />
                      {formatEur(c.precioAhora, { max: 4 })}
                    </span>
                    <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-xs">
                      +{formatNumero(subidaPct, { max: 0 })}%
                    </Badge>
                    {c.productoId && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {formatNumero(c.cantidad, { max: 3 })} {c.unidad}
                  </span>
                  <span className="text-rose-600 font-medium">+{formatEur(c.deltaEur)} / ración</span>
                  {c.fechaSubida && <span>desde {fechaCorta(c.fechaSubida)}</span>}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Albaranes recientes, marcando los que contenían el producto */}
      {productoSel?.productoId && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <FileText className="h-3.5 w-3.5" />
            Últimos albaranes · {productoSel.nombre}
          </div>
          {loadingAlb ? (
            <LoadingSpinner size="sm" className="py-3" />
          ) : albaranes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay albaranes registrados.</p>
          ) : (
            <div className="space-y-1">
              {albaranes.map((a) => (
                <div
                  key={a.albaranId}
                  className={`flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs ${
                    a.contiene ? "border-rose-200 bg-rose-50" : "bg-card opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {a.contiene && <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />}
                    <span className="font-medium text-foreground truncate">{a.numero || "—"}</span>
                    <span className="text-muted-foreground truncate">{a.proveedor}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="text-muted-foreground">{fechaCorta(a.fecha)}</span>
                    {a.contiene ? (
                      <span className="font-semibold text-rose-700">
                        {formatEur(a.precioUC ?? 0, { max: 4 })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">sin este producto</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vista principal ───────────────────────────────────────────────────────────
export function MargenesAnalisis() {
  const [periodo, setPeriodo] = useState<PeriodoMargen>("mes");
  const [rows, setRows] = useState<EscandalloMargenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    analiticaMargenesEscandallos(periodo).then((res) => {
      if (!cancelled) {
        setRows(res.data);
        setExpandido(res.data[0]?.id ?? null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [periodo]);

  const chartData = useMemo(
    () =>
      rows.map((r, i) => ({
        id: r.id,
        // Etiqueta corta para el eje, con ranking.
        label: `${i + 1}. ${r.nombre.length > 22 ? r.nombre.slice(0, 21) + "…" : r.nombre}`,
        margenAntes: r.margenAntes,
        margenAhora: r.margenAhora,
      })),
    [rows],
  );

  const totalSobrecoste = useMemo(() => rows.reduce((s, r) => s + r.deltaEur, 0), [rows]);

  return (
    <div className="space-y-5">
      {/* Cabecera + selector de ventana */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-rose-500" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Caída de márgenes</h2>
            <p className="text-xs text-muted-foreground">
              Los 5 escandallos que más margen han perdido por subidas de precio.
            </p>
          </div>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoMargen)}>
          <SelectTrigger className="h-9 w-[230px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingSpinner className="py-16" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Ningún escandallo ha perdido margen en este periodo. 🎉
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI sobrecoste total */}
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-full bg-rose-100 p-2">
                <Euro className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-700 tabular-nums">
                  +{formatEur(totalSobrecoste)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sobrecoste total por ración sumando los 5 escandallos
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gráfica margen antes vs ahora */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Margen antes vs ahora (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={150}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="margenAntes" name="Margen antes" fill="var(--color-margenAntes)" radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="margenAntes" position="right" className="fill-foreground" fontSize={10} formatter={(v: number) => `${formatNumero(v, { max: 1 })}%`} />
                  </Bar>
                  <Bar dataKey="margenAhora" name="Margen ahora" fill="var(--color-margenAhora)" radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="margenAhora" position="right" className="fill-foreground" fontSize={10} formatter={(v: number) => `${formatNumero(v, { max: 1 })}%`} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Ranking detallado — pinchar para ver el porqué */}
          <div className="space-y-2">
            {rows.map((r, i) => {
              const abierto = expandido === r.id;
              return (
                <Card key={r.id} className={abierto ? "border-primary/40" : ""}>
                  <button
                    type="button"
                    onClick={() => setExpandido(abierto ? null : r.id)}
                    className="w-full text-left"
                  >
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{r.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.categoria || "Sin categoría"} · PVP {formatEur(r.pvp)}
                          </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 text-sm tabular-nums">
                          <span className="text-emerald-600 font-medium">
                            {formatNumero(r.margenAntes, { max: 1 })}%
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-rose-600 font-semibold">
                            {formatNumero(r.margenAhora, { max: 1 })}%
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 tabular-nums">
                            −{formatNumero(r.deltaPts, { max: 1 })} pts
                          </Badge>
                          <span className="text-xs font-medium text-rose-600 tabular-nums">
                            +{formatEur(r.deltaEur)} / ración
                          </span>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform ${abierto ? "rotate-90" : ""}`}
                        />
                      </div>
                    </CardContent>
                  </button>
                  {abierto && (
                    <CardContent className="pt-0">
                      <DetalleSubida row={r} />
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
