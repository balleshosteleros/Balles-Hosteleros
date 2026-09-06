"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Clock,
  Coins,
  Percent,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatEur, formatNumero, formatPorcentaje } from "@/shared/lib/numero";
import { useCalendarRange } from "@/shared/components/calendar/calendar-range";
import { CalendarRangeNav, CalendarRangeToggle } from "@/shared/components/calendar/CalendarRangeToggle";
import { getRatiosDashboard } from "@/features/gerencia/actions/ratios-actions";
import {
  ETIQUETA_AREA,
  ETIQUETA_AUSENCIA,
  MODOS_RATIOS,
  type FilaRatio,
  type ModoCoste,
  type PeriodoRatios,
  type RatiosDashboard,
} from "@/features/gerencia/types/ratios";
import { Button } from "@/components/ui/button";

/** Fecha a "AAAA-MM-DD" leyendo el día del calendario, sin pasar por UTC. */
function claveDia(d: Date): string {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${a}-${m}-${dia}`;
}

const fmtHoras = (n: number) => `${formatNumero(n, { min: 0, max: 1 })} h`;

/** Un porcentaje de coste sano ronda el 30 %; por encima del 40 % es alarma. */
function colorRatio(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct > 40) return "text-red-600";
  if (pct > 30) return "text-amber-600";
  return "text-emerald-600";
}

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
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Tabla de agrupación: vale igual para áreas, departamentos y puestos. */
function TablaAgrupada({
  filas,
  titulo,
  mostrarDepartamento,
  cargando,
}: {
  filas: FilaRatio[];
  titulo: string;
  mostrarDepartamento?: boolean;
  cargando: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{titulo}</TableHead>
          {mostrarDepartamento && <TableHead>Departamento</TableHead>}
          <TableHead>Área</TableHead>
          <TableHead className="text-right">Personas</TableHead>
          <TableHead className="text-right">Horas</TableHead>
          <TableHead className="text-right">Coste</TableHead>
          <TableHead className="text-right">% del coste</TableHead>
          <TableHead className="text-right">% s/ facturación</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={mostrarDepartamento ? 8 : 7} className="py-8 text-center text-muted-foreground">
              {cargando ? <LoadingSpinner /> : "No hay horas fichadas en este periodo"}
            </TableCell>
          </TableRow>
        ) : (
          filas.map((f) => (
            <TableRow key={f.clave}>
              <TableCell className="font-medium">{f.nombre}</TableCell>
              {mostrarDepartamento && (
                <TableCell className="text-muted-foreground">{f.departamento ?? "—"}</TableCell>
              )}
              <TableCell>
                {f.area ? (
                  <Badge variant="outline" className="font-normal">
                    {ETIQUETA_AREA[f.area]}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{f.personas}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtHoras(f.horas)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatEur(f.coste)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatPorcentaje(f.pctSobreCoste, { max: 1 })}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${colorRatio(f.pctSobreFacturacion)}`}>
                {f.pctSobreFacturacion > 0 ? formatPorcentaje(f.pctSobreFacturacion, { max: 1 }) : "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function RatiosView() {
  const { empresaActual } = useEmpresa();
  const { mode, setMode, range, label, prev, next, goToToday, isToday } = useCalendarRange("MENSUAL");
  const [datos, setDatos] = useState<RatiosDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  // Pagos reales cuando el mes está cerrado; estimación para ver cómo va el actual.
  const [modo, setModo] = useState<ModoCoste>("ESTIMACION");
  const [, startTransition] = useTransition();

  const desde = claveDia(range.start);
  const hasta = claveDia(range.end);

  // Dentro del rango elegido, el detalle se enseña un escalón por debajo: al ver
  // un mes interesan sus días, y al ver un año, sus meses.
  const periodoSerie: PeriodoRatios = useMemo(() => {
    switch (mode) {
      case "DIARIO":
      case "SEMANAL":
        return "DIARIO";
      case "MENSUAL":
        return "DIARIO";
      case "TRIMESTRAL":
        return "SEMANAL";
      default:
        return "MENSUAL";
    }
  }, [mode]);

  const cargar = useCallback(() => {
    startTransition(async () => {
      setCargando(true);
      const res = await getRatiosDashboard(desde, hasta, periodoSerie, modo);
      setDatos(res.ok ? res.data : null);
      setCargando(false);
    });
  }, [desde, hasta, periodoSerie, modo]);

  // `empresaActual.id` entra en las dependencias a propósito: al cambiar de
  // empresa hay que volver a pedir los datos, no quedarse con los anteriores.
  useEffect(() => {
    cargar();
  }, [cargar, empresaActual?.id]);

  const resumen = datos?.resumen;
  const cobertura = datos?.cobertura;

  return (
    <div className="space-y-5 p-4 pb-28 md:p-6">
      {/* Periodo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CalendarRangeNav
          label={label}
          onPrev={prev}
          onNext={next}
          onToday={goToToday}
          isToday={isToday}
        />
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <Button
              size="sm"
              variant={modo === "NOMINA" ? "default" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setModo("NOMINA")}
            >
              Pagos reales
            </Button>
            <Button
              size="sm"
              variant={modo === "ESTIMACION" ? "default" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setModo("ESTIMACION")}
            >
              Estimación
            </Button>
          </div>
          <CalendarRangeToggle mode={mode} onChange={setMode} modes={MODOS_RATIOS} />
        </div>
      </div>

      {/* Qué se está viendo, y por qué. */}
      {datos?.modoSolicitado === "NOMINA" && datos.modo === "ESTIMACION" && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Todavía no hay pagos cargados de este periodo, así que se muestra la estimación. Los
            pagos reales aparecen cuando el mes termina y la gestoría los sube.
          </p>
        </div>
      )}
      {datos?.modo === "NOMINA" && (
        <p className="text-xs text-muted-foreground">
          Coste tomado de las nóminas reales más su Seguridad Social. Las horas fichadas se usan
          solo para repartirlo entre áreas, departamentos y puestos.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          icon={Clock}
          label="Horas fichadas"
          value={fmtHoras(resumen?.horas ?? 0)}
          hint={`${resumen?.personas ?? 0} ${(resumen?.personas ?? 0) === 1 ? "persona" : "personas"}`}
        />
        <Kpi
          icon={Coins}
          label="Coste de personal"
          value={formatEur(resumen?.costeTotal ?? 0)}
          hint={
            (resumen?.costeAusencias ?? 0) > 0
              ? `${formatEur(resumen?.coste ?? 0)} trabajado + ${formatEur(resumen?.costeAusencias ?? 0)} de ausencias`
              : "con Seguridad Social de empresa"
          }
        />
        <Kpi
          icon={TrendingUp}
          label="Facturación"
          value={formatEur(resumen?.facturacion ?? 0)}
          accent="text-emerald-600"
        />
        <Kpi
          icon={Percent}
          label="Coste de personal"
          value={
            resumen?.pctCostePersonal !== null && resumen?.pctCostePersonal !== undefined
              ? formatPorcentaje(resumen.pctCostePersonal, { max: 1 })
              : "Sin ventas"
          }
          hint="sobre la facturación"
          accent={colorRatio(resumen?.pctCostePersonal ?? null)}
        />
        <Kpi
          icon={Coins}
          label="Coste por hora"
          value={formatEur(resumen?.costeHoraMedio ?? 0)}
          hint={`media, con ${formatPorcentaje(resumen?.seguridadSocialPct ?? 0, { max: 1 })} de Seg. Social`}
        />
        <Kpi icon={Users} label="Personas" value={String(resumen?.personas ?? 0)} hint="han fichado" />
      </div>

      {/* Cobertura: si falta el precio de alguna hora, el coste sale corto y se dice. */}
      {cobertura && cobertura.empleadosSinCoste > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            El coste está calculado de menos: {cobertura.empleadosSinCoste}{" "}
            {cobertura.empleadosSinCoste === 1 ? "persona no tiene" : "personas no tienen"} salario dado de alta
            y {cobertura.empleadosSinCoste === 1 ? "ha" : "han"} fichado {fmtHoras(cobertura.horasSinCoste)} en
            este periodo ({cobertura.nombresSinCoste.join(", ")}). Sus horas cuentan, pero su coste no.
          </p>
        </div>
      )}

      {cobertura && cobertura.empleadosConSalarioDePuesto > 0 && (
        <p className="text-xs text-muted-foreground">
          {cobertura.empleadosConSalarioDePuesto}{" "}
          {cobertura.empleadosConSalarioDePuesto === 1
            ? "persona usa el salario de su puesto"
            : "personas usan el salario de su puesto"}{" "}
          porque no {cobertura.empleadosConSalarioDePuesto === 1 ? "tiene" : "tienen"} condiciones propias en su
          ficha.
        </p>
      )}

      {/* Cómo puede acabar el mes si sigue este ritmo. */}
      {datos?.proyeccion && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Si el mes sigue así</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Facturación a fin de mes</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">
                {formatEur(datos.proyeccion.facturacionProyectada)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatEur(datos.proyeccion.facturacionReal)} llevados +{" "}
                {formatEur(datos.proyeccion.facturacionEstimadaRestante)} por venir
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Coste de personal</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">
                {formatEur(datos.proyeccion.costeProyectado)}
              </p>
              <p className="text-[11px] text-muted-foreground">al ritmo que lleva</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">% coste de personal</p>
              <p className={`mt-0.5 text-xl font-bold tabular-nums ${colorRatio(datos.proyeccion.pctProyectado)}`}>
                {datos.proyeccion.pctProyectado !== null
                  ? formatPorcentaje(datos.proyeccion.pctProyectado, { max: 1 })
                  : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">previsto a fin de mes</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Días</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">
                {datos.proyeccion.diasTranscurridos} / {datos.proyeccion.diasTranscurridos + datos.proyeccion.diasRestantes}
              </p>
              <p className="text-[11px] text-muted-foreground">
                quedan {datos.proyeccion.diasRestantes}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Lo que falta se calcula con lo que suele dar cada día de la semana —un sábado no factura
            como un lunes—, mirando los {datos.proyeccion.diasHistorico} días anteriores. Es una
            previsión: sirve para hacerse una idea, no para cerrar cuentas.
          </p>
        </div>
      )}

      <Tabs defaultValue="evolucion">
        <TabsList>
          <TabsTrigger value="evolucion">Evolución</TabsTrigger>
          <TabsTrigger value="areas">Por área</TabsTrigger>
          <TabsTrigger value="departamentos">Por departamento</TabsTrigger>
          <TabsTrigger value="puestos">Por puesto</TabsTrigger>
          <TabsTrigger value="ausencias">Ausencias</TabsTrigger>
        </TabsList>

        <TabsContent value="evolucion" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Trabajado</TableHead>
                <TableHead className="text-right">Ausencias</TableHead>
                <TableHead className="text-right">Coste total</TableHead>
                <TableHead className="text-right">Facturación</TableHead>
                <TableHead className="text-right">% coste de personal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(datos?.serie.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {cargando ? <LoadingSpinner /> : "No hay datos en este periodo"}
                  </TableCell>
                </TableRow>
              ) : (
                datos!.serie.map((p) => (
                  <TableRow key={p.clave}>
                    <TableCell className="font-medium">{p.etiqueta}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHoras(p.horas)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEur(p.coste)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {p.costeAusencias > 0 ? formatEur(p.costeAusencias) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatEur(p.costeTotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEur(p.facturacion)}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${colorRatio(p.pctCostePersonal)}`}>
                      {p.pctCostePersonal !== null ? formatPorcentaje(p.pctCostePersonal, { max: 1 }) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="areas" className="mt-4">
          <TablaAgrupada filas={datos?.porArea ?? []} titulo="Área" cargando={cargando} />
        </TabsContent>

        <TabsContent value="departamentos" className="mt-4">
          <TablaAgrupada filas={datos?.porDepartamento ?? []} titulo="Departamento" cargando={cargando} />
        </TabsContent>

        <TabsContent value="puestos" className="mt-4">
          <TablaAgrupada
            filas={datos?.porPuesto ?? []}
            titulo="Puesto"
            mostrarDepartamento
            cargando={cargando}
          />
        </TabsContent>

        <TabsContent value="ausencias" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Días que se pagan sin fichar. Cada día vale el sueldo del mes repartido entre 30 —más la
            Seguridad Social de empresa— y cuenta en las fechas en que cada persona lo disfruta.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Personas</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Coste</TableHead>
                <TableHead className="text-right">Coste por día</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(datos?.ausencias.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {cargando ? <LoadingSpinner /> : "Nadie ha tenido ausencias en este periodo"}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {datos!.ausencias.map((a) => (
                    <TableRow key={a.tipo}>
                      <TableCell className="font-medium">{ETIQUETA_AUSENCIA[a.tipo]}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.personas}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.dias}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatEur(a.coste)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {a.dias > 0 ? formatEur(a.coste / a.dias) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold tabular-nums">
                      {datos!.ausencias.reduce((s, a) => s + a.dias, 0)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatEur(resumen?.costeAusencias ?? 0)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
