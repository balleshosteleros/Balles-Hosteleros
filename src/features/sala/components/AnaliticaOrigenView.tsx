"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays, CalendarRange, RefreshCw } from "lucide-react";
import {
  getOrigenReservas,
  type AnaliticaOrigenResult,
  type CampoFecha,
  type Granularidad,
} from "@/features/sala/actions/analitica-origen-actions";
import { ORIGEN_COLORS, ORIGEN_LABELS, type OrigenBucket } from "@/features/sala/data/origenes";

const MESES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type PieDatum = { name: string; value: number; origen: OrigenBucket };

function PieOrigen({ datos }: { datos: PieDatum[] }) {
  if (datos.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
        Sin reservas
      </div>
    );
  }
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datos}
            dataKey="value"
            nameKey="name"
            outerRadius={70}
            innerRadius={0}
            stroke="hsl(var(--background))"
            strokeWidth={2}
            label={({ percent, name }) =>
              percent && percent >= 0.05 ? `${name} ${Math.round(percent * 100)}%` : ""
            }
            labelLine={false}
          >
            {datos.map((d) => (
              <Cell key={d.origen} fill={ORIGEN_COLORS[d.origen]} />
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
    <div className="mt-2 text-xs">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 px-1">
        <span className="text-muted-foreground">Origen</span>
        <span className="text-right text-muted-foreground">Reservas</span>
        <span className="text-right text-muted-foreground">%</span>
        {origenes.map((o) => (
          <div key={o.origen} className="contents">
            <span style={{ color: ORIGEN_COLORS[o.origen] }} className="font-medium">
              {ORIGEN_LABELS[o.origen]}
            </span>
            <span className="text-right font-mono" style={{ color: ORIGEN_COLORS[o.origen] }}>
              {o.reservas}
            </span>
            <span className="text-right font-mono" style={{ color: ORIGEN_COLORS[o.origen] }}>
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
  const [granularidad, setGranularidad] = useState<Granularidad>("semanal");
  const [campoFecha, setCampoFecha] = useState<CampoFecha>("fecha");
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [data, setData] = useState<AnaliticaOrigenResult | null>(null);
  const [pending, startTransition] = useTransition();

  const recargar = () => {
    startTransition(async () => {
      const result = await getOrigenReservas({
        anio,
        campoFecha,
        granularidad,
        mes: granularidad === "diario" ? mes : undefined,
      });
      setData(result);
    });
  };

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularidad, campoFecha, anio, mes]);

  const anios = useMemo(() => {
    const set = new Set<number>(data?.anios ?? []);
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [data?.anios]);

  const buckets = data?.buckets ?? [];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header — granularidad + filtros */}
      <Tabs value={granularidad} onValueChange={(v) => setGranularidad(v as Granularidad)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="diario">Diario</TabsTrigger>
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
                title="Agrupar por el día en que se sienta el cliente"
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
                title="Agrupar por el día en que se hizo la reserva"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Fecha creación
              </button>
            </div>
            {granularidad === "diario" && (
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_LABEL.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
          {campoFecha === "fecha" ? "Por día reservado" : "Por fecha de creación"} · {anio}
          {granularidad === "diario" ? ` · ${MESES_LABEL[mes - 1]}` : ""} · Total {data?.total ?? 0}
        </p>
      </div>

      {/* Grid de pies */}
      {buckets.length === 0 && !pending ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Sin reservas en el rango seleccionado.
        </Card>
      ) : (
        <div
          className={
            granularidad === "diario"
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : granularidad === "mensual"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                : "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
          }
        >
          {buckets.map((b) => {
            const datos: PieDatum[] = b.origenes.map((o) => ({
              name: ORIGEN_LABELS[o.origen],
              value: o.reservas,
              origen: o.origen,
            }));
            return (
              <Card key={b.key} className="flex flex-col p-3">
                <PieOrigen datos={datos} />
                <div className="mt-1 text-center text-sm font-semibold">{b.label}</div>
                <TablaOrigen origenes={b.origenes} total={b.total} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
