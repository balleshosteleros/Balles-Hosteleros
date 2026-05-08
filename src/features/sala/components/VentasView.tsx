"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp,
  Receipt,
  Users,
  Coins,
  Wallet,
  Star,
  Sparkles,
  Trophy,
  PawPrint,
  Info,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getVentasDashboard } from "@/features/sala/actions/ventas-actions";
import type {
  VentasDashboard,
  VentasPreset,
  MenuClass,
  VentaProducto,
} from "@/features/sala/types/ventas";
import { MENU_CLASS_LABEL, MENU_CLASS_HINT } from "@/features/sala/types/ventas";

// ─── Helpers ────────────────────────────────────────────────────
const fmtEUR = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v || 0);
const fmtPct = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(v || 0);
const fmtInt = (v: number) => new Intl.NumberFormat("es-ES").format(Math.round(v || 0));

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function startOfMonth(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function endOfMonth(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}
function startOfYear(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

function rangoFromPreset(preset: VentasPreset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = todayIso();
  switch (preset) {
    case "hoy":
      return { from: today, to: today };
    case "ayer": {
      const ay = shiftIso(today, -1);
      return { from: ay, to: ay };
    }
    case "ultimos7":
      return { from: shiftIso(today, -6), to: today };
    case "ultimos30":
      return { from: shiftIso(today, -29), to: today };
    case "mesActual":
      return { from: startOfMonth(today), to: today };
    case "mesAnterior": {
      const prev = shiftIso(startOfMonth(today), -1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "anioActual":
      return { from: startOfYear(today), to: today };
    case "personalizado":
      return { from: customFrom, to: customTo };
  }
}

const PRESETS: { id: VentasPreset; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "ayer", label: "Ayer" },
  { id: "ultimos7", label: "7 días" },
  { id: "ultimos30", label: "30 días" },
  { id: "mesActual", label: "Mes actual" },
  { id: "mesAnterior", label: "Mes anterior" },
  { id: "anioActual", label: "Año" },
  { id: "personalizado", label: "Personalizado" },
];

const MENU_COLORS: Record<MenuClass, string> = {
  ESTRELLA: "hsl(45 95% 55%)",
  CABALLO: "hsl(212 90% 60%)",
  ENIGMA: "hsl(262 80% 65%)",
  PERRO: "hsl(0 70% 60%)",
};

const MENU_BADGE: Record<MenuClass, string> = {
  ESTRELLA: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  CABALLO: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  ENIGMA: "bg-violet-500/15 text-violet-400 border-violet-500/40",
  PERRO: "bg-red-500/15 text-red-400 border-red-500/40",
};

const MENU_ICON: Record<MenuClass, React.ComponentType<{ className?: string }>> = {
  ESTRELLA: Star,
  CABALLO: Trophy,
  ENIGMA: Sparkles,
  PERRO: PawPrint,
};

// ─── KPI Card ───────────────────────────────────────────────────
function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
          </div>
          <Icon className={cn("h-5 w-5 shrink-0", accent)} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Filtro de fechas ───────────────────────────────────────────
function FiltroFechas({
  preset,
  customFrom,
  customTo,
  onChange,
  onRefresh,
  loading,
}: {
  preset: VentasPreset;
  customFrom: string;
  customTo: string;
  onChange: (preset: VentasPreset, from: string, to: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={preset === p.id ? "default" : "outline"}
            onClick={() => onChange(p.id, customFrom, customTo)}
            className="h-8 text-xs"
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        {preset === "personalizado" && (
          <>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => onChange("personalizado", e.target.value, customTo)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => onChange("personalizado", customFrom, e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
          </>
        )}
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading} className="h-8 gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refrescar
        </Button>
      </div>
    </div>
  );
}

// ─── Vista principal ────────────────────────────────────────────
export function VentasView() {
  const [preset, setPreset] = useState<VentasPreset>("ultimos7");
  const [customFrom, setCustomFrom] = useState<string>(shiftIso(todayIso(), -6));
  const [customTo, setCustomTo] = useState<string>(todayIso());
  const [data, setData] = useState<VentasDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rango = useMemo(
    () => rangoFromPreset(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const cargar = (from: string, to: string) => {
    startTransition(async () => {
      const res = await getVentasDashboard(from, to);
      if (res.ok) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error);
        setData(null);
      }
    });
  };

  useEffect(() => {
    cargar(rango.from, rango.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango.from, rango.to]);

  const handleChange = (p: VentasPreset, from: string, to: string) => {
    setPreset(p);
    if (p === "personalizado") {
      setCustomFrom(from);
      setCustomTo(to);
    }
  };

  const resumen = data?.resumen;
  const conteoClases = useMemo(() => {
    const base: Record<MenuClass, number> = { ESTRELLA: 0, CABALLO: 0, ENIGMA: 0, PERRO: 0 };
    for (const p of data?.porProducto ?? []) base[p.clasificacion] += 1;
    return base;
  }, [data]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Ventas
            </h1>
            <p className="text-sm text-muted-foreground">
              Dashboard de ventas, productos y Menu Engineering
            </p>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <FiltroFechas
              preset={preset}
              customFrom={customFrom}
              customTo={customTo}
              onChange={handleChange}
              onRefresh={() => cargar(rango.from, rango.to)}
              loading={isPending}
            />
          </CardContent>
        </Card>

        {error && (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">
              Error cargando datos: {error}
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi icon={Coins} label="Ingresos" value={fmtEUR(resumen?.ingresos ?? 0)} accent="text-emerald-400" />
          <Kpi icon={Receipt} label="Tickets" value={fmtInt(resumen?.tickets ?? 0)} accent="text-sky-400" />
          <Kpi icon={Users} label="Comensales" value={fmtInt(resumen?.comensales ?? 0)} accent="text-violet-400" />
          <Kpi icon={Wallet} label="Ticket medio" value={fmtEUR(resumen?.ticketMedio ?? 0)} accent="text-amber-400" />
          <Kpi
            icon={Wallet}
            label="Por comensal"
            value={fmtEUR(resumen?.comensalMedio ?? 0)}
            accent="text-amber-400"
          />
          <Kpi
            icon={TrendingUp}
            label="Margen"
            value={fmtEUR(resumen?.margenTotal ?? 0)}
            hint={fmtPct(resumen?.margenPct ?? 0)}
            accent="text-emerald-400"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-4">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="productos">Productos</TabsTrigger>
            <TabsTrigger value="categorias">Categorías</TabsTrigger>
            <TabsTrigger value="menu-engineering">Menu Engineering</TabsTrigger>
          </TabsList>

          {/* ─── Resumen ─────────────────────────────────────── */}
          <TabsContent value="resumen" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ingresos por día</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data?.porDia ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}€`} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                      labelFormatter={(v) => `Día: ${v}`}
                      formatter={(value: number, name: string) =>
                        name === "ingresos"
                          ? [fmtEUR(value), "Ingresos"]
                          : name === "ticketMedio"
                          ? [fmtEUR(value), "Ticket medio"]
                          : [fmtInt(value), name === "tickets" ? "Tickets" : "Comensales"]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="ingresos"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Ingresos"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tickets y comensales por día</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data?.porDia ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="fecha"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: string) => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="tickets" fill="hsl(212 90% 60%)" name="Tickets" />
                      <Bar dataKey="comensales" fill="hsl(262 80% 65%)" name="Comensales" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Ingresos por categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={(data?.porCategoria ?? []).slice(0, 8)}
                      layout="vertical"
                      margin={{ left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}€`} />
                      <YAxis dataKey="categoria" type="category" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => fmtEUR(v)}
                      />
                      <Bar dataKey="ingresos" fill="hsl(var(--primary))" name="Ingresos" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Productos ───────────────────────────────────── */}
          <TabsContent value="productos" className="mt-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">
                  Ranking de productos ({data?.porProducto.length ?? 0})
                </CardTitle>
                <p className="text-xs text-muted-foreground">Ordenado por ingresos</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                        <TableHead className="text-right">Coste/u</TableHead>
                        <TableHead className="text-right">Margen/u</TableHead>
                        <TableHead className="text-right">Margen %</TableHead>
                        <TableHead>Clase</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.porProducto ?? []).map((p, i) => (
                        <TableRow key={(p.productoId ?? p.nombre) + i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.nombre}</TableCell>
                          <TableCell className="text-muted-foreground">{p.categoria}</TableCell>
                          <TableCell className="text-right">{fmtInt(p.cantidad)}</TableCell>
                          <TableCell className="text-right">{fmtEUR(p.ingresos)}</TableCell>
                          <TableCell className="text-right">{fmtEUR(p.costeUnitario)}</TableCell>
                          <TableCell className="text-right">{fmtEUR(p.margenUnitario)}</TableCell>
                          <TableCell className="text-right">{fmtPct(p.margenPct)}</TableCell>
                          <TableCell>
                            <ClassBadge clase={p.clasificacion} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {(data?.porProducto ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                            Sin ventas en el período seleccionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Categorías ──────────────────────────────────── */}
          <TabsContent value="categorias" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Por categoría</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">% mix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.porCategoria ?? []).map((c) => (
                      <TableRow key={c.categoria}>
                        <TableCell className="font-medium">{c.categoria}</TableCell>
                        <TableCell className="text-right">{fmtInt(c.cantidad)}</TableCell>
                        <TableCell className="text-right">{fmtEUR(c.ingresos)}</TableCell>
                        <TableCell className="text-right">{fmtPct(c.pct)}</TableCell>
                      </TableRow>
                    ))}
                    {(data?.porCategoria ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Sin datos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Menu Engineering ────────────────────────────── */}
          <TabsContent value="menu-engineering" className="mt-4 space-y-4">
            {/* Resumen 4 clases */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {(["ESTRELLA", "CABALLO", "ENIGMA", "PERRO"] as MenuClass[]).map((c) => {
                const Icon = MENU_ICON[c];
                return (
                  <Card key={c}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {MENU_CLASS_LABEL[c]}
                          </p>
                          <p className="mt-1 text-2xl font-bold">{conteoClases[c]}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                            {MENU_CLASS_HINT[c]}
                          </p>
                        </div>
                        <span className="shrink-0" style={{ color: MENU_COLORS[c] }}>
                          <Icon className="h-5 w-5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Cuadrante */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center gap-2">
                <CardTitle className="text-sm">Cuadrante popularidad × margen</CardTitle>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Eje X: popularidad (% de unidades sobre el total).<br />
                    Eje Y: margen unitario (€).<br />
                    Líneas: 70% de la popularidad media y margen medio del menú.
                  </TooltipContent>
                </UiTooltip>
              </CardHeader>
              <CardContent>
                <CuadranteME productos={data?.porProducto ?? []} />
              </CardContent>
            </Card>

            {/* Acciones por clase */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cambios sugeridos en la carta</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Clase</TableHead>
                        <TableHead className="text-right">Pop.</TableHead>
                        <TableHead className="text-right">Margen/u</TableHead>
                        <TableHead>Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.porProducto ?? []).map((p, i) => (
                        <TableRow key={(p.productoId ?? p.nombre) + "-me-" + i}>
                          <TableCell className="font-medium">{p.nombre}</TableCell>
                          <TableCell>
                            <ClassBadge clase={p.clasificacion} />
                          </TableCell>
                          <TableCell className="text-right">{fmtPct(p.popularidadPct)}</TableCell>
                          <TableCell className="text-right">{fmtEUR(p.margenUnitario)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {accionPara(p)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(data?.porProducto ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                            Sin productos para clasificar
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────
function ClassBadge({ clase }: { clase: MenuClass }) {
  const Icon = MENU_ICON[clase];
  return (
    <Badge variant="outline" className={cn("gap-1 border", MENU_BADGE[clase])}>
      <Icon className="h-3 w-3" />
      {MENU_CLASS_LABEL[clase]}
    </Badge>
  );
}

function CuadranteME({ productos }: { productos: VentaProducto[] }) {
  if (productos.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Sin productos para clasificar
      </div>
    );
  }

  const points = productos.map((p) => ({
    x: p.popularidadPct * 100,
    y: p.margenUnitario,
    nombre: p.nombre,
    cantidad: p.cantidad,
    clase: p.clasificacion,
  }));

  const popMedia = points.reduce((s, x) => s + x.x, 0) / points.length;
  const margenMedio = points.reduce((s, x) => s + x.y, 0) / points.length;

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ top: 12, right: 16, bottom: 16, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          dataKey="x"
          name="Popularidad"
          unit="%"
          tick={{ fontSize: 11 }}
          domain={[0, "auto"]}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Margen unitario"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v.toFixed(1)}€`}
        />
        <ZAxis type="number" dataKey="cantidad" range={[40, 240]} name="Cantidad" />
        <ReferenceLine x={popMedia * 0.7} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
        <ReferenceLine y={margenMedio} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => {
            if (name === "Popularidad") return [`${value.toFixed(1)}%`, name];
            if (name === "Margen unitario") return [fmtEUR(value), name];
            if (name === "Cantidad") return [fmtInt(value), name];
            return [value, name];
          }}
          labelFormatter={() => ""}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof points)[number];
            return (
              <div className="rounded-md border bg-popover p-2 text-xs shadow-md">
                <p className="font-semibold">{d.nombre}</p>
                <p className="text-muted-foreground">{MENU_CLASS_LABEL[d.clase]}</p>
                <p>Popularidad: {d.x.toFixed(1)}%</p>
                <p>Margen/u: {fmtEUR(d.y)}</p>
                <p>Vendidos: {fmtInt(d.cantidad)}</p>
              </div>
            );
          }}
        />
        <Scatter data={points}>
          {points.map((p, i) => (
            <Cell key={i} fill={MENU_COLORS[p.clase]} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function accionPara(p: VentaProducto): string {
  switch (p.clasificacion) {
    case "ESTRELLA":
      return "Mantener. Destacar en carta y formar al equipo para recomendarlo.";
    case "CABALLO":
      return "Renegociar coste, ajustar escandallo o subir precio sin perder demanda.";
    case "ENIGMA":
      return "Reposicionar en carta, nombre/foto más atractivo, sugerencia del camarero.";
    case "PERRO":
      return "Candidato a retirar o rediseñar plato; liberar espacio en carta.";
  }
}
