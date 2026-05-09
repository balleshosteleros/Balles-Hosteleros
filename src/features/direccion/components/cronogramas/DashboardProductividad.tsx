"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, CalendarIcon, CheckCircle2, Clock, TrendingUp, TrendingDown, Users, AlertTriangle, CalendarClock,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line,
} from "recharts";
import {
  getProductividad, getEmpleadosEmpresa,
  type ProductividadFila,
} from "../../actions/cronograma-ejecuciones-actions";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

type RangoPreset =
  | "7d"
  | "30d"
  | "90d"
  | "mes"
  | "mes_pasado"
  | "trimestre"
  | "trimestre_pasado"
  | "ano"
  | "ano_pasado"
  | "custom";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatRangoLabel(desde: string, hasta: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  return `${fmt(desde)} – ${fmt(hasta)}`;
}

function presetToRange(preset: RangoPreset): { desde: string; hasta: string } {
  const hoy = new Date();
  if (preset === "mes_pasado") {
    const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    return { desde: toISODate(desde), hasta: toISODate(hasta) };
  }
  if (preset === "trimestre") {
    const q = Math.floor(hoy.getMonth() / 3);
    const desde = new Date(hoy.getFullYear(), q * 3, 1);
    return { desde: toISODate(desde), hasta: toISODate(hoy) };
  }
  if (preset === "trimestre_pasado") {
    const q = Math.floor(hoy.getMonth() / 3);
    const desde = new Date(hoy.getFullYear(), (q - 1) * 3, 1);
    const hasta = new Date(hoy.getFullYear(), q * 3, 0);
    return { desde: toISODate(desde), hasta: toISODate(hasta) };
  }
  if (preset === "ano") {
    const desde = new Date(hoy.getFullYear(), 0, 1);
    return { desde: toISODate(desde), hasta: toISODate(hoy) };
  }
  if (preset === "ano_pasado") {
    const desde = new Date(hoy.getFullYear() - 1, 0, 1);
    const hasta = new Date(hoy.getFullYear() - 1, 11, 31);
    return { desde: toISODate(desde), hasta: toISODate(hasta) };
  }
  const hasta = toISODate(hoy);
  const desde = new Date(hoy);
  if (preset === "7d") desde.setDate(hoy.getDate() - 6);
  else if (preset === "30d") desde.setDate(hoy.getDate() - 29);
  else if (preset === "90d") desde.setDate(hoy.getDate() - 89);
  else if (preset === "mes") desde.setDate(1);
  return { desde: toISODate(desde), hasta };
}

export function DashboardProductividad() {
  const router = useRouter();
  const [rows, setRows] = useState<ProductividadFila[]>([]);
  const [empleados, setEmpleados] = useState<Array<{ user_id: string; nombre: string; rol: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<RangoPreset>("30d");
  const [desde, setDesde] = useState<string>(presetToRange("30d").desde);
  const [hasta, setHasta] = useState<string>(presetToRange("30d").hasta);
  const [filtroDepto, setFiltroDepto] = useState<string>("_all");
  const [filtroUser, setFiltroUser] = useState<string>("_all");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pRes, eRes] = await Promise.all([
        getProductividad({
          fechaDesde: desde,
          fechaHasta: hasta,
          departamentos: filtroDepto !== "_all" ? [filtroDepto] : undefined,
          userIds: filtroUser !== "_all" ? [filtroUser] : undefined,
        }),
        getEmpleadosEmpresa(),
      ]);
      if (!pRes.ok) throw new Error(pRes.error);
      setRows(pRes.data);
      if (eRes.ok) setEmpleados(eRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [desde, hasta, filtroDepto, filtroUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePreset = (p: RangoPreset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetToRange(p);
      setDesde(r.desde);
      setHasta(r.hasta);
    }
  };

  // ── Agregaciones ──────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = rows.reduce((acc, r) => acc + r.total, 0);
    const hechas = rows.reduce((acc, r) => acc + r.hechas, 0);
    const pendientes = rows.reduce((acc, r) => acc + r.pendientes, 0);
    const pospuestas = rows.reduce((acc, r) => acc + (r.pospuestas ?? 0), 0);
    const pospuestasTotales = rows.reduce((acc, r) => acc + (r.pospuestas_totales ?? 0), 0);
    const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;
    return { total, hechas, pendientes, pospuestas, pospuestasTotales, pct };
  }, [rows]);

  const porDepto = useMemo(() => {
    const m = new Map<string, { depto: string; hechas: number; pendientes: number; omitidas: number; total: number }>();
    for (const r of rows) {
      const v = m.get(r.departamento) ?? { depto: r.departamento, hechas: 0, pendientes: 0, omitidas: 0, total: 0 };
      v.hechas += r.hechas;
      v.pendientes += r.pendientes;
      v.omitidas += r.omitidas;
      v.total += r.total;
      m.set(r.departamento, v);
    }
    return Array.from(m.values())
      .map((v) => ({ ...v, pct: v.total > 0 ? Math.round((v.hechas / v.total) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [rows]);

  const departamentos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.departamento))).sort(),
    [rows]
  );

  const porDia = useMemo(() => {
    const m = new Map<string, { fecha: string; hechas: number; pendientes: number; total: number }>();
    for (const r of rows) {
      const v = m.get(r.fecha_programada) ?? { fecha: r.fecha_programada, hechas: 0, pendientes: 0, total: 0 };
      v.hechas += r.hechas;
      v.pendientes += r.pendientes;
      v.total += r.total;
      m.set(r.fecha_programada, v);
    }
    return Array.from(m.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((v) => ({
        ...v,
        pct: v.total > 0 ? Math.round((v.hechas / v.total) * 100) : 0,
      }));
  }, [rows]);

  const rankingEmpleados = useMemo(() => {
    const m = new Map<string, { user_id: string; hechas: number; total: number; pospuestas: number; pospuestasTotales: number }>();
    for (const r of rows) {
      const v = m.get(r.user_id) ?? { user_id: r.user_id, hechas: 0, total: 0, pospuestas: 0, pospuestasTotales: 0 };
      v.hechas += r.hechas;
      v.total += r.total;
      v.pospuestas += r.pospuestas ?? 0;
      v.pospuestasTotales += r.pospuestas_totales ?? 0;
      m.set(r.user_id, v);
    }
    const empMap = new Map(empleados.map((e) => [e.user_id, e]));
    return Array.from(m.values())
      .map((v) => {
        const emp = empMap.get(v.user_id);
        return {
          ...v,
          nombre: emp?.nombre ?? v.user_id.slice(0, 8),
          rol: emp?.rol ?? "—",
          pct: v.total > 0 ? Math.round((v.hechas / v.total) * 100) : 0,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [rows, empleados]);

  const mejorDepto = porDepto[0];
  const peorDepto = porDepto[porDepto.length - 1];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/20">
      {/* Filtros */}
      <div className="px-6 pt-3 pb-3 border-b bg-card space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/direccion/cronogramas")}
            className="h-9 w-9 p-0"
            aria-label="Volver a Cronogramas"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Período</Label>
            <Select value={preset} onValueChange={(v) => handlePreset(v as RangoPreset)}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
                <SelectItem value="90d">Últimos 90 días</SelectItem>
                <SelectItem value="mes">Este mes</SelectItem>
                <SelectItem value="mes_pasado">Mes pasado</SelectItem>
                <SelectItem value="trimestre">Este trimestre</SelectItem>
                <SelectItem value="trimestre_pasado">Trimestre pasado</SelectItem>
                <SelectItem value="ano">Este año</SelectItem>
                <SelectItem value="ano_pasado">Año pasado</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === "custom" && (
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Rango de fechas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[260px] h-9 justify-start font-normal text-left"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                    <span className="tabular-nums">{formatRangoLabel(desde, hasta)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    defaultMonth={fromISODate(desde)}
                    selected={{ from: fromISODate(desde), to: fromISODate(hasta) }}
                    onSelect={(range: DateRange | undefined) => {
                      if (range?.from) {
                        setDesde(toISODate(range.from));
                        setHasta(toISODate(range.to ?? range.from));
                        setPreset("custom");
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Departamento</Label>
            <Select value={filtroDepto} onValueChange={setFiltroDepto}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {departamentos.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Empleado</Label>
            <Select value={filtroUser} onValueChange={setFiltroUser}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {empleados.map((e) => (
                  <SelectItem key={e.user_id} value={e.user_id}>
                    {e.nombre} <span className="text-muted-foreground text-xs">({e.rol})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {error ? (
          <Card className="p-6 bg-amber-50 border-amber-200 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">No se pudo cargar la productividad.</p>
              <p className="text-sm text-amber-800 mt-1">{error}</p>
              <p className="text-xs text-amber-700 mt-2">
                Probablemente la migración 045 no está aplicada o no hay ejecuciones sembradas todavía.
              </p>
            </div>
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard
                label="% Cumplimiento"
                value={`${kpis.pct}%`}
                icon={CheckCircle2}
                tone={kpis.pct >= 80 ? "ok" : kpis.pct >= 50 ? "warn" : "bad"}
              />
              <KpiCard label="Tareas hechas" value={kpis.hechas.toLocaleString()} icon={CheckCircle2} tone="ok" />
              <KpiCard label="Pendientes" value={kpis.pendientes.toLocaleString()} icon={Clock} tone="warn" />
              <KpiCard
                label="Pospuestas"
                value={kpis.pospuestasTotales.toLocaleString()}
                sublabel={kpis.pospuestas > 0 ? `${kpis.pospuestas} tareas afectadas` : undefined}
                icon={CalendarClock}
                tone={kpis.pospuestasTotales > 0 ? "warn" : "neutral"}
              />
              <KpiCard label="Total programadas" value={kpis.total.toLocaleString()} icon={Users} tone="neutral" />
            </div>

            {/* Top/Bottom depto */}
            {mejorDepto && peorDepto && mejorDepto.depto !== peorDepto.depto && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Mejor departamento</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-bold">{mejorDepto.depto}</span>
                    <span className="text-2xl font-bold text-emerald-700 tabular-nums">{mejorDepto.pct}%</span>
                  </div>
                </Card>
                <Card className="p-4 border-red-200 bg-red-50/50">
                  <div className="flex items-center gap-2 text-red-800">
                    <TrendingDown className="h-5 w-5" />
                    <span className="text-xs uppercase tracking-wider font-semibold">A mejorar</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-bold">{peorDepto.depto}</span>
                    <span className="text-2xl font-bold text-red-700 tabular-nums">{peorDepto.pct}%</span>
                  </div>
                </Card>
              </div>
            )}

            {/* Gráfica 1: barras apiladas por depto */}
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-3 tracking-tight">Cumplimiento por departamento</h3>
              {isLoading ? (
                <LoadingSpinner className="h-72" />
              ) : porDepto.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                  Sin datos en el rango seleccionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={porDepto}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="depto" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="hechas" stackId="a" fill="#10b981" name="Hechas" />
                    <Bar dataKey="pendientes" stackId="a" fill="#f59e0b" name="Pendientes" />
                    <Bar dataKey="omitidas" stackId="a" fill="#ef4444" name="Omitidas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Gráfica 2: línea evolución diaria */}
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-3 tracking-tight">Evolución diaria del % cumplimiento</h3>
              {isLoading ? (
                <LoadingSpinner className="h-64" />
              ) : porDia.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                  Sin datos.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={porDia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip />
                    <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} name="% Cumplimiento" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Ranking empleados */}
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-3 tracking-tight">Ranking por empleado</h3>
              {rankingEmpleados.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">Sin datos.</div>
              ) : (
                <div className="divide-y">
                  {rankingEmpleados.slice(0, 15).map((e, i) => (
                    <div key={e.user_id} className="flex items-center gap-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground w-6 text-center">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{e.nombre}</span>
                          <Badge variant="outline" className="text-[10px]">{e.rol}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {e.hechas} / {e.total} tareas
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1 text-xs tabular-nums w-24 justify-end",
                          e.pospuestasTotales >= 3
                            ? "text-red-600 font-semibold"
                            : e.pospuestasTotales > 0
                              ? "text-amber-600"
                              : "text-muted-foreground/40",
                        )}
                        title={`${e.pospuestasTotales} pospuestas en ${e.pospuestas} tareas`}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        {e.pospuestasTotales}
                      </div>
                      <div className="w-32">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              e.pct >= 80 ? "bg-emerald-500" : e.pct >= 50 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${e.pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold tabular-nums w-12 text-right">{e.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sublabel, icon: Icon, tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ElementType;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const colors = {
    ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
    warn: "text-amber-700 bg-amber-50 border-amber-200",
    bad: "text-red-700 bg-red-50 border-red-200",
    neutral: "text-slate-700 bg-slate-50 border-slate-200",
  };
  return (
    <Card className={cn("p-4 border", colors[tone])}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-3xl font-bold tabular-nums mt-1.5">{value}</div>
      {sublabel && <div className="text-[10px] mt-0.5 opacity-70">{sublabel}</div>}
    </Card>
  );
}
