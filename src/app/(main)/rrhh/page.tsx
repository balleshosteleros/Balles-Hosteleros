"use client";

import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getEmpleadosPorEmpresa } from "@/features/rrhh/data/rrhh";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, UserMinus, DollarSign, AlertTriangle, FileText, TrendingUp, TrendingDown } from "lucide-react";

interface KPI {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  trend?: { value: string; positive: boolean };
}

function getKPIs(totalEmpleados: number, empresaId: string): KPI[] {
  const isHabana = empresaId === "habana";
  return [
    { label: "Volumen de rotación", value: isHabana ? "12%" : "8%", subtitle: "Últimos 12 meses", icon: TrendingUp, trend: { value: isHabana ? "+2% vs anterior" : "-1% vs anterior", positive: !isHabana } },
    { label: "Onboarding", value: isHabana ? "3" : "1", subtitle: "Incorporaciones activas", icon: UserPlus, trend: { value: isHabana ? "2 esta semana" : "1 esta semana", positive: true } },
    { label: "Offboarding", value: isHabana ? "1" : "0", subtitle: "Salidas en curso", icon: UserMinus, trend: { value: isHabana ? "1 pendiente" : "Sin salidas", positive: !isHabana } },
    { label: "Salarios totales", value: isHabana ? "€38.500" : "€27.200", subtitle: "Nómina mensual bruta", icon: DollarSign, trend: { value: isHabana ? "+€1.200 vs mes ant." : "Sin variación", positive: false } },
    { label: "Incidencias de fichajes", value: isHabana ? "7" : "3", subtitle: "Pendientes de resolver", icon: AlertTriangle, trend: { value: isHabana ? "4 nuevas hoy" : "1 nueva hoy", positive: false } },
    { label: "Documentos pend. firma", value: isHabana ? "5" : "2", subtitle: "Contratos y anexos", icon: FileText, trend: { value: isHabana ? "2 urgentes" : "Sin urgentes", positive: false } },
  ];
}

export default function RRHHPage() {
  const { empresaActual } = useEmpresa();
  const empleados = useMemo(() => getEmpleadosPorEmpresa(empresaActual.id), [empresaActual.id]);
  const kpis = useMemo(() => getKPIs(empleados.length, empresaActual.id), [empleados.length, empresaActual.id]);

  const porEstado = useMemo(() => {
    const map: Record<string, number> = {};
    empleados.forEach((e) => { map[e.estado] = (map[e.estado] || 0) + 1; });
    return map;
  }, [empleados]);

  const porDepto = useMemo(() => {
    const map: Record<string, number> = {};
    empleados.forEach((e) => { map[e.departamento] = (map[e.departamento] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [empleados]);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
              {kpi.trend && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${kpi.trend.positive ? "text-emerald-500" : "text-amber-500"}`}>
                  {kpi.trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{kpi.trend.value}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Empleados por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(porEstado).map(([estado, count]) => (
              <div key={estado} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${estado === "trabajando" ? "bg-emerald-500" : estado === "fuera" ? "bg-muted-foreground/40" : estado === "descanso" ? "bg-amber-400" : estado === "ausente" ? "bg-destructive" : "bg-sky-400"}`} />
                  <span className="text-sm text-foreground capitalize">{estado}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Empleados por departamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {porDepto.map(([depto, count]) => (
              <div key={depto} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{depto}</span>
                <span className="text-sm font-semibold text-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
