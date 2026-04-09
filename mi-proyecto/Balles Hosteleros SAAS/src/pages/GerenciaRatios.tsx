import { useState, useMemo } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getRatiosPorEmpresa, calcularResumenArea } from "@/data/ratios";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, TrendingUp, Clock, DollarSign, Users, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import RatiosTablaPersonal from "@/components/ratios/RatiosTablaPersonal";
import RatiosPrevisiones, { RecuadroMetodologia } from "@/components/ratios/RatiosPrevisiones";

function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDec(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtPct(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function KpiCard({ label, value, icon, sub, highlight }: { label: string; value: string; icon?: React.ReactNode; sub?: string; highlight?: "ok" | "warning" | "danger" }) {
  const border = highlight === "danger" ? "border-destructive/40" : highlight === "warning" ? "border-amber-400/40" : "border-border";
  return (
    <Card className={cn("border", border)}>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function GerenciaRatios() {
  const { empresaActual } = useEmpresa();
  const [vista, setVista] = useState<"semana" | "dia" | "mes" | "trimestre">("semana");
  const [tab, setTab] = useState("tabla");

  const semana = useMemo(() => getRatiosPorEmpresa(empresaActual.id), [empresaActual.id]);
  const operativa = useMemo(() => calcularResumenArea(semana.filas, "operativa"), [semana]);
  const administrativa = useMemo(() => calcularResumenArea(semana.filas, "administrativa"), [semana]);

  const costeTotal = operativa.totalCoste + administrativa.totalCoste;
  const horasTotal = operativa.totalHoras + administrativa.totalHoras;
  const ratioGlobal = semana.facturacionTotal > 0 ? (costeTotal / semana.facturacionTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">RATIOS DE PERSONAL</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control de costes, previsiones y horas · {semana.fechaInicio} — {semana.fechaFin}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium text-muted-foreground">Semana actual</span>
          <Button variant="outline" size="icon"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Vista temporal */}
      <div className="flex items-center gap-4">
        <Tabs value={vista} onValueChange={(v) => setVista(v as typeof vista)}>
          <TabsList>
            <TabsTrigger value="dia">Día</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mes</TabsTrigger>
            <TabsTrigger value="trimestre">Trimestre</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Coste total personal" value={`${fmt(costeTotal)} €`} icon={<DollarSign className="h-4 w-4" />} />
        <KpiCard label="Horas totales" value={`${fmtDec(horasTotal)} h`} icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Facturación" value={`${fmt(semana.facturacionTotal)} €`} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Ratio RRHH" value={fmtPct(ratioGlobal)} icon={<Users className="h-4 w-4" />} highlight={ratioGlobal > 40 ? "danger" : ratioGlobal > 30 ? "warning" : "ok"} />
        <KpiCard label="Reservas semana" value={`${fmt(semana.reservasRealesTotal)}`} icon={<CalendarDays className="h-4 w-4" />} sub={`Previstas: ${fmt(semana.previsionReservasTotal)}`} />
        <KpiCard label="Fact. prevista" value={`${fmt(semana.previsionFacturacionTotal)} €`} icon={<TrendingUp className="h-4 w-4" />} sub={`Tendencia: ${semana.tendencia.descripcion}`} />
      </div>

      {/* Tabs de contenido */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tabla">Tabla de personal</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación / Personal</TabsTrigger>
          <TabsTrigger value="reservas">Reservas / Personal</TabsTrigger>
          <TabsTrigger value="metodologia">Metodología</TabsTrigger>
        </TabsList>

        <TabsContent value="tabla" className="mt-4">
          <RatiosTablaPersonal semana={semana} />
        </TabsContent>

        <TabsContent value="facturacion" className="mt-4">
          <RatiosPrevisiones semana={semana} tipo="facturacion" />
        </TabsContent>

        <TabsContent value="reservas" className="mt-4">
          <RatiosPrevisiones semana={semana} tipo="reservas" />
        </TabsContent>

        <TabsContent value="metodologia" className="mt-4">
          <RecuadroMetodologia semana={semana} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
