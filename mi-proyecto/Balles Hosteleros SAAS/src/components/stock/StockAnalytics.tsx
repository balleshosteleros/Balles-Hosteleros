import { useMemo, useState } from "react";
import { type ProductoStock, CATEGORIAS_STOCK, getStockConTemporada, type TemporadaStock } from "@/data/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import {
  AlertTriangle, PackageX, TrendingDown, TrendingUp, ShieldAlert, Layers,
} from "lucide-react";

const ALL = "__ALL__";
type Periodo = "dia" | "semana" | "mes" | "año";

// ── Mock histórico (preparado para datos reales) ──────────
function generateHistory(stock: ProductoStock[], temporadaActiva: TemporadaStock | null) {
  const today = new Date();
  const days: { fecha: string; bajoSeguridad: number; sinStock: number }[] = [];

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const label = d.toISOString().slice(0, 10);

    // Simulate slight variation from current state
    const jitter = () => (Math.random() - 0.5) * 0.3;
    let bajo = 0;
    let sin = 0;
    stock.forEach((p) => {
      const s = getStockConTemporada(p, temporadaActiva);
      const simulated = Math.max(0, p.stockActual + p.stockActual * jitter());
      if (simulated === 0) sin++;
      else if (simulated < s.stockSeguridad) bajo++;
    });
    days.push({ fecha: label, bajoSeguridad: bajo, sinStock: sin });
  }
  return days;
}

function aggregateByPeriod(
  days: { fecha: string; bajoSeguridad: number; sinStock: number }[],
  periodo: Periodo,
) {
  if (periodo === "dia") {
    return days.slice(-30).map((d) => ({ ...d, label: d.fecha.slice(5) }));
  }
  if (periodo === "semana") {
    const weeks: typeof days = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      if (!chunk.length) continue;
      const avg = (key: "bajoSeguridad" | "sinStock") =>
        Math.round(chunk.reduce((s, c) => s + c[key], 0) / chunk.length);
      weeks.push({ fecha: chunk[0].fecha, bajoSeguridad: avg("bajoSeguridad"), sinStock: avg("sinStock") });
    }
    return weeks.slice(-12).map((w) => ({ ...w, label: w.fecha.slice(5) }));
  }
  if (periodo === "mes") {
    const map = new Map<string, { bajoSeguridad: number[]; sinStock: number[] }>();
    days.forEach((d) => {
      const m = d.fecha.slice(0, 7);
      if (!map.has(m)) map.set(m, { bajoSeguridad: [], sinStock: [] });
      map.get(m)!.bajoSeguridad.push(d.bajoSeguridad);
      map.get(m)!.sinStock.push(d.sinStock);
    });
    return Array.from(map.entries()).slice(-12).map(([m, v]) => ({
      fecha: m,
      label: m.slice(2),
      bajoSeguridad: Math.round(v.bajoSeguridad.reduce((a, b) => a + b, 0) / v.bajoSeguridad.length),
      sinStock: Math.round(v.sinStock.reduce((a, b) => a + b, 0) / v.sinStock.length),
    }));
  }
  // año – aggregate by quarter
  const map = new Map<string, { bajoSeguridad: number[]; sinStock: number[] }>();
  days.forEach((d) => {
    const y = d.fecha.slice(0, 4);
    if (!map.has(y)) map.set(y, { bajoSeguridad: [], sinStock: [] });
    map.get(y)!.bajoSeguridad.push(d.bajoSeguridad);
    map.get(y)!.sinStock.push(d.sinStock);
  });
  return Array.from(map.entries()).map(([y, v]) => ({
    fecha: y,
    label: y,
    bajoSeguridad: Math.round(v.bajoSeguridad.reduce((a, b) => a + b, 0) / v.bajoSeguridad.length),
    sinStock: Math.round(v.sinStock.reduce((a, b) => a + b, 0) / v.sinStock.length),
  }));
}

interface Props {
  stock: ProductoStock[];
  temporadaActiva: TemporadaStock | null;
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--chart-3, 45 93% 47%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 160 60% 45%))",
  "hsl(var(--accent))",
  "#6366f1", "#ec4899", "#14b8a6", "#f97316",
];

export default function StockAnalytics({ stock, temporadaActiva }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [filterCat, setFilterCat] = useState(ALL);

  const filteredStock = useMemo(
    () => (filterCat === ALL ? stock : stock.filter((p) => p.categoria === filterCat)),
    [stock, filterCat],
  );

  const enriched = useMemo(
    () => filteredStock.map((p) => ({ ...p, ...getStockConTemporada(p, temporadaActiva) })),
    [filteredStock, temporadaActiva],
  );

  // KPIs
  const sinStock = enriched.filter((p) => p.stockActual === 0).length;
  const bajoSeguridad = enriched.filter((p) => p.stockActual > 0 && p.stockActual < p.stockSeguridad).length;
  const enRiesgo = sinStock + bajoSeguridad;

  // Category breakdown
  const porCategoria = useMemo(() => {
    const map = new Map<string, { bajo: number; sin: number; total: number }>();
    enriched.forEach((p) => {
      if (!map.has(p.categoria)) map.set(p.categoria, { bajo: 0, sin: 0, total: 0 });
      const c = map.get(p.categoria)!;
      c.total++;
      if (p.stockActual === 0) c.sin++;
      else if (p.stockActual < p.stockSeguridad) c.bajo++;
    });
    return Array.from(map.entries())
      .map(([cat, v]) => ({ categoria: cat, ...v }))
      .sort((a, b) => (b.bajo + b.sin) - (a.bajo + a.sin));
  }, [enriched]);

  const catMasAfectada = porCategoria[0]?.categoria || "—";

  // Historical
  const history = useMemo(() => generateHistory(filteredStock, temporadaActiva), [filteredStock, temporadaActiva]);
  const chartData = useMemo(() => aggregateByPeriod(history, periodo), [history, periodo]);

  // Trend calculation
  const trend = useMemo(() => {
    if (chartData.length < 2) return 0;
    const last = chartData[chartData.length - 1];
    const prev = chartData[chartData.length - 2];
    return (last.bajoSeguridad + last.sinStock) - (prev.bajoSeguridad + prev.sinStock);
  }, [chartData]);

  // Pie data for sin stock vs bajo seguridad vs ok
  const pieData = useMemo(() => {
    const ok = enriched.length - enRiesgo;
    return [
      { name: "Correcto", value: ok },
      { name: "Bajo seguridad", value: bajoSeguridad },
      { name: "Sin stock", value: sinStock },
    ].filter((d) => d.value > 0);
  }, [enriched.length, enRiesgo, bajoSeguridad, sinStock]);

  const chartConfig = {
    bajoSeguridad: { label: "Bajo seguridad", color: "hsl(var(--chart-1, 220 70% 50%))" },
    sinStock: { label: "Sin stock", color: "hsl(var(--destructive))" },
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Día</SelectItem>
            <SelectItem value="semana">Semana</SelectItem>
            <SelectItem value="mes">Mes</SelectItem>
            <SelectItem value="año">Año</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {CATEGORIAS_STOCK.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {temporadaActiva && (
          <Badge variant="outline" className="gap-1 text-xs">
            Temporada activa: {temporadaActiva.nombre}
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-destructive/10 p-2.5">
              <PackageX className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">{sinStock}</div>
              <div className="text-xs text-muted-foreground font-medium">Sin stock</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">{bajoSeguridad}</div>
              <div className="text-xs text-muted-foreground font-medium">Bajo seguridad</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <AlertTriangle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">{enRiesgo}</div>
              <div className="text-xs text-muted-foreground font-medium">Productos en riesgo</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2.5">
              {trend <= 0
                ? <TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                : <TrendingUp className="h-5 w-5 text-destructive" />}
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">
                {catMasAfectada}
              </div>
              <div className="text-xs text-muted-foreground font-medium">Cat. más afectada</div>
              <div className={`text-[11px] font-semibold ${trend <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {trend === 0 ? "Sin cambios" : trend > 0 ? `+${trend} vs anterior` : `${trend} vs anterior`}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Evolution line chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Evolución de alertas de stock</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="bajoSeguridad" stroke="hsl(var(--chart-1, 220 70% 50%))" strokeWidth={2} dot={false} name="Bajo seguridad" />
                <Line type="monotone" dataKey="sinStock" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Sin stock" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Estado general</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={["hsl(var(--chart-5, 160 60% 45%))", "hsl(var(--chart-1, 220 70% 50%))", "hsl(var(--destructive))"][i] || PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 – category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="h-4 w-4" /> Alertas por categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={porCategoria} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="categoria" type="category" width={130} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="bajo" name="Bajo seguridad" fill="hsl(var(--chart-1, 220 70% 50%))" radius={[0, 4, 4, 0]} stackId="a" />
                <Bar dataKey="sin" name="Sin stock" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} stackId="a" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bar chart – products per category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Productos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ total: { label: "Productos", color: "hsl(var(--primary))" } }} className="h-[280px] w-full">
              <BarChart data={porCategoria}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="categoria" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" name="Total productos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
