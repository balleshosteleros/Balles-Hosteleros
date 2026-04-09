"use client";

import { useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getResumenFormacion, getProgresoPorEmpresa, getEstadisticasMensuales, PORTAL_FORMATIVO_URL } from "@/features/rrhh/data/formacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { GraduationCap, ExternalLink, Users, Award, Video, TrendingUp, BookOpen, CheckCircle2, XCircle, BarChart3, Target } from "lucide-react";

const ESTADO_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  en_curso: { label: "En curso", variant: "default" },
  completado: { label: "Completado", variant: "secondary" },
  bloqueado: { label: "Bloqueado", variant: "destructive" },
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

export default function RRHHFormacionPage() {
  const { empresaActual } = useEmpresa();
  const resumen = useMemo(() => getResumenFormacion(empresaActual.id), [empresaActual.id]);
  const progresos = useMemo(() => getProgresoPorEmpresa(empresaActual.id), [empresaActual.id]);
  const stats = useMemo(() => getEstadisticasMensuales(empresaActual.id), [empresaActual.id]);

  const pieData = [
    { name: "Aprobadas", value: resumen.aprobadas },
    { name: "Suspendidas", value: resumen.suspendidas },
  ];

  const chartConfig = {
    empleadosFormados: { label: "Empleados formados", color: "hsl(var(--primary))" },
    notaMedia: { label: "Nota media", color: "hsl(var(--chart-2))" },
  };

  const puestoChartConfig = {
    enFormacion: { label: "En formación", color: "hsl(var(--primary))" },
    completados: { label: "Completados", color: "hsl(var(--chart-2))" },
    bloqueados: { label: "Bloqueados", color: "hsl(var(--destructive))" },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Formación</h1>
            <p className="text-sm text-muted-foreground">Panel de control y seguimiento del portal formativo externo</p>
          </div>
        </div>
        <Button onClick={() => window.open(`${PORTAL_FORMATIVO_URL}/${empresaActual.id}`, "_blank")} className="gap-2">
          <ExternalLink className="h-4 w-4" />Acceder al portal formativo
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm text-foreground">El portal formativo es un <strong>software independiente</strong> conectado al SaaS principal. Los empleados acceden con las mismas credenciales.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Personas en formación", value: resumen.enCurso, icon: Users, sub: "activas ahora" },
          { label: "Formación completada", value: resumen.completados, icon: CheckCircle2, sub: "finalizaron" },
          { label: "Bloqueados", value: resumen.bloqueados, icon: XCircle, sub: "no alcanzan nota" },
          { label: "Nota media", value: `${resumen.notaMedia}%`, icon: Award, sub: "de evaluaciones" },
          { label: "Tasa de aprobado", value: `${resumen.tasaAprobado}%`, icon: Target, sub: `${resumen.aprobadas}/${resumen.totalEvaluaciones}` },
          { label: "Vídeos subidos", value: resumen.totalVideos, icon: Video, sub: `${resumen.videosGenericos} gen. / ${resumen.videosEspecificos} esp.` },
        ].map((kpi) => (
          <Card key={kpi.label} className="border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border bg-card">
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />Avance medio global</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold text-foreground">{resumen.avanceMedio}%</div>
            <Progress value={resumen.avanceMedio} className="h-3" />
            <p className="text-xs text-muted-foreground">{resumen.totalPuestos} puestos con ruta formativa</p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Aprobados vs Suspendidos</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            <ChartContainer config={{}} className="h-[180px] w-[180px]">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            <div className="ml-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" /><span>Aprobadas: {resumen.aprobadas}</span></div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-destructive" /><span>Suspendidas: {resumen.suspendidas}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Desglose de vídeos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Genéricos</span><span className="font-semibold">{resumen.videosGenericos}</span></div>
              <Progress value={(resumen.videosGenericos / Math.max(resumen.totalVideos, 1)) * 100} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Específicos</span><span className="font-semibold">{resumen.videosEspecificos}</span></div>
              <Progress value={(resumen.videosEspecificos / Math.max(resumen.totalVideos, 1)) * 100} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">Total: {resumen.totalVideos} vídeos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border bg-card">
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Evolución mensual</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="empleadosFormados" stroke="var(--color-empleadosFormados)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Estado por puesto</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={puestoChartConfig} className="h-[250px] w-full">
              <BarChart data={resumen.porPuesto}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="puesto" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="enFormacion" fill="var(--color-enFormacion)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completados" fill="var(--color-completados)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bloqueados" fill="var(--color-bloqueados)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border bg-card">
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4" />Métricas por puesto</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Puesto</TableHead><TableHead className="text-center">En formación</TableHead>
                <TableHead className="text-center">Completados</TableHead><TableHead className="text-center">Bloqueados</TableHead>
                <TableHead className="text-center">Nota media</TableHead><TableHead className="text-center">Avance</TableHead>
                <TableHead className="text-center">% Finalización</TableHead><TableHead className="text-center">Vídeos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumen.porPuesto.map((p) => (
                <TableRow key={p.puesto}>
                  <TableCell className="font-medium">{p.puesto}</TableCell>
                  <TableCell className="text-center">{p.enFormacion}</TableCell>
                  <TableCell className="text-center">{p.completados}</TableCell>
                  <TableCell className="text-center">{p.bloqueados}</TableCell>
                  <TableCell className="text-center">{p.notaMedia}%</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <Progress value={p.avanceMedio} className="h-2 w-16" />
                      <span className="text-xs">{p.avanceMedio}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{p.finalizacion}%</TableCell>
                  <TableCell className="text-center">{p.videosPuesto}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border bg-card">
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />Seguimiento individual</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead><TableHead>Puesto</TableHead><TableHead className="text-center">Módulos</TableHead>
                <TableHead className="text-center">Vídeos</TableHead><TableHead className="text-center">Nota</TableHead>
                <TableHead className="text-center">Avance</TableHead><TableHead className="text-center">Estado</TableHead>
                <TableHead>Último acceso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {progresos.map((p) => {
                const b = ESTADO_BADGE[p.estado];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.empleadoNombre}</TableCell>
                    <TableCell className="text-muted-foreground">{p.puestoNombre}</TableCell>
                    <TableCell className="text-center">{p.modulosCompletados}/{p.totalModulos}</TableCell>
                    <TableCell className="text-center">{p.videosVistos}/{p.totalVideos}</TableCell>
                    <TableCell className="text-center font-semibold">{p.notaMedia}%</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <Progress value={p.porcentajeAvance} className="h-2 w-16" />
                        <span className="text-xs">{p.porcentajeAvance}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{b && <Badge variant={b.variant}>{b.label}</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.ultimoAcceso}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
