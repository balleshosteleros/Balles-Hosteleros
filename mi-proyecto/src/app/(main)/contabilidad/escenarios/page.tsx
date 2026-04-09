"use client";

import { useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, BarChart3, Table2, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_ESCENARIO } from "@/features/contabilidad/data/contabilidad";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Cell } from "recharts";

const TABS = [{ id: "ESCENARIOS", label: "Escenarios" }, { id: "SALDOS", label: "Saldos" }];

const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 0 }) + " €";

export default function EscenariosPage() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("ESCENARIOS");
  const data = SAMPLE_ESCENARIO;

  const saldoInicial = 16845;
  const totalEntradas = data.reduce((s, d) => s + d.entradas, 0);
  const totalSalidas = data.reduce((s, d) => s + d.salidas, 0);
  const resultado = totalEntradas - totalSalidas;
  const saldoFinal = data[data.length - 1]?.saldo ?? 0;

  const kpis = [
    { label: "Saldo inicial", value: fmt(saldoInicial), icon: Wallet, color: "text-muted-foreground" },
    { label: "Entradas", value: fmt(totalEntradas), icon: ArrowUpRight, color: "text-emerald-500" },
    { label: "Salidas", value: fmt(-totalSalidas), icon: ArrowDownRight, color: "text-red-500" },
    { label: "Resultado", value: fmt(resultado), icon: TrendingUp, color: resultado >= 0 ? "text-emerald-500" : "text-red-500" },
    { label: "Saldo final", value: fmt(saldoFinal), icon: Landmark, color: "text-foreground" },
  ];

  const chartData = data.map(d => ({
    name: d.mes.split(" ")[0].slice(0, 3),
    entradas: d.entradas,
    salidas: -d.salidas,
    saldo: d.saldo,
    actual: d.actual,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-auto">
      {/* Tabs */}
      <div className="border-b px-6 pt-4 flex items-center gap-6">
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>)}
      </div>

      <div className="p-6 space-y-6">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select defaultValue="cuadre"><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cuadre">Cuadre Dirección</SelectItem><SelectItem value="proyeccion">Proyección base</SelectItem></SelectContent></Select>
          <span className="text-sm font-semibold">Abr 2026</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8"><Settings2 className="h-4 w-4" /></Button>
            <Select defaultValue="mensual"><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mensual">Mensual</SelectItem><SelectItem value="trimestral">Trimestral</SelectItem></SelectContent></Select>
            <Button variant="outline" size="sm" className="text-xs">📅 2026-01 — 2026-12</Button>
            <Button variant="outline" size="icon" className="h-8 w-8"><BarChart3 className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8"><Table2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* KPIs + Chart */}
        <div className="flex gap-6">
          <div className="space-y-3 w-[160px] shrink-0">
            {kpis.map(k => (
              <Card key={k.label} className="border-0 shadow-none bg-muted/30">
                <CardContent className="p-3 flex items-center gap-2">
                  <k.icon className={cn("h-4 w-4 shrink-0", k.color)} />
                  <div>
                    <p className="text-[10px] text-muted-foreground">{k.label}</p>
                    <p className={cn("text-sm font-bold font-mono", k.color)}>{k.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => fmt(Math.abs(v))} />
                <Bar dataKey="entradas" stackId="a" fill="hsl(160 60% 45%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="salidas" stackId="a" fill="hsl(0 70% 55%)" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detail table */}
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="py-2 pl-4 text-left font-medium">Concepto</th>
              {data.map(d => <th key={d.mes} className={cn("py-2 text-right font-medium px-3", d.actual && "bg-primary/5")}>{d.mes.split(" ")[0].slice(0, 3)}</th>)}
            </tr></thead>
            <tbody>
              <tr className="border-b bg-emerald-500/5"><td className="py-2 pl-4 font-semibold text-emerald-600">↗ Entradas</td>{data.map(d => <td key={d.mes} className={cn("py-2 text-right px-3 font-mono", d.actual && "bg-primary/5")}>{d.entradas.toLocaleString("es-ES")}</td>)}</tr>
              <tr className="border-b bg-red-500/5"><td className="py-2 pl-4 font-semibold text-red-500">↙ Salidas</td>{data.map(d => <td key={d.mes} className={cn("py-2 text-right px-3 font-mono", d.actual && "bg-primary/5")}>{d.salidas.toLocaleString("es-ES")}</td>)}</tr>
              <tr className="border-b"><td className="py-2 pl-4 font-bold">Saldo</td>{data.map(d => <td key={d.mes} className={cn("py-2 text-right px-3 font-mono font-semibold", d.actual && "bg-primary/5")}>{d.saldo.toLocaleString("es-ES")}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
