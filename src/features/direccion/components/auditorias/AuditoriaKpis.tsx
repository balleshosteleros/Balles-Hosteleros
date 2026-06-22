"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { ArrowUp, ArrowDown, Minus, Gauge, Users, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  getAuditoriaKpis,
  type AuditoriaKpis as Kpis,
  type KpiBloque,
  type KpiMetric,
  type KpiFormato,
} from "@/features/direccion/actions/auditoria-kpis-actions";
import { periodoLabel } from "@/features/direccion/data/auditorias";

const BLOQUE_ICON = {
  productividad: Gauge,
  plantilla: Users,
  horas: Clock,
} as const;

function fmt(v: number | null, f: KpiFormato): string {
  if (v === null || Number.isNaN(v)) return "—";
  switch (f) {
    case "porcentaje":
      return `${v}%`;
    case "euro":
      return `${v.toLocaleString("es-ES")} €`;
    case "horas":
      return `${v} h`;
    case "decimal":
      return v.toLocaleString("es-ES", { maximumFractionDigits: 1 });
    default:
      return v.toLocaleString("es-ES");
  }
}

function mesCorto(periodo: string): string {
  return periodoLabel(periodo).split(" ")[0].slice(0, 3);
}

export function AuditoriaKpis({
  departamentoId,
  periodo,
}: {
  departamentoId: string;
  periodo: string;
}) {
  const [data, setData] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getAuditoriaKpis(departamentoId, periodo).then((res) => {
      if (cancel) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [departamentoId, periodo]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner />
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
        No se pudieron cargar los KPIs{error ? `: ${error}` : ""}.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.bloques.map((b) => (
        <BloqueCard key={b.key} bloque={b} />
      ))}
    </div>
  );
}

function BloqueCard({ bloque }: { bloque: KpiBloque }) {
  const Icon = BLOQUE_ICON[bloque.key];
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{bloque.titulo}</h3>
        {!bloque.disponible && (
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            Sin datos este mes
          </span>
        )}
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {bloque.metricas.map((m) => (
          <KpiTile key={m.key} metric={m} />
        ))}
      </div>

      {/* Visual */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TrendChart bloque={bloque} />
        {bloque.desglose && bloque.desglose.length > 0 && (
          <DesgloseChart desglose={bloque.desglose} />
        )}
      </div>
    </div>
  );
}

function KpiTile({ metric }: { metric: KpiMetric }) {
  const hayDelta =
    metric.valor !== null && metric.valorPrevio !== null && metric.valor !== metric.valorPrevio;
  const diff = hayDelta ? (metric.valor as number) - (metric.valorPrevio as number) : 0;
  const positivo = diff > 0;
  const bueno = hayDelta ? (positivo ? metric.mejorEsMas : !metric.mejorEsMas) : null;

  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{metric.label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {fmt(metric.valor, metric.formato)}
        </span>
        {hayDelta ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              bueno ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {positivo ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {fmt(Math.abs(diff), metric.formato)}
          </span>
        ) : (
          metric.valor !== null && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Minus className="h-3 w-3" />
            </span>
          )
        )}
      </div>
    </div>
  );
}

function TrendChart({ bloque }: { bloque: KpiBloque }) {
  const datos = useMemo(
    () => bloque.trend.map((p) => ({ mes: mesCorto(p.periodo), valor: p.valor })),
    [bloque.trend]
  );
  const vacio = datos.every((d) => d.valor === 0);

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        {bloque.trendLabel} · últimos 6 meses
      </div>
      {vacio ? (
        <div className="flex h-[150px] items-center justify-center text-xs text-muted-foreground">
          Sin histórico todavía
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          {bloque.key === "horas" ? (
            <BarChart data={datos} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="valor" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : bloque.key === "plantilla" ? (
            <AreaChart data={datos} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-plantilla" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="valor" stroke="#0ea5e9" fill="url(#grad-plantilla)" />
            </AreaChart>
          ) : (
            <LineChart data={datos} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}

function DesgloseChart({
  desglose,
}: {
  desglose: { label: string; valor: number; color: string }[];
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 text-xs text-muted-foreground">Desglose del mes</div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart
          data={desglose}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={70}
          />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="valor" radius={[0, 3, 3, 0]}>
            {desglose.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
