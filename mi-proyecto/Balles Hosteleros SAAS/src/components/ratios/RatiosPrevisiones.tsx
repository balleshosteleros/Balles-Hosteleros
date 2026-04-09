import { useMemo } from "react";
import { SemanaRatio, DIAS_LABELS, calcularResumenArea } from "@/data/ratios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, Users, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const DIAS_CORTOS: Record<string, string> = {
  lunes: "LUN", martes: "MAR", miércoles: "MIÉ", jueves: "JUE",
  viernes: "VIE", sábado: "SÁB", domingo: "DOM",
};

function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function DeviationBadge({ real, previsto }: { real: number; previsto: number }) {
  if (previsto === 0) return null;
  const diff = ((real - previsto) / previsto) * 100;
  const isPositive = diff > 0;
  const color = Math.abs(diff) <= 5 ? "text-emerald-600 bg-emerald-50" : Math.abs(diff) <= 15 ? "text-amber-600 bg-amber-50" : "text-destructive bg-red-50";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", color)}>
      {isPositive ? "+" : ""}{fmtPct(diff)}
    </span>
  );
}

function StatusCard({ label, icon, status }: { label: string; icon: React.ReactNode; status: "ok" | "warning" | "danger" }) {
  const colors = {
    ok: "border-emerald-200 bg-emerald-50/50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50/50 text-amber-700",
    danger: "border-destructive/30 bg-red-50/50 text-destructive",
  };
  const icons = {
    ok: <CheckCircle2 className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    danger: <AlertTriangle className="h-4 w-4" />,
  };
  const labels = { ok: "Ajustado", warning: "Revisar", danger: "Desviado" };
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border p-3", colors[status])}>
      {icon}
      <div className="text-xs">
        <div className="font-semibold">{label}</div>
        <div className="flex items-center gap-1">{icons[status]} {labels[status]}</div>
      </div>
    </div>
  );
}

export default function RatiosPrevisiones({ semana, tipo }: { semana: SemanaRatio; tipo: "facturacion" | "reservas" }) {
  const operativa = useMemo(() => calcularResumenArea(semana.filas, "operativa"), [semana]);
  const administrativa = useMemo(() => calcularResumenArea(semana.filas, "administrativa"), [semana]);
  const costeTotal = operativa.totalCoste + administrativa.totalCoste;
  const horasTotal = operativa.totalHoras + administrativa.totalHoras;

  const isFact = tipo === "facturacion";
  const title = isFact ? "FACTURACIÓN / PERSONAL" : "RESERVAS / PERSONAL";

  const realTotal = isFact ? semana.facturacionTotal : semana.reservasRealesTotal;
  const previstoTotal = isFact ? semana.previsionFacturacionTotal : semana.previsionReservasTotal;
  const desviacion = previstoTotal > 0 ? ((realTotal - previstoTotal) / previstoTotal) * 100 : 0;
  const ratioReal = realTotal > 0 ? (costeTotal / realTotal) * 100 : 0;

  const tendenciaIcon = semana.tendencia.descripcion === "ascendente"
    ? <TrendingUp className="h-4 w-4 text-emerald-600" />
    : semana.tendencia.descripcion === "descendente"
    ? <TrendingDown className="h-4 w-4 text-destructive" />
    : <Minus className="h-4 w-4 text-muted-foreground" />;

  const personalStatus: "ok" | "warning" | "danger" =
    Math.abs(desviacion) <= 5 ? "ok" : Math.abs(desviacion) <= 15 ? "warning" : "danger";

  const chartData = DIAS_LABELS.map((dia) => {
    const prev = semana.previsiones.find((p) => p.dia === dia);
    return {
      dia: DIAS_CORTOS[dia],
      Real: isFact ? (prev?.facturacionReal ?? 0) : (prev?.reservasReales ?? 0),
      Previsto: isFact ? (prev?.facturacionPrevista ?? 0) : (prev?.reservasPrevistas ?? 0),
    };
  });

  return (
    <div className="space-y-4">
      {/* KPIs del bloque */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isFact ? "Facturación real" : "Reservas reales"}
            </p>
            <p className="text-lg font-bold tabular-nums">{fmt(realTotal)}{isFact ? " €" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isFact ? "Facturación prevista" : "Reservas previstas"}
            </p>
            <p className="text-lg font-bold tabular-nums">{fmt(previstoTotal)}{isFact ? " €" : ""}</p>
            <DeviationBadge real={realTotal} previsto={previstoTotal} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Coste personal</p>
            <p className="text-lg font-bold tabular-nums">{fmt(costeTotal)} €</p>
            <p className="text-xs text-muted-foreground">{horasTotal.toFixed(1)} h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ratio {isFact ? "facturación" : "reservas"}</p>
            <p className="text-lg font-bold tabular-nums">{fmtPct(ratioReal)}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              {tendenciaIcon}
              <span className="capitalize">{semana.tendencia.descripcion}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado del personal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatusCard
          label="Personal vs previsión"
          icon={<Users className="h-5 w-5" />}
          status={personalStatus}
        />
        <StatusCard
          label="Área operativa"
          icon={<Users className="h-5 w-5" />}
          status={operativa.totalCoste / (isFact ? semana.facturacionTotal : semana.reservasRealesTotal || 1) * 100 > 30 ? "warning" : "ok"}
        />
        <StatusCard
          label="Área administrativa"
          icon={<Users className="h-5 w-5" />}
          status={administrativa.totalCoste / (isFact ? semana.facturacionTotal : semana.reservasRealesTotal || 1) * 100 > 20 ? "warning" : "ok"}
        />
      </div>

      {/* Gráfica comparativa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{title} — Comparativa semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="dia" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                formatter={(value: number) => isFact ? `${fmt(value)} €` : fmt(value)}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Legend />
              <Bar dataKey="Real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Previsto" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabla de detalle por día */}
      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-semibold">DÍA</th>
                <th className="text-right p-3 font-semibold">{isFact ? "FACT. REAL" : "RESERVAS REALES"}</th>
                <th className="text-right p-3 font-semibold">{isFact ? "FACT. PREVISTA" : "RESERVAS PREVISTAS"}</th>
                <th className="text-right p-3 font-semibold">DESVIACIÓN</th>
                <th className="text-right p-3 font-semibold">COSTE PERSONAL</th>
                <th className="text-right p-3 font-semibold">HORAS</th>
                <th className="text-right p-3 font-semibold">RATIO</th>
              </tr>
            </thead>
            <tbody>
              {semana.previsiones.map((prev) => {
                const real = isFact ? prev.facturacionReal : prev.reservasReales;
                const previsto = isFact ? prev.facturacionPrevista : prev.reservasPrevistas;
                const costeDia = (operativa.porDia.find((d) => d.dia === prev.dia)?.coste ?? 0)
                  + (administrativa.porDia.find((d) => d.dia === prev.dia)?.coste ?? 0);
                const horasDia = (operativa.porDia.find((d) => d.dia === prev.dia)?.horas ?? 0)
                  + (administrativa.porDia.find((d) => d.dia === prev.dia)?.horas ?? 0);
                const ratioDia = real > 0 ? (costeDia / real) * 100 : 0;
                return (
                  <tr key={prev.dia} className="border-b border-border/40 hover:bg-muted/10">
                    <td className="p-3 font-medium uppercase">{DIAS_CORTOS[prev.dia]}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(real)}{isFact ? " €" : ""}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(previsto)}{isFact ? " €" : ""}</td>
                    <td className="p-3 text-right"><DeviationBadge real={real} previsto={previsto} /></td>
                    <td className="p-3 text-right tabular-nums">{fmt(costeDia)} €</td>
                    <td className="p-3 text-right tabular-nums">{horasDia.toFixed(1)} h</td>
                    <td className="p-3 text-right">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                        ratioDia <= 30 ? "text-emerald-600 bg-emerald-50" : ratioDia <= 40 ? "text-amber-600 bg-amber-50" : "text-destructive bg-red-50"
                      )}>
                        {fmtPct(ratioDia)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function RecuadroMetodologia({ semana }: { semana: SemanaRatio }) {
  const factor = semana.tendencia.factorFacturacion;
  const pctCambio = ((factor - 1) * 100).toFixed(1);
  const signo = factor >= 1 ? "+" : "";

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 mt-0.5">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2 text-sm">
            <h4 className="font-semibold text-foreground">¿Cómo se calcula la previsión?</h4>
            <p className="text-muted-foreground leading-relaxed">
              La previsión se basa en los datos de la <strong>misma fecha del año anterior</strong> y se ajusta mediante una{" "}
              <strong>media aritmética</strong> que tiene en cuenta la tendencia del año actual.
            </p>
            <div className="rounded-lg bg-card border border-border/60 p-3 space-y-1.5">
              <p className="text-xs text-muted-foreground">
                <strong>1.</strong> Se toman los datos de facturación y reservas de la misma semana del año pasado.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>2.</strong> Se calcula el factor de evolución comparando las últimas semanas del año actual con las del anterior.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>3.</strong> Se aplica: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">Previsto = Dato año anterior × Factor tendencia</code>
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>4.</strong> La tendencia actual es <strong className="capitalize">{semana.tendencia.descripcion}</strong> ({signo}{pctCambio}%), lo que indica que el negocio{" "}
                {semana.tendencia.descripcion === "ascendente" ? "está creciendo respecto al año anterior" :
                 semana.tendencia.descripcion === "descendente" ? "muestra un descenso respecto al año anterior" :
                 "se mantiene estable respecto al año anterior"}.
              </p>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Esta previsión se actualizará automáticamente al conectar los módulos de Contabilidad, Reservas y RRHH.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
