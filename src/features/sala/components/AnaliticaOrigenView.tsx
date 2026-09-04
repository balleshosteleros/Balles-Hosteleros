"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays, CalendarRange, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getOrigenReservas,
  type AnaliticaOrigenResult,
  type CampoFecha,
  type FiltroEstado,
  type Granularidad,
} from "@/features/sala/actions/analitica-origen-actions";
import { colorOrigen, labelOrigen, type OrigenBucket } from "@/features/sala/data/origenes";
import { ESTADOS_RESERVA, ESTADO_RESERVA_LABELS } from "@/features/sala/data/reservas";
import { CapacidadGruposPanel } from "@/features/sala/components/CapacidadGruposPanel";
import { TendenciaCanalesPanel } from "@/features/sala/components/TendenciaCanalesPanel";
import { ListadoReservasPanel } from "@/features/sala/components/ListadoReservasPanel";

type PieDatum = { name: string; value: number; origen: OrigenBucket };

function PieOrigen({ datos, compacto }: { datos: PieDatum[]; compacto: boolean }) {
  // La rejilla mensual mete 6 columnas: el quesito se encoge para que la
  // tarjeta siga cabiendo entera sin recortar la tabla de debajo.
  const alto = compacto ? "h-28" : "h-36";
  if (datos.length === 0) {
    return (
      <div className={`flex ${alto} items-center justify-center text-[11px] text-muted-foreground`}>
        Sin reservas
      </div>
    );
  }
  return (
    <div className={alto}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datos}
            dataKey="value"
            nameKey="name"
            outerRadius={compacto ? 44 : 56}
            innerRadius={0}
            stroke="hsl(var(--background))"
            strokeWidth={2}
            // Con las tarjetas ya estrechas, las etiquetas alrededor del
            // quesito se pisaban entre sí: el desglose exacto está en la tabla
            // que va justo debajo, así que aquí basta el color.
            label={false}
            labelLine={false}
            isAnimationActive={false}
          >
            {datos.map((d) => (
              <Cell key={d.origen} fill={colorOrigen(d.origen)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} reservas`, name]}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TablaOrigen({
  origenes,
  total,
}: {
  origenes: AnaliticaOrigenResult["buckets"][number]["origenes"];
  total: number;
}) {
  return (
    <div className="mt-2 text-[11px]">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-0.5">
        <span className="text-muted-foreground">Origen</span>
        <span className="text-right text-muted-foreground">Res.</span>
        <span className="text-right text-muted-foreground">%</span>
        {origenes.map((o) => (
          <div key={o.origen} className="contents">
            <span
              style={{ color: colorOrigen(o.origen) }}
              className="truncate font-medium"
              title={labelOrigen(o.origen)}
            >
              {labelOrigen(o.origen)}
            </span>
            <span className="text-right font-mono" style={{ color: colorOrigen(o.origen) }}>
              {o.reservas}
            </span>
            <span className="text-right font-mono" style={{ color: colorOrigen(o.origen) }}>
              {o.porcentaje}%
            </span>
          </div>
        ))}
        <span className="border-t pt-1 font-semibold">Total</span>
        <span className="border-t pt-1 text-right font-mono font-semibold">{total}</span>
        <span className="border-t pt-1" />
      </div>
    </div>
  );
}

export function AnaliticaOrigenView() {
  const { empresaActual, empresaResuelta } = useEmpresa();
  const empresaDbId = empresaActual?.dbId ?? null;

  const [granularidad, setGranularidad] = useState<Granularidad>("semanal");
  const [campoFecha, setCampoFecha] = useState<CampoFecha>("fecha");
  const [estado, setEstado] = useState<FiltroEstado>("TODOS");
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<AnaliticaOrigenResult | null>(null);
  const [pending, startTransition] = useTransition();

  const recargar = useCallback(() => {
    startTransition(async () => {
      const result = await getOrigenReservas({ anio, campoFecha, granularidad, estado });
      setData(result);
    });
  }, [anio, campoFecha, granularidad, estado]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  // El canal de realtime NO debe re-suscribirse cada vez que cambia un filtro
  // (eso cerraría y reabriría el socket a cada clic). Se queda con la última
  // versión de `recargar` en un ref, que ya trae los filtros vigentes dentro.
  const recargarRef = useRef(recargar);
  useEffect(() => {
    recargarRef.current = recargar;
  }, [recargar]);

  // Tiempo real: cualquier alta, edición o borrado de reserva de ESTA empresa
  // repinta los totales sin que nadie recargue la página. Se refresca con un
  // pequeño retardo para que una ráfaga de cambios (varias mesas seguidas) se
  // resuelva en una sola consulta en vez de en una por fila.
  useEffect(() => {
    if (!empresaResuelta || !empresaDbId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const canal = supabase
      .channel(`analitica-origen-${empresaDbId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservas",
          filter: `empresa_id=eq.${empresaDbId}`,
        },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => recargarRef.current(), 600);
        },
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(canal);
    };
  }, [empresaDbId, empresaResuelta]);

  const anios = useMemo(() => {
    const set = new Set<number>(data?.anios ?? []);
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [data?.anios]);

  const buckets = data?.buckets ?? [];
  const esMensual = granularidad === "mensual";

  // Semanal: los 7 días en una sola fila. Mensual: 6 columnas (los 12 meses
  // caen en 2 filas exactas, sin huecos sueltos al final).
  // En pantallas estrechas ambas bajan de columnas para no ilegibilizar el texto.
  const gridClass = esMensual
    ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    : "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7";

  const etiquetaEstado =
    estado === "TODOS" ? "Todos los estados" : ESTADO_RESERVA_LABELS[estado];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header — granularidad + filtros */}
      <Tabs value={granularidad} onValueChange={(v) => setGranularidad(v as Granularidad)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="semanal">Semanal</TabsTrigger>
            <TabsTrigger value="mensual">Mensual</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setCampoFecha("fecha")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                  campoFecha === "fecha"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Agrupar por el día para el que reservó el cliente"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Día reservado
              </button>
              <button
                type="button"
                onClick={() => setCampoFecha("created_at")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                  campoFecha === "created_at"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Agrupar por el día en que se registró la reserva"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Fecha creación
              </button>
            </div>
            <Select value={estado} onValueChange={(v) => setEstado(v as FiltroEstado)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los estados</SelectItem>
                {ESTADOS_RESERVA.map((e) => (
                  <SelectItem key={e} value={e}>{ESTADO_RESERVA_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anios.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={recargar}
              disabled={pending}
              title="Recargar"
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </Tabs>

      <div className="text-center">
        <h2 className="text-lg font-semibold">Origen nº Reservas</h2>
        <p className="text-xs text-muted-foreground">
          {campoFecha === "fecha" ? "Por día reservado" : "Por fecha de creación"} · {anio} ·{" "}
          {etiquetaEstado} · Total {data?.total ?? 0}
        </p>
      </div>

      {/* Rejilla de quesitos */}
      <div className={gridClass}>
        {buckets.map((b) => {
          const datos: PieDatum[] = b.origenes.map((o) => ({
            name: labelOrigen(o.origen),
            value: o.reservas,
            origen: o.origen,
          }));
          return (
            <Card key={b.key} className="flex flex-col p-2.5">
              <PieOrigen datos={datos} compacto={esMensual} />
              <div className="mt-1 text-center text-xs font-semibold">{b.label}</div>
              <TablaOrigen origenes={b.origenes} total={b.total} />
            </Card>
          );
        })}
      </div>

      {/* Tendencia por canal: el eje aquí es el TIEMPO CORRIDO (2022→hoy), no
          los meses de un año comparados entre sí como en la rejilla de arriba.
          Responde a otra pregunta: qué canal sube y cuál baja. */}
      <div className="border-t pt-5 mt-1">
        <TendenciaCanalesPanel campoFecha={campoFecha} estado={estado} />
      </div>

      {/* Capacidad por tamaño de grupo: independiente de los filtros de arriba,
          se consulta por día porque responde a "¿me queda hueco hoy?". */}
      <div className="border-t pt-5 mt-1">
        <CapacidadGruposPanel />
      </div>

      {/* Listado completo de reservas. Comparte el año y el campo de fecha de
          los quesitos: lo que se ve arriba en gráfica se puede leer aquí fila
          a fila, filtrar y exportar. */}
      <div className="border-t pt-5 mt-1">
        <ListadoReservasPanel
          desde={`${anio}-01-01`}
          hasta={`${anio}-12-31`}
          campoFecha={campoFecha}
          periodoLabel={`${campoFecha === "fecha" ? "Por día reservado" : "Por fecha de creación"} · ${anio}`}
        />
      </div>
    </div>
  );
}
