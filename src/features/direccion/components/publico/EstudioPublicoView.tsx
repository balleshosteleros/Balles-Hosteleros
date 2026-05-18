"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAnonClient } from "@/lib/supabase/anon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, FileText, Calculator, Landmark, Target, Clock,
  Receipt, Building2, Sparkles, ChefHat, Activity, Ticket, Layers, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Sector,
} from "recharts";
import {
  ESCENARIOS,
  calcularEscenario, calcularPilar, type CostePilar, type PilarKey,
  pilarFijo, pilarVariablePct, type FacturacionPilar, type FactPilarKey,
  FACT_PILAR_KEYS, FACT_PILAR_NAMES,
  totalFacturacion, totalClientes, ticketMedioPonderado,
  pilarFactClientes, pilarFactTotal, pilarFactTicketPonderado,
  lineasPlanas,
  type DatosProyecto,
} from "@/features/direccion/data/aperturas";
import { LocalTab } from "@/features/direccion/components/aperturas/LocalTab";
import { MarcaTab } from "@/features/direccion/components/aperturas/MarcaTab";
import { GastronomiaTab } from "@/features/direccion/components/aperturas/GastronomiaTab";
import { OcupacionTab } from "@/features/direccion/components/aperturas/OcupacionTab";
import { ProcedenciaTab } from "@/features/direccion/components/aperturas/ProcedenciaTab";
import { DestinoTab } from "@/features/direccion/components/aperturas/DestinoTab";
import { AmortizacionTab } from "@/features/direccion/components/aperturas/AmortizacionTab";
import type { EstudioPublico } from "@/features/direccion/services/estudio-publico-fetch";

const COLORS = ["hsl(var(--primary))", "hsl(210 70% 50%)", "hsl(150 60% 45%)", "hsl(40 90% 55%)", "hsl(340 70% 50%)"];
const PILAR_COLORS = ["hsl(210 70% 55%)", "hsl(340 65% 55%)", "hsl(150 60% 45%)", "hsl(40 90% 55%)"];
const PILAR_NAMES = ["Generales", "Personal", "Producto", "Marketing"];
const FACT_PILAR_COLORS: Record<FactPilarKey, string> = {
  franjas:  "hsl(210 70% 55%)",
  acuerdos: "hsl(40 90% 55%)",
  eventos:  "hsl(340 65% 55%)",
  tienda:   "hsl(150 60% 45%)",
};

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) : "—";
}

function formatRecuperacion(mesesTotal: number): string {
  const meses = Math.max(0, Math.ceil(mesesTotal));
  const anos = Math.floor(meses / 12);
  const mesesRest = meses % 12;
  if (anos === 0) return `${mesesRest} ${mesesRest === 1 ? "mes" : "meses"}`;
  if (mesesRest === 0) return `${anos} ${anos === 1 ? "año" : "años"}`;
  return `${anos} ${anos === 1 ? "año" : "años"} ${mesesRest} ${mesesRest === 1 ? "mes" : "meses"}`;
}

type Periodo = "mensual" | "trimestral" | "anual";
const PERIODO_FACTOR: Record<Periodo, number> = { mensual: 1, trimestral: 3, anual: 12 };
const PERIODO_SUFIJO: Record<Periodo, string> = { mensual: "/mes", trimestral: "/trim.", anual: "/año" };

type KpiKey = "facturacion" | "costeTotal" | "beneficio" | "margen";

export function EstudioPublicoView({ data }: { data: EstudioPublico }) {
  const { estudio } = data;
  const { datos, facturacion, costes, procedencia, destinos, amortizacion, local, imagenMarca, propuesta, ocupacion } = estudio;
  const router = useRouter();

  // Realtime: refresca el server component cuando el dueño edita el estudio.
  useEffect(() => {
    const sb = createAnonClient();
    const channel = sb
      .channel(`estudio-publico-${estudio.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "estudios_apertura",
          filter: `id=eq.${estudio.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [estudio.id, router]);

  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  const [hoveredKpi, setHoveredKpi] = useState<KpiKey | null>(null);
  const [facturacionPeriodo, setFacturacionPeriodo] = useState<Periodo>("mensual");
  const [costesPeriodo, setCostesPeriodo] = useState<Periodo>("mensual");
  const [facturacionTab, setFacturacionTab] = useState<"facturacion" | "ocupacion" | "ticket">("facturacion");
  const [costesTab, setCostesTab] = useState<"pilares" | "equilibrio">("pilares");
  const [mainTab, setMainTab] = useState<"datos" | "concepto" | "facturacion" | "costes" | "escenarios" | "inversion">("escenarios");
  const [expandEscFact, setExpandEscFact] = useState(false);
  const [expandEscCostes, setExpandEscCostes] = useState(false);

  const factor = PERIODO_FACTOR[periodo];
  const sufijo = PERIODO_SUFIJO[periodo];
  const inversionTotal = procedencia.reduce((s, l) => s + (l.total || 0), 0);
  const ventas = totalFacturacion(facturacion);
  const clientesMes = totalClientes(facturacion);
  const ticketPond = ticketMedioPonderado(facturacion);

  const escenarios = ESCENARIOS.map(e => {
    const r = calcularEscenario(ventas, e.factor, costes);
    return { ...e, ...r };
  });

  const medio = escenarios[2];
  const fijoTotal = pilarFijo(costes.generales) + pilarFijo(costes.personal) + pilarFijo(costes.producto) + pilarFijo(costes.marketing);
  const variablePctTotal = pilarVariablePct(costes.generales) + pilarVariablePct(costes.personal) + pilarVariablePct(costes.producto) + pilarVariablePct(costes.marketing);

  const pieData = [
    { name: "Generales", value: calcularPilar(ventas, costes.generales) },
    { name: "Personal", value: calcularPilar(ventas, costes.personal) },
    { name: "Producto", value: calcularPilar(ventas, costes.producto) },
    { name: "Marketing", value: calcularPilar(ventas, costes.marketing) },
  ];

  const sensibilidadData = Array.from({ length: 9 }, (_, i) => {
    const f = 0.6 + i * 0.1;
    const r = calcularEscenario(ventas, f, costes);
    return { facturacion: fmt(r.facturacion), beneficio: r.beneficio, margen: parseFloat(r.margen.toFixed(1)) };
  });

  const peMensual = variablePctTotal < 100 ? fijoTotal / (1 - variablePctTotal / 100) : Infinity;
  const peAnual = peMensual * 12;

  const donutBase: { name: string; value: number; group: "costes" | "beneficio"; color: string }[] = [
    { name: "Generales", value: pieData[0].value, group: "costes", color: PILAR_COLORS[0] },
    { name: "Personal", value: pieData[1].value, group: "costes", color: PILAR_COLORS[1] },
    { name: "Producto", value: pieData[2].value, group: "costes", color: PILAR_COLORS[2] },
    { name: "Marketing", value: pieData[3].value, group: "costes", color: PILAR_COLORS[3] },
  ];
  if (medio.beneficio > 0) {
    donutBase.push({ name: "Beneficio", value: medio.beneficio, group: "beneficio", color: "hsl(142 80% 42%)" });
  }
  const donutData = donutBase.map((d) => ({ ...d, value: d.value * factor }));
  const beneficioIndex = donutData.findIndex((d) => d.group === "beneficio");

  const isDonutActive = (group: "costes" | "beneficio") => {
    if (!hoveredKpi) return true;
    if (hoveredKpi === "facturacion") return true;
    if (hoveredKpi === "costeTotal") return group === "costes";
    return group === "beneficio";
  };

  const noop = () => { /* read-only */ };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-slate-50">
      {/* Cabecera: título + estados a la izquierda, foto reducida a la derecha */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{datos.nombre}</h1>
            <p className="text-muted-foreground text-sm truncate">
              {datos.ciudad}{datos.zona ? ` — ${datos.zona}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estudio.viabilidad === "viable" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
              {estudio.viabilidad === "viable" ? "Viable" : "No viable"}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estudio.actividad === "activo" ? "bg-blue-500 text-white" : "bg-gray-400 text-white"}`}>
              {estudio.actividad === "activo" ? "Activo" : "No activo"}
            </span>
          </div>
        </div>

        {estudio.imagen ? (
          <div className="shrink-0 w-full md:w-96 lg:w-[28rem] rounded-xl overflow-hidden border shadow-sm md:ml-auto">
            <img src={estudio.imagen} alt={datos.nombre} className="w-full h-32 md:h-36 lg:h-40 object-cover" />
          </div>
        ) : null}
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div />
          <TabsList className="h-11 gap-1 rounded-xl border bg-muted/50 p-1 shadow-sm flex flex-wrap justify-self-center">
            <TabsTrigger value="datos" className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <FileText className="h-4 w-4" />Datos
            </TabsTrigger>
            <TabsTrigger value="concepto" className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Sparkles className="h-4 w-4" />Concepto
            </TabsTrigger>
            <TabsTrigger value="facturacion" className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Receipt className="h-4 w-4" />Facturación
            </TabsTrigger>
            <TabsTrigger value="costes" className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Calculator className="h-4 w-4" />Costes
            </TabsTrigger>
            <TabsTrigger value="escenarios" className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <TrendingUp className="h-4 w-4" />Escenarios
            </TabsTrigger>
            <TabsTrigger value="inversion" className="h-9 gap-1.5 rounded-lg px-4 font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Landmark className="h-4 w-4" />Inversión
            </TabsTrigger>
          </TabsList>
          <div className="justify-self-end">
            {mainTab === "escenarios" && (
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* ── ESCENARIOS ── */}
        <TabsContent value="escenarios" className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Resumen ejecutivo</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card
                className={`cursor-default transition-all ${hoveredKpi === "facturacion" ? "ring-2 ring-primary shadow-md" : ""}`}
                onMouseEnter={() => setHoveredKpi("facturacion")}
                onMouseLeave={() => setHoveredKpi(null)}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{fmt(medio.facturacion * factor)}€</p>
                  <p className="text-xs text-muted-foreground">Facturación estimada</p>
                </CardContent>
              </Card>
              <Card
                className={`cursor-default transition-all ${hoveredKpi === "costeTotal" ? "ring-2 ring-primary shadow-md" : ""}`}
                onMouseEnter={() => setHoveredKpi("costeTotal")}
                onMouseLeave={() => setHoveredKpi(null)}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{fmt(medio.costeTotal * factor)}€</p>
                  <p className="text-xs text-muted-foreground">Coste total</p>
                </CardContent>
              </Card>
              <Card
                className={`cursor-default transition-all ${hoveredKpi === "beneficio" ? "ring-2 ring-primary shadow-md" : ""}`}
                onMouseEnter={() => setHoveredKpi("beneficio")}
                onMouseLeave={() => setHoveredKpi(null)}
              >
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${medio.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(medio.beneficio * factor)}€</p>
                  <p className="text-xs text-muted-foreground">Beneficio estimado</p>
                </CardContent>
              </Card>
              <Card
                className={`cursor-default transition-all ${hoveredKpi === "margen" ? "ring-2 ring-primary shadow-md" : ""}`}
                onMouseEnter={() => setHoveredKpi("margen")}
                onMouseLeave={() => setHoveredKpi(null)}
              >
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${medio.margen >= 0 ? "text-green-600" : "text-red-600"}`}>{medio.margen.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Margen</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className={`transition-all ${hoveredKpi ? "ring-1 ring-primary/40" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-base">Estructura {sufijo}</CardTitle>
                  <p className="text-xs text-muted-foreground">Pasa el cursor por los KPI de arriba para resaltar segmentos.</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        isAnimationActive={false}
                        activeIndex={beneficioIndex >= 0 ? beneficioIndex : undefined}
                        activeShape={((props: unknown) => {
                          const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, fillOpacity } = props as { cx: number; cy: number; innerRadius: number; outerRadius: number; startAngle: number; endAngle: number; fill: string; fillOpacity?: number };
                          return (
                            <g style={{ filter: "drop-shadow(0 0 10px rgba(34,197,94,0.55)) drop-shadow(0 0 4px rgba(34,197,94,0.45))" }}>
                              <Sector
                                cx={cx} cy={cy}
                                innerRadius={innerRadius}
                                outerRadius={outerRadius + 10}
                                startAngle={startAngle} endAngle={endAngle}
                                fill={fill} fillOpacity={fillOpacity ?? 1}
                                stroke="hsl(var(--background))" strokeWidth={2}
                              />
                            </g>
                          );
                        }) as unknown as import("recharts").PieProps["activeShape"]}
                      >
                        {donutData.map((d, i) => {
                          const active = isDonutActive(d.group);
                          return (
                            <Cell key={i} fill={d.color} fillOpacity={active ? 1 : 0.2}
                              stroke={hoveredKpi && active ? "hsl(var(--background))" : "transparent"} strokeWidth={2} />
                          );
                        })}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                      <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Lectura de viabilidad</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {medio.beneficio >= 0 ? <TrendingUp className="h-6 w-6 text-green-600" /> : <TrendingDown className="h-6 w-6 text-red-600" />}
                    <div>
                      <p className="font-semibold">{medio.beneficio >= 0 ? "Proyecto viable en escenario estimado" : "Proyecto no viable en escenario estimado"}</p>
                      <p className="text-sm text-muted-foreground">{escenarios.filter(e => e.beneficio > 0).length} de 5 escenarios son rentables.</p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Punto de equilibrio</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Mensual</p>
                        <p className="text-lg font-semibold">{Number.isFinite(peMensual) ? `${fmt(peMensual)}€` : "—"}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Anual</p>
                        <p className="text-lg font-semibold">{Number.isFinite(peAnual) ? `${fmt(peAnual)}€` : "—"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 pt-3 border-t">
                    {pieData.map((p) => (
                      <div key={p.name} className="text-center">
                        <p className="text-sm font-bold">{fmt(p.value * factor)}€</p>
                        <p className="text-[10px] text-muted-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">({medio.facturacion > 0 ? ((p.value / medio.facturacion) * 100).toFixed(0) : 0}%)</p>
                      </div>
                    ))}
                    <div className="text-center">
                      <p className={`text-sm font-bold ${medio.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(medio.beneficio * factor)}€</p>
                      <p className="text-[10px] text-muted-foreground">Beneficio</p>
                      <p className="text-[10px] text-muted-foreground">({medio.margen.toFixed(0)}%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Tabla de escenarios</h2>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                {(() => {
                  const tieneInversion = inversionTotal > 0;
                  return (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/40">
                        <th className="text-left p-3 font-medium">Escenario</th>
                        {expandEscFact && lineasPlanas(facturacion).map((l) => (
                          <th key={l.id} className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">{l.nombre}</th>
                        ))}
                        <th className="text-right p-3 font-medium whitespace-nowrap">
                          <button type="button" onClick={() => setExpandEscFact((v) => !v)} className="inline-flex items-center gap-1 hover:text-foreground">
                            Facturación
                            {expandEscFact ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </th>
                        {expandEscCostes && (
                          <>
                            <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Costes fijos</th>
                            <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Costes variables</th>
                          </>
                        )}
                        <th className="text-right p-3 font-medium whitespace-nowrap">
                          <button type="button" onClick={() => setExpandEscCostes((v) => !v)} className="inline-flex items-center gap-1 hover:text-foreground">
                            Coste total
                            {expandEscCostes ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </th>
                        <th className="text-right p-3 font-medium">Beneficio</th>
                        <th className="text-right p-3 font-medium">Margen</th>
                        <th className="text-right p-3 font-medium whitespace-nowrap">ROI</th>
                        <th className="text-right p-3 font-medium whitespace-nowrap">Recuperación</th>
                      </tr></thead>
                      <tbody>
                        {escenarios.map((e) => {
                          const factPeriodo = e.facturacion * factor;
                          const fijoPeriodo = e.fijoTotal * factor;
                          const varPeriodo = e.varTotal * factor;
                          const costePeriodo = e.costeTotal * factor;
                          const beneficioPeriodo = e.beneficio * factor;
                          const roiPeriodoPct = tieneInversion ? (beneficioPeriodo / inversionTotal) * 100 : 0;
                          const recuperaInversion = tieneInversion && e.beneficio > 0;
                          return (
                            <tr key={e.nombre} className={`border-b ${e.nombre === "Estimado" ? "bg-primary/5" : ""}`}>
                              <td className="p-3 font-medium">{e.nombre}</td>
                              {expandEscFact && lineasPlanas(facturacion).map((l) => {
                                const lineaMensual = (l.clientesEsperados || 0) * (l.ticketMedio || 0);
                                const lineaPeriodo = lineaMensual * e.factor * factor;
                                return <td key={l.id} className="p-3 text-right text-muted-foreground">{fmt(lineaPeriodo)}€</td>;
                              })}
                              <td className="p-3 text-right">{fmt(factPeriodo)}€</td>
                              {expandEscCostes && (
                                <>
                                  <td className="p-3 text-right text-muted-foreground">{fmt(fijoPeriodo)}€</td>
                                  <td className="p-3 text-right text-muted-foreground">{fmt(varPeriodo)}€</td>
                                </>
                              )}
                              <td className="p-3 text-right">{fmt(costePeriodo)}€</td>
                              <td className={`p-3 text-right font-semibold ${e.beneficio >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(beneficioPeriodo)}€</td>
                              <td className={`p-3 text-right ${e.margen >= 0 ? "text-green-600" : "text-red-600"}`}>{e.margen.toFixed(1)}%</td>
                              <td className={`p-3 text-right ${tieneInversion ? (roiPeriodoPct >= 0 ? "text-green-600" : "text-red-600") : "text-muted-foreground"}`}>
                                {tieneInversion ? `${roiPeriodoPct.toFixed(1)}%` : "—"}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                {recuperaInversion ? formatRecuperacion(inversionTotal / e.beneficio) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Gráficas</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">Facturación y beneficio por escenario</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={escenarios.map(e => ({ name: e.nombre, Facturación: e.facturacion, Beneficio: e.beneficio }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                      <Legend />
                      <Bar dataKey="Facturación" fill="hsl(210 70% 55%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Beneficio" fill="hsl(150 60% 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Peso de cada pilar de coste</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={PILAR_COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Margen estimado por escenario</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={escenarios.map(e => ({ name: e.nombre, Margen: parseFloat(e.margen.toFixed(1)) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="Margen" radius={[4, 4, 0, 0]}>
                        {escenarios.map((e, i) => <Cell key={i} fill={e.margen >= 0 ? "hsl(150 60% 45%)" : "hsl(0 70% 55%)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Sensibilidad — beneficio vs facturación</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={sensibilidadData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="facturacion" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                      <Line type="monotone" dataKey="beneficio" stroke="hsl(150 60% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>

        {/* ── DATOS ── */}
        <TabsContent value="datos">
          <Card>
            <CardContent className="p-6">
              <DatosEditorReadOnly datos={datos} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONCEPTO ── */}
        <TabsContent value="concepto">
          <Tabs defaultValue="local">
            <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="local" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                <Building2 className="h-4 w-4" />Local
              </TabsTrigger>
              <TabsTrigger value="marca" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                <Sparkles className="h-4 w-4" />Imagen de marca
              </TabsTrigger>
              <TabsTrigger value="gastronomia" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                <ChefHat className="h-4 w-4" />Gastronomía
              </TabsTrigger>
            </TabsList>
            <TabsContent value="local" className="mt-4">
              <LocalTab estudioId={estudio.id} local={local} onChange={noop} readOnly />
            </TabsContent>
            <TabsContent value="marca" className="mt-4">
              <MarcaTab estudioId={estudio.id} marca={imagenMarca} onChange={noop} readOnly />
            </TabsContent>
            <TabsContent value="gastronomia" className="mt-4">
              <GastronomiaTab estudioId={estudio.id} propuesta={propuesta} ventasMensuales={ventas} onChange={noop} readOnly />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── FACTURACIÓN ── */}
        <TabsContent value="facturacion">
          <Tabs value={facturacionTab} onValueChange={(v) => setFacturacionTab(v as typeof facturacionTab)}>
            <div className="flex items-end justify-between border-b">
              <TabsList className="h-auto justify-start gap-6 rounded-none bg-transparent p-0">
                <TabsTrigger value="facturacion" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                  <Layers className="h-4 w-4" />Pilares
                </TabsTrigger>
                <TabsTrigger value="ocupacion" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                  <Activity className="h-4 w-4" />Ocupación
                </TabsTrigger>
                <TabsTrigger value="ticket" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                  <Ticket className="h-4 w-4" />Ticket medio
                </TabsTrigger>
              </TabsList>
              {facturacionTab === "facturacion" && (
                <div className="pb-2">
                  <Select value={facturacionPeriodo} onValueChange={(v) => setFacturacionPeriodo(v as Periodo)}>
                    <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TabsContent value="facturacion" className="mt-4 space-y-4">
              {(() => {
                const factFactor = PERIODO_FACTOR[facturacionPeriodo];
                return (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Estructura de facturación por pilares</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Despliega cada pilar para ver sus partidas. Los totales del pilar se calculan automáticamente.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/40">
                            <th className="text-left p-3 font-medium w-[28%]">Pilar / Partida</th>
                            <th className="text-left p-3 font-medium">Clientes esperados</th>
                            <th className="text-left p-3 font-medium">Ticket medio (€)</th>
                            <th className="text-right p-3 font-medium">Total (€)</th>
                            <th className="text-right p-3 font-medium">% del total</th>
                            <th className="w-10"></th>
                          </tr></thead>
                          <tbody>
                            {FACT_PILAR_KEYS.map((key) => (
                              <PilarFactBloqueReadOnly
                                key={key}
                                label={FACT_PILAR_NAMES[key]}
                                pilar={facturacion[key]}
                                ventasTotal={ventas}
                                factor={factFactor}
                              />
                            ))}
                            <tr className="bg-muted/30 font-semibold">
                              <td className="p-3">TOTAL</td>
                              <td className="p-3">{fmt(clientesMes * factFactor)}</td>
                              <td className="p-3">{ticketPond.toFixed(2)}€</td>
                              <td className="p-3 text-right">{fmt(ventas * factFactor)}€</td>
                              <td className="p-3 text-right">100%</td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader><CardTitle className="text-sm">Distribución de ingresos por pilar</CardTitle></CardHeader>
                        <CardContent>
                          {ventas > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart>
                                <Pie
                                  data={FACT_PILAR_KEYS
                                    .map((k) => ({ name: FACT_PILAR_NAMES[k], value: pilarFactTotal(facturacion[k]), key: k }))
                                    .filter((d) => d.value > 0)}
                                  dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {FACT_PILAR_KEYS
                                    .filter((k) => pilarFactTotal(facturacion[k]) > 0)
                                    .map((k) => <Cell key={k} fill={FACT_PILAR_COLORS[k]} />)}
                                </Pie>
                                <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                              Sin datos suficientes para la gráfica
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader><CardTitle className="text-sm">Clientes vs ticket medio por partida</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={lineasPlanas(facturacion).map((l) => ({
                              name: l.nombre, Clientes: l.clientesEsperados || 0, Ticket: l.ticketMedio || 0,
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="€" />
                              <Tooltip />
                              <Legend />
                              <Bar yAxisId="left" dataKey="Clientes" fill="hsl(210 70% 55%)" radius={[4, 4, 0, 0]} />
                              <Bar yAxisId="right" dataKey="Ticket" fill="hsl(40 90% 55%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="ocupacion" className="mt-4">
              <OcupacionTab
                ocupacion={ocupacion}
                plazasTotales={(local?.caracteristicas?.plazasInterior ?? 0) + (local?.caracteristicas?.plazasTerraza ?? 0)}
                onChange={noop}
                readOnly
              />
            </TabsContent>

            <TabsContent value="ticket" className="mt-4">
              {(() => {
                const platos = propuesta.platos ?? [];
                const platosConPrecio = platos.filter((p) => (p.precio || 0) > 0);
                const precioMedioPlatos = platosConPrecio.length > 0
                  ? platosConPrecio.reduce((s, p) => s + p.precio, 0) / platosConPrecio.length
                  : 0;
                const precioMin = platosConPrecio.length > 0 ? Math.min(...platosConPrecio.map((p) => p.precio)) : 0;
                const precioMax = platosConPrecio.length > 0 ? Math.max(...platosConPrecio.map((p) => p.precio)) : 0;

                const rangos = [
                  { rango: "0-10€", min: 0, max: 10 },
                  { rango: "10-20€", min: 10, max: 20 },
                  { rango: "20-30€", min: 20, max: 30 },
                  { rango: "30-50€", min: 30, max: 50 },
                  { rango: "50€+", min: 50, max: Infinity },
                ];
                const distribucionPrecios = rangos.map((r) => ({
                  rango: r.rango,
                  platos: platosConPrecio.filter((p) => p.precio >= r.min && p.precio < r.max).length,
                }));

                const groupCat = new Map<string, { suma: number; count: number }>();
                platosConPrecio.forEach((p) => {
                  const cat = (p.categoria || "").trim() || "Sin categoría";
                  const cur = groupCat.get(cat) ?? { suma: 0, count: 0 };
                  groupCat.set(cat, { suma: cur.suma + p.precio, count: cur.count + 1 });
                });
                const precioMedioPorCategoria = Array.from(groupCat.entries())
                  .map(([categoria, d]) => ({
                    categoria, precioMedio: parseFloat((d.suma / d.count).toFixed(2)), numPlatos: d.count,
                  }))
                  .sort((a, b) => b.precioMedio - a.precioMedio);

                const ticketPorPilar = FACT_PILAR_KEYS
                  .map((k) => ({
                    pilar: FACT_PILAR_NAMES[k],
                    ticket: parseFloat(pilarFactTicketPonderado(facturacion[k]).toFixed(2)),
                    clientes: pilarFactClientes(facturacion[k]),
                    key: k,
                  }))
                  .filter((d) => d.clientes > 0);

                const cats = propuesta.categoriasVenta ?? [];
                const composicionTicket = cats
                  .filter((c) => (c.porcentaje || 0) > 0)
                  .map((c) => ({
                    categoria: c.nombre || "Sin nombre",
                    aporteTicket: parseFloat((ticketPond * (c.porcentaje || 0) / 100).toFixed(2)),
                    porcentaje: c.porcentaje || 0,
                  }));

                const coherencia = precioMedioPlatos > 0 && ticketPond > 0
                  ? Math.abs(ticketPond - precioMedioPlatos) / precioMedioPlatos * 100 : 0;

                return (
                  <section className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Justificación del ticket medio esperado a partir de la propuesta gastronómica.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{ticketPond.toFixed(2)}€</p><p className="text-xs text-muted-foreground">Ticket medio ponderado</p></CardContent></Card>
                      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{precioMedioPlatos.toFixed(2)}€</p><p className="text-xs text-muted-foreground">Precio medio platos destacados</p></CardContent></Card>
                      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{platosConPrecio.length > 0 ? `${precioMin.toFixed(0)}-${precioMax.toFixed(0)}€` : "—"}</p><p className="text-xs text-muted-foreground">Rango de precios platos</p></CardContent></Card>
                      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{propuesta.rangoPrecioMedio || "—"}</p><p className="text-xs text-muted-foreground">Rango medio declarado</p></CardContent></Card>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader><CardTitle className="text-sm">Distribución de precios por rangos</CardTitle></CardHeader>
                        <CardContent>
                          {platosConPrecio.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={distribucionPrecios}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="platos" fill="hsl(210 70% 55%)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Sin platos con precio</div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader><CardTitle className="text-sm">Precio medio por categoría de plato</CardTitle></CardHeader>
                        <CardContent>
                          {precioMedioPorCategoria.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={precioMedioPorCategoria} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tick={{ fontSize: 11 }} unit="€" />
                                <YAxis dataKey="categoria" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: number) => `${v}€`} />
                                <Bar dataKey="precioMedio" fill="hsl(40 90% 55%)" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Sin categorías</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader><CardTitle className="text-sm">Composición del ticket por categoría</CardTitle></CardHeader>
                        <CardContent>
                          {composicionTicket.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={composicionTicket}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="categoria" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 11 }} unit="€" />
                                <Tooltip formatter={(v: number, _n, props) => [`${v}€ (${(props as { payload?: { porcentaje?: number } })?.payload?.porcentaje}%)`, "Aporte al ticket"]} />
                                <Bar dataKey="aporteTicket" radius={[4, 4, 0, 0]}>
                                  {composicionTicket.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Sin mix definido</div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader><CardTitle className="text-sm">Ticket medio por pilar de facturación</CardTitle></CardHeader>
                        <CardContent>
                          {ticketPorPilar.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={ticketPorPilar}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="pilar" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 11 }} unit="€" />
                                <Tooltip formatter={(v: number) => `${v}€`} />
                                <Bar dataKey="ticket" radius={[4, 4, 0, 0]}>
                                  {ticketPorPilar.map((d) => <Cell key={d.key} fill={FACT_PILAR_COLORS[d.key]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Sin datos por pilar</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader><CardTitle className="text-sm">Lectura del ticket medio</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {ticketPond > 0 && precioMedioPlatos > 0 ? (
                          <p className="text-muted-foreground">
                            El ticket medio ponderado de la facturación es <strong className="text-foreground">{ticketPond.toFixed(2)}€</strong> y el precio medio de los platos destacados es <strong className="text-foreground">{precioMedioPlatos.toFixed(2)}€</strong>.
                            {coherencia < 25 ? (
                              <span className="text-green-600"> Hay coherencia entre carta y ticket esperado ({coherencia.toFixed(0)}% de desviación).</span>
                            ) : (
                              <span className="text-yellow-600"> Existe una desviación del {coherencia.toFixed(0)}% entre el precio medio de la carta y el ticket esperado.</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">Sin datos suficientes para la lectura.</p>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                );
              })()}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── COSTES ── */}
        <TabsContent value="costes">
          <Tabs value={costesTab} onValueChange={(v) => setCostesTab(v as typeof costesTab)}>
            <div className="flex items-end justify-between border-b">
              <TabsList className="h-auto justify-start gap-6 rounded-none bg-transparent p-0">
                <TabsTrigger value="pilares" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                  <Layers className="h-4 w-4" />Pilares
                </TabsTrigger>
                <TabsTrigger value="equilibrio" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                  <Target className="h-4 w-4" />Punto de equilibrio
                </TabsTrigger>
              </TabsList>
              {costesTab === "pilares" && (
                <div className="pb-2">
                  <Select value={costesPeriodo} onValueChange={(v) => setCostesPeriodo(v as Periodo)}>
                    <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TabsContent value="pilares" className="mt-4 space-y-4">
              {(() => {
                const cosFactor = PERIODO_FACTOR[costesPeriodo];
                return (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Estructura de costes por pilares</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">Despliega cada pilar para ver sus partidas.</p>
                      </CardHeader>
                      <CardContent>
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/40">
                            <th className="text-left p-3 font-medium w-[28%]">Pilar / Partida</th>
                            <th className="text-left p-3 font-medium">Coste fijo (€)</th>
                            <th className="text-left p-3 font-medium">Variable (%)</th>
                            <th className="text-left p-3 font-medium">Coste variable (estimado)</th>
                            <th className="text-left p-3 font-medium">Total</th>
                            <th className="w-10"></th>
                          </tr></thead>
                          <tbody>
                            {(["generales", "personal", "producto", "marketing"] as PilarKey[]).map((key, i) => (
                              <PilarBloqueReadOnly
                                key={key}
                                label={PILAR_NAMES[i]}
                                pilar={costes[key]}
                                ventas={ventas}
                                factor={cosFactor}
                              />
                            ))}
                            <tr className="bg-muted/30 font-semibold">
                              <td className="p-3">TOTAL</td>
                              <td className="p-3">{fmt(fijoTotal * cosFactor)}€</td>
                              <td className="p-3">{variablePctTotal.toFixed(1)}%</td>
                              <td className="p-3">{fmt(medio.varTotal * cosFactor)}€</td>
                              <td className="p-3">{fmt(medio.costeTotal * cosFactor)}€</td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader><CardTitle className="text-sm">Peso de cada pilar de coste</CardTitle></CardHeader>
                        <CardContent>
                          {medio.costeTotal > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart>
                                <Pie
                                  data={pieData.filter((d) => d.value > 0)}
                                  dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {pieData.filter((d) => d.value > 0).map((d, i) => {
                                    const idx = PILAR_NAMES.indexOf(d.name);
                                    return <Cell key={i} fill={PILAR_COLORS[idx >= 0 ? idx : i]} />;
                                  })}
                                </Pie>
                                <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">Sin costes definidos</div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader><CardTitle className="text-sm">Coste fijo vs variable por pilar</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={(["generales", "personal", "producto", "marketing"] as PilarKey[]).map((key, i) => ({
                              name: PILAR_NAMES[i],
                              Fijo: pilarFijo(costes[key]),
                              Variable: ventas * pilarVariablePct(costes[key]) / 100,
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(v: number) => `${fmt(v)}€`} />
                              <Legend />
                              <Bar dataKey="Fijo" stackId="a" fill="hsl(210 70% 55%)" />
                              <Bar dataKey="Variable" stackId="a" fill="hsl(40 90% 55%)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="equilibrio" className="mt-4 space-y-4">
              {(() => {
                const tieneCostes = fijoTotal > 0 || variablePctTotal > 0;
                const peValido = variablePctTotal < 100 && tieneCostes;
                const clientesEquilibrioMes = peValido && ticketPond > 0 ? peMensual / ticketPond : 0;
                const margenSeguridadPct = peValido && ventas > 0 ? ((ventas - peMensual) / ventas) * 100 : 0;
                const sobreEquilibrio = ventas > peMensual;
                const ventaMax = Math.max(ventas, peMensual, 1) * 1.5;
                const breakEvenData = peValido
                  ? Array.from({ length: 21 }, (_, i) => {
                      const f = (ventaMax / 20) * i;
                      return {
                        facturacion: parseFloat(f.toFixed(0)),
                        Facturación: parseFloat(f.toFixed(0)),
                        "Coste total": parseFloat((fijoTotal + (f * variablePctTotal) / 100).toFixed(0)),
                      };
                    })
                  : [];

                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{peValido ? `${fmt(peMensual)}€` : "—"}</p><p className="text-xs text-muted-foreground">Facturación equilibrio /mes</p></CardContent></Card>
                      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{peValido ? `${fmt(peAnual)}€` : "—"}</p><p className="text-xs text-muted-foreground">Facturación equilibrio /año</p></CardContent></Card>
                      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{clientesEquilibrioMes > 0 ? fmt(clientesEquilibrioMes) : "—"}</p><p className="text-xs text-muted-foreground">Clientes equilibrio /mes</p></CardContent></Card>
                      <Card><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${peValido && ventas > 0 ? (sobreEquilibrio ? "text-green-600" : "text-red-600") : ""}`}>{peValido && ventas > 0 ? `${margenSeguridadPct.toFixed(1)}%` : "—"}</p><p className="text-xs text-muted-foreground">Margen de seguridad</p></CardContent></Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Facturación vs coste total</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">El punto de equilibrio es el cruce entre las líneas.</p>
                      </CardHeader>
                      <CardContent>
                        {peValido ? (
                          <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={breakEvenData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="facturacion" tick={{ fontSize: 11 }} tickFormatter={(v) => `${fmt(v)}€`} />
                              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${fmt(v)}€`} />
                              <Tooltip formatter={(v: number) => `${fmt(v)}€`} labelFormatter={(v) => `Facturación: ${fmt(v as number)}€`} />
                              <Legend />
                              <Line type="monotone" dataKey="Facturación" stroke="hsl(210 70% 55%)" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="Coste total" stroke="hsl(0 70% 55%)" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                            {variablePctTotal >= 100 ? "El % variable supera el 100%" : "Sin costes definidos"}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-sm">Lectura del punto de equilibrio</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {peValido ? (
                          <>
                            <p className="text-muted-foreground">
                              Para cubrir todos los costes el local necesita facturar al menos <strong className="text-foreground">{fmt(peMensual)}€/mes</strong> ({fmt(peAnual)}€/año)
                              {ticketPond > 0 && (
                                <>, lo que equivale a <strong className="text-foreground">{fmt(clientesEquilibrioMes)} clientes/mes</strong> con el ticket medio actual de {ticketPond.toFixed(2)}€</>
                              )}.
                            </p>
                            {ventas > 0 && (sobreEquilibrio ? (
                              <p className="text-muted-foreground">Con la facturación estimada de <strong className="text-foreground">{fmt(ventas)}€/mes</strong>, opera <span className="text-green-600">{margenSeguridadPct.toFixed(1)}% por encima</span> del punto de equilibrio.</p>
                            ) : (
                              <p className="text-muted-foreground">Con la facturación estimada de <strong className="text-foreground">{fmt(ventas)}€/mes</strong>, opera <span className="text-red-600">{Math.abs(margenSeguridadPct).toFixed(1)}% por debajo</span> del punto de equilibrio.</p>
                            ))}
                          </>
                        ) : (
                          <p className="text-muted-foreground">Sin datos suficientes.</p>
                        )}
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── INVERSIÓN ── */}
        <TabsContent value="inversion">
          <Tabs defaultValue="procedencia">
            <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="procedencia" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                <Landmark className="h-4 w-4" />Procedencia
              </TabsTrigger>
              <TabsTrigger value="destino" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                <Target className="h-4 w-4" />Destino
              </TabsTrigger>
              <TabsTrigger value="amortizacion" className="h-10 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
                <Clock className="h-4 w-4" />Amortización
              </TabsTrigger>
            </TabsList>
            <TabsContent value="procedencia" className="mt-4">
              <ProcedenciaTab lineas={procedencia} onChange={noop} readOnly />
            </TabsContent>
            <TabsContent value="destino" className="mt-4">
              <DestinoTab lineas={destinos} onChange={noop} totalCapital={inversionTotal} readOnly />
            </TabsContent>
            <TabsContent value="amortizacion" className="mt-4">
              <AmortizacionTab lineas={amortizacion} onChange={noop} readOnly />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <footer className="text-center text-xs text-muted-foreground pt-4">
        Documento confidencial · solo lectura
      </footer>
    </div>
  );
}

/* ── Editor de datos del proyecto (read-only) ── */
function DatosEditorReadOnly({ datos }: { datos: DatosProyecto }) {
  const textFields: { key: keyof DatosProyecto; label: string }[] = [
    { key: "nombre", label: "Nombre" },
    { key: "ciudad", label: "Ciudad" },
    { key: "zona", label: "Zona" },
    { key: "afluencia", label: "Afluencia" },
    { key: "tipoLocal", label: "Tipo de local" },
    { key: "estacionalidad", label: "Estacionalidad" },
  ];
  const numberFields: { key: keyof DatosProyecto; label: string; suffix?: string }[] = [
    { key: "poblacion", label: "Población" },
    { key: "metrosCuadrados", label: "m²" },
    { key: "ventasEstimadas", label: "Ventas estimadas", suffix: "€/mes" },
    { key: "ticketMedio", label: "Ticket medio", suffix: "€" },
    { key: "clientesEstimados", label: "Clientes estimados", suffix: "/mes" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        {textFields.map((f) => (
          <div key={f.key}>
            <Label className="text-muted-foreground text-xs">{f.label}</Label>
            <Input disabled value={(datos[f.key] as string) ?? ""} />
          </div>
        ))}
        {numberFields.map((f) => (
          <div key={f.key}>
            <Label className="text-muted-foreground text-xs">
              {f.label}{f.suffix ? ` (${f.suffix})` : ""}
            </Label>
            <Input disabled type="number" value={(datos[f.key] as number) || ""} />
          </div>
        ))}
      </div>
      <div>
        <Label className="text-muted-foreground text-xs">Competencia</Label>
        <Input disabled value={datos.competencia} />
      </div>
      <div>
        <Label className="text-muted-foreground text-xs">Observaciones</Label>
        <Textarea disabled value={datos.observaciones ?? ""} rows={3} />
      </div>
    </div>
  );
}

/* ── Bloque de pilar de costes (read-only) ── */
function PilarBloqueReadOnly({
  label, pilar, ventas, factor = 1,
}: { label: string; pilar: CostePilar; ventas: number; factor?: number }) {
  const [open, setOpen] = useState(false);
  const fijo = pilarFijo(pilar);
  const variablePct = pilarVariablePct(pilar);
  const total = calcularPilar(ventas, pilar);

  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-muted/30" onClick={() => setOpen((v) => !v)}>
        <td className="p-3 font-medium">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>{label}</span>
            <span className="text-xs text-muted-foreground font-normal">
              ({pilar.partidas.length} {pilar.partidas.length === 1 ? "partida" : "partidas"})
            </span>
          </div>
        </td>
        <td className="p-3 text-muted-foreground">{fmt(fijo * factor)}€</td>
        <td className="p-3 text-muted-foreground">{variablePct.toFixed(1)}%</td>
        <td className="p-3 text-muted-foreground">{fmt((ventas * variablePct / 100) * factor)}€</td>
        <td className="p-3 font-semibold">{fmt(total * factor)}€</td>
        <td className="p-3"></td>
      </tr>
      {open && pilar.partidas.map((p) => (
        <tr key={p.id} className="border-b bg-muted/10">
          <td className="p-2 pl-10">
            <Input disabled className="h-8 text-sm" value={p.nombre} />
          </td>
          <td className="p-2"><Input disabled type="number" className="h-8 w-28 text-sm" value={p.fijo} /></td>
          <td className="p-2"><Input disabled type="number" className="h-8 w-20 text-sm" value={p.variablePct} /></td>
          <td className="p-2 text-muted-foreground">{fmt((ventas * p.variablePct / 100) * factor)}€</td>
          <td className="p-2">{fmt((p.fijo + ventas * p.variablePct / 100) * factor)}€</td>
          <td className="p-2"></td>
        </tr>
      ))}
    </>
  );
}

/* ── Bloque de pilar de facturación (read-only) ── */
function PilarFactBloqueReadOnly({
  label, pilar, ventasTotal, factor = 1,
}: { label: string; pilar: FacturacionPilar; ventasTotal: number; factor?: number }) {
  const [open, setOpen] = useState(false);
  const clientesPilar = pilarFactClientes(pilar);
  const totalPilar = pilarFactTotal(pilar);
  const ticketPilar = pilarFactTicketPonderado(pilar);
  const pctPilar = ventasTotal > 0 ? (totalPilar / ventasTotal) * 100 : 0;

  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-muted/30" onClick={() => setOpen((v) => !v)}>
        <td className="p-3 font-medium">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>{label}</span>
            <span className="text-xs text-muted-foreground font-normal">
              ({pilar.partidas.length} {pilar.partidas.length === 1 ? "partida" : "partidas"})
            </span>
          </div>
        </td>
        <td className="p-3 text-muted-foreground">{fmt(clientesPilar * factor)}</td>
        <td className="p-3 text-muted-foreground">{ticketPilar.toFixed(2)}€</td>
        <td className="p-3 text-right font-semibold">{fmt(totalPilar * factor)}€</td>
        <td className="p-3 text-right text-muted-foreground">{pctPilar.toFixed(1)}%</td>
        <td className="p-3"></td>
      </tr>
      {open && pilar.partidas.map((p) => {
        const total = (p.clientesEsperados || 0) * (p.ticketMedio || 0);
        const pct = ventasTotal > 0 ? (total / ventasTotal) * 100 : 0;
        return (
          <tr key={p.id} className="border-b bg-muted/10">
            <td className="p-2 pl-10"><Input disabled className="h-8 text-sm" value={p.nombre} /></td>
            <td className="p-2"><Input disabled type="number" className="h-8 w-32 text-sm" value={p.clientesEsperados || ""} /></td>
            <td className="p-2"><Input disabled type="number" className="h-8 w-28 text-sm" value={p.ticketMedio || ""} /></td>
            <td className="p-2 text-right font-medium">{fmt(total * factor)}€</td>
            <td className="p-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
            <td className="p-2"></td>
          </tr>
        );
      })}
    </>
  );
}
