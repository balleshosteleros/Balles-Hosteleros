import { useMemo } from "react";
import {
  calcularMetricasEmbudo,
  FASES_PRINCIPALES,
  type Candidato,
} from "@/features/rrhh/data/reclutamiento";
import { Badge } from "@/components/ui/badge";

interface FunnelMetricsProps {
  candidatos: Candidato[];
}

function formatPct(n: number) {
  if (n === 0) return "0%";
  if (Number.isInteger(n)) return `${n}%`;
  return `${n.toFixed(1)}%`;
}

export function FunnelMetrics({ candidatos }: FunnelMetricsProps) {
  const metricas = useMemo(() => calcularMetricasEmbudo(candidatos), [candidatos]);

  if (metricas.totalBase === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        Aún no hay candidatos en esta vacante. El embudo aparecerá cuando entren los primeros CV.
      </div>
    );
  }

  const cfgSel = FASES_PRINCIPALES.seleccion;
  const cfgFor = FASES_PRINCIPALES.onboarding;
  const cfgOff = FASES_PRINCIPALES.offboarding;
  const cfgDesc = FASES_PRINCIPALES.descartado;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Totales por grupo */}
      <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border">
        <GrupoStat
          label={cfgSel.label}
          color={cfgSel.color}
          colorFrom={cfgSel.colorFrom}
          colorTo={cfgSel.colorTo}
          count={metricas.grupoSeleccion.count}
          porcentaje={metricas.grupoSeleccion.porcentaje}
          totalBase={metricas.totalBase}
        />
        <GrupoStat
          label={cfgFor.label}
          color={cfgFor.color}
          colorFrom={cfgFor.colorFrom}
          colorTo={cfgFor.colorTo}
          count={metricas.grupoFormacion.count}
          porcentaje={metricas.grupoFormacion.porcentaje}
          totalBase={metricas.totalBase}
        />
        <GrupoStat
          label={cfgOff.label}
          color={cfgOff.color}
          colorFrom={cfgOff.colorFrom}
          colorTo={cfgOff.colorTo}
          count={metricas.grupoOffboarding.count}
          porcentaje={metricas.grupoOffboarding.porcentaje}
          totalBase={metricas.totalBase}
        />
        <GrupoStat
          label={cfgDesc.label}
          color={cfgDesc.color}
          colorFrom={cfgDesc.colorFrom}
          colorTo={cfgDesc.colorTo}
          count={metricas.grupoDescartado.count}
          porcentaje={metricas.grupoDescartado.porcentaje}
          totalBase={metricas.totalBase}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Embudo de progreso (Selección + Formación) */}
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Embudo de progreso
            </p>
            <span className="text-[11px] text-muted-foreground">
              base: {metricas.totalBase} candidatos (100%)
            </span>
          </div>
          <div className="space-y-1.5">
            {metricas.progreso.map((fila) => (
              <FunnelRow
                key={fila.estado}
                label={fila.label}
                count={fila.count}
                porcentaje={fila.porcentaje}
                color={fila.color}
              />
            ))}
          </div>
        </div>

        {/* Descartados */}
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Descartados por motivo
            </p>
            <span className="text-[11px] text-muted-foreground">
              % sobre los {metricas.totalBase} CV iniciales
            </span>
          </div>
          <div className="space-y-1.5">
            {metricas.descartado.map((fila) => (
              <FunnelRow
                key={fila.estado}
                label={fila.label}
                count={fila.count}
                porcentaje={fila.porcentaje}
                color={fila.color}
                muted={fila.count === 0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GrupoStat({
  label,
  color,
  colorFrom,
  colorTo,
  count,
  porcentaje,
  totalBase,
}: {
  label: string;
  color: string;
  colorFrom: string;
  colorTo: string;
  count: number;
  porcentaje: number;
  totalBase: number;
}) {
  return (
    <div className="relative overflow-hidden">
      <div
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})` }}
      />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">{count}</span>
          <span className="text-sm text-muted-foreground">/ {totalBase}</span>
          <Badge
            variant="outline"
            className="ml-auto text-[11px] font-semibold"
            style={{ borderColor: color, color }}
          >
            {formatPct(porcentaje)}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function FunnelRow({
  label,
  count,
  porcentaje,
  color,
  muted = false,
}: {
  label: string;
  count: number;
  porcentaje: number;
  color: string;
  muted?: boolean;
}) {
  const width = Math.max(porcentaje, count > 0 ? 4 : 0); // mínimo visible si hay al menos 1
  return (
    <div className={`group ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="font-medium text-foreground truncate">{label}</span>
        <span className="text-muted-foreground tabular-nums shrink-0">
          {count} <span className="text-foreground/70">·</span>{" "}
          <span className="font-semibold" style={{ color }}>
            {formatPct(porcentaje)}
          </span>
        </span>
      </div>
      <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          }}
        />
      </div>
    </div>
  );
}
