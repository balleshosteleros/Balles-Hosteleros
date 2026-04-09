import { useState, useMemo } from "react";
import {
  Megaphone, TrendingUp, TrendingDown, Users, MessageCircle,
  Eye, Share2, Link, BarChart3, ArrowUpRight, ArrowDownRight, Minus,
  Filter, CalendarDays
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { REDES_SOCIALES, type RedSocial } from "@/features/marketing/data/marketing";
import { buildMarketingAnalytics, type MarketingAnalytics } from "@/features/marketing/data/marketing-analytics";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";

// ─── Period filter ──────────────────────────────────────────────
type Periodo = "1m" | "3m" | "12m" | "todo";
const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "1m", label: "Último mes" },
  { value: "3m", label: "Último trimestre" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "todo", label: "Desde el inicio" },
];

// ─── Social icon helper ─────────────────────────────────────────
function RedIcon({ red, size = 16 }: { red: RedSocial; size?: number }) {
  const info = REDES_SOCIALES.find((r) => r.id === red);
  return (
    <div
      className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
      style={{ backgroundColor: info?.color ?? "hsl(var(--muted))", width: size + 8, height: size + 8, fontSize: size * 0.55 }}
    >
      {info?.icon}
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("es-ES");
}

// ─── Component ──────────────────────────────────────────────────
export function MarketingDashboardView() {
  const { empresaActual } = useEmpresa();
  const [periodo, setPeriodo] = useState<Periodo>("12m");
  const [filtroRed, setFiltroRed] = useState<string>("todas");

  const analytics = useMemo(() => buildMarketingAnalytics(empresaActual.id), [empresaActual.id]);

  // Filter data by network
  const filteredPubs = filtroRed === "todas"
    ? analytics.publicaciones
    : analytics.publicaciones.filter((p) => p.red === filtroRed);

  const filteredSegs = filtroRed === "todas"
    ? analytics.seguidores
    : analytics.seguidores.filter((s) => s.red === filtroRed);

  const filteredComments = filtroRed === "todas"
    ? analytics.comentarios
    : analytics.comentarios.filter((c) => c.red === filtroRed);

  // Period slice for trend
  const sliceCount = periodo === "1m" ? 1 : periodo === "3m" ? 3 : periodo === "12m" ? 12 : 12;
  const tendencia = analytics.tendencia12m.slice(-sliceCount);

  // Totals
  const totalPubs = filteredPubs.reduce((a, b) => a + b.total, 0);
  const totalGanados = filteredSegs.reduce((a, b) => a + b.ganados, 0);
  const totalPerdidos = filteredSegs.reduce((a, b) => a + b.perdidos, 0);
  const totalNeto = totalGanados - totalPerdidos;
  const totalComentarios = filteredComments.reduce((a, b) => a + b.total, 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filtros:</span>
        </div>
        <Select value={filtroRed} onValueChange={setFiltroRed}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Red social" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las redes</SelectItem>
            {REDES_SOCIALES.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Nuevas publicaciones"
          value={totalPubs}
          icon={<Megaphone className="h-5 w-5" />}
          color="hsl(var(--primary))"
          trend={+12}
        />
        <KPICard
          title="Nuevos seguidores"
          value={totalGanados}
          icon={<TrendingUp className="h-5 w-5" />}
          color="hsl(145, 63%, 42%)"
          trend={+8}
        />
        <KPICard
          title="Seguidores perdidos"
          value={totalPerdidos}
          icon={<TrendingDown className="h-5 w-5" />}
          color="hsl(0, 72%, 51%)"
          trend={-3}
          invertTrend
        />
        <KPICard
          title="Comentarios"
          value={totalComentarios}
          icon={<MessageCircle className="h-5 w-5" />}
          color="hsl(270, 60%, 55%)"
          trend={+15}
        />
      </div>

      {/* Net followers banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Resultado neto de seguidores</p>
              <p className="text-xs text-muted-foreground">
                {formatNum(totalGanados)} ganados — {formatNum(totalPerdidos)} perdidos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalNeto >= 0 ? (
              <ArrowUpRight className="h-5 w-5 text-emerald-500" />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-red-500" />
            )}
            <span className={`text-2xl font-bold ${totalNeto >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {totalNeto >= 0 ? "+" : ""}{formatNum(totalNeto)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Publicaciones por red */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              Publicaciones por red social
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredPubs.map((p) => {
                const redInfo = REDES_SOCIALES.find((r) => r.id === p.red);
                return (
                  <div key={p.red} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RedIcon red={p.red} />
                        <span className="text-sm font-medium">{redInfo?.label}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-bold">{p.total}</Badge>
                    </div>
                    <div className="flex gap-2 pl-8">
                      {p.desglose.map((d) => (
                        <div key={d.tipo} className="flex-1 rounded-lg border bg-muted/30 p-2 text-center">
                          <p className="text-lg font-bold text-foreground">{d.cantidad}</p>
                          <p className="text-[10px] text-muted-foreground">{d.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Seguidores por red */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Seguidores por red social
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredSegs.map((s) => {
                const redInfo = REDES_SOCIALES.find((r) => r.id === s.red);
                return (
                  <div key={s.red} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <RedIcon red={s.red} />
                        <div>
                          <p className="text-sm font-medium">{redInfo?.label}</p>
                          <p className="text-[10px] text-muted-foreground">{s.cuenta}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total actual</p>
                        <p className="text-sm font-bold">{formatNum(s.totalActual)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center rounded bg-emerald-50 dark:bg-emerald-950/30 p-1.5">
                        <p className="text-sm font-bold text-emerald-600">+{formatNum(s.ganados)}</p>
                        <p className="text-[10px] text-muted-foreground">Ganados</p>
                      </div>
                      <div className="text-center rounded bg-red-50 dark:bg-red-950/30 p-1.5">
                        <p className="text-sm font-bold text-red-500">-{formatNum(s.perdidos)}</p>
                        <p className="text-[10px] text-muted-foreground">Perdidos</p>
                      </div>
                      <div className="text-center rounded bg-primary/5 p-1.5">
                        <p className={`text-sm font-bold ${s.neto >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {s.neto >= 0 ? "+" : ""}{formatNum(s.neto)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Neto</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend charts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Tendencia — Publicaciones y seguidores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={tendencia}>
              <defs>
                <linearGradient id="gradPubs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(220, 70%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(220, 70%, 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGanados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mesCorto" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="publicaciones" name="Publicaciones" stroke="hsl(220, 70%, 55%)" fill="url(#gradPubs)" strokeWidth={2} />
              <Area type="monotone" dataKey="seguidoresNeto" name="Seguidores neto" stroke="hsl(145, 63%, 42%)" fill="url(#gradGanados)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Followers trend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Tendencia — Seguidores (ganados vs perdidos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mesCorto" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="seguidoresGanados" name="Ganados" fill="hsl(145, 63%, 42%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="seguidoresPerdidos" name="Perdidos" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Comments trend */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              Volumen de comentarios
            </CardTitle>
            <Badge variant="outline" className="text-xs">{formatNum(totalComentarios)} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Per-network breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {filteredComments.map((c) => {
              const redInfo = REDES_SOCIALES.find((r) => r.id === c.red);
              return (
                <div key={c.red} className="rounded-lg border p-3 text-center">
                  <RedIcon red={c.red} size={14} />
                  <p className="text-lg font-bold mt-1">{formatNum(c.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{redInfo?.label}</p>
                </div>
              );
            })}
          </div>
          {/* Line chart */}
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mesCorto" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="comentarios" name="Comentarios" stroke="hsl(270, 60%, 55%)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────
function KPICard({
  title, value, icon, color, trend, invertTrend,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  trend: number;
  invertTrend?: boolean;
}) {
  const isPositive = invertTrend ? trend < 0 : trend > 0;
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }} />
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] gap-0.5 ${isPositive ? "text-emerald-600 border-emerald-200" : "text-red-500 border-red-200"}`}
          >
            {trend > 0 ? "+" : ""}{trend}%
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          </Badge>
        </div>
        <p className="text-2xl font-bold text-foreground">{formatNum(value)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
      </CardContent>
    </Card>
  );
}
