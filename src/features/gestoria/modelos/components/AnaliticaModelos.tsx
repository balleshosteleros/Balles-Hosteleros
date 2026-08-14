"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { getAnaliticaModelos, type ResumenAnalitica } from "../actions/analitica-actions";

/**
 * Analítica de lo REALMENTE PRESENTADO (casillas leídas de los justificantes
 * AEAT). Cada gráfica responde a una pregunta concreta:
 *  · IVA repercutido vs deducible → de dónde sale el resultado del 303.
 *  · Resultado del 303 → polaridad: trimestres a ingresar vs a compensar.
 *  · Retenciones y tipo medio → NO comparten eje con las percepciones (escalas
 *    distintas): van en gráficas separadas, nunca un doble eje.
 */

// Paleta validada con el script de dataviz (6 checks OK en light y dark).
const SERIE_1_LIGHT = "#2a78d6"; // azul  · IVA repercutido
const SERIE_2_LIGHT = "#eb6834"; // naranja · IVA deducible
const SERIE_1_DARK = "#3987e5";
const SERIE_2_DARK = "#d95926";
// Diverging para el resultado (polaridad a ingresar / a compensar).
const POS_LIGHT = "#c2410c";
const NEG_LIGHT = "#0f766e";
const POS_DARK = "#f97316";
const NEG_DARK = "#2dd4bf";

const eur = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

function useModoOscuro() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const calcular = () => {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "dark") return true;
      if (attr === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    setOscuro(calcular());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setOscuro(calcular());
    mq.addEventListener("change", onChange);
    const obs = new MutationObserver(onChange);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", onChange);
      obs.disconnect();
    };
  }, []);
  return oscuro;
}

function Tarjeta({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <header className="mb-3">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      </header>
      {children}
    </section>
  );
}

export function AnaliticaModelos() {
  const [datos, setDatos] = useState<ResumenAnalitica | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verTabla, setVerTabla] = useState(false);
  const oscuro = useModoOscuro();

  const c = useMemo(
    () => ({
      s1: oscuro ? SERIE_1_DARK : SERIE_1_LIGHT,
      s2: oscuro ? SERIE_2_DARK : SERIE_2_LIGHT,
      pos: oscuro ? POS_DARK : POS_LIGHT,
      neg: oscuro ? NEG_DARK : NEG_LIGHT,
      grid: oscuro ? "#2c2c2b" : "#e8e8e4",
      tinta: oscuro ? "#c3c2b7" : "#52514e",
      panel: oscuro ? "#1a1a19" : "#ffffff",
    }),
    [oscuro],
  );

  useEffect(() => {
    void getAnaliticaModelos().then((r) => {
      if (r.ok) setDatos(r.data);
      else setError(r.error ?? "No se pudo cargar la analítica");
      setCargando(false);
    });
  }, []);

  if (cargando) return <LoadingSpinner className="py-12" />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No se pudo cargar la analítica</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const d = datos!;
  const hayDatos = d.iva.length > 0 || d.retenciones.length > 0;

  if (!hayDatos) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Todavía no hay modelos presentados con datos leídos del justificante.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Las gráficas se construyen solo con lo presentado ante Hacienda, no con borradores.
        </p>
      </div>
    );
  }

  const ejesComunes = (
    <>
      <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="etiqueta" tick={{ fill: c.tinta, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} />
    </>
  );

  const tooltipProps = {
    contentStyle: {
      background: c.panel,
      border: `1px solid ${c.grid}`,
      borderRadius: 6,
      fontSize: 12,
    },
    labelStyle: { color: c.tinta, marginBottom: 4 },
  };

  return (
    <div className="space-y-4">
      {d.totales ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Ventas declaradas · {d.totales.ejercicio}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {eur(d.totales.baseVentas)}
            </p>
            <p className="text-[11px] text-muted-foreground">Base imponible de los 4 trimestres</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">IVA del ejercicio · {d.totales.ejercicio}</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {eur(d.totales.ivaResultado)}
            </p>
            <p className="text-[11px] text-muted-foreground">Suma del resultado de los 303</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Retenciones · {d.totales.ejercicio}</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {eur(d.totales.retenciones)}
            </p>
            <p className="text-[11px] text-muted-foreground">IRPF ingresado vía modelo 111</p>
          </div>
        </div>
      ) : null}

      {d.iva.length > 0 ? (
        <Tarjeta
          titulo="IVA repercutido y deducible por trimestre"
          ayuda="Lo que cobras de IVA frente a lo que te deduces. La diferencia es lo que se liquida."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.iva} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              {ejesComunes}
              <YAxis
                tick={{ fill: c.tinta, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => eur(v)}
                width={78}
              />
              <Tooltip {...tooltipProps} formatter={(v: number, n: string) => [eur2(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ivaRepercutido" name="IVA repercutido" fill={c.s1} radius={[4, 4, 0, 0]} />
              <Bar dataKey="ivaDeducible" name="IVA deducible" fill={c.s2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Tarjeta>
      ) : null}

      {d.iva.length > 0 ? (
        <Tarjeta
          titulo="Resultado de cada 303"
          ayuda="Por encima de cero, trimestres a ingresar; por debajo, a compensar."
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.iva} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              {ejesComunes}
              <YAxis
                tick={{ fill: c.tinta, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => eur(v)}
                width={78}
              />
              <Tooltip
                {...tooltipProps}
                formatter={(v: number) => [eur2(v), v >= 0 ? "A ingresar" : "A compensar"]}
              />
              <ReferenceLine y={0} stroke={c.tinta} strokeWidth={1} />
              <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]}>
                {d.iva.map((p) => (
                  <Cell key={p.etiqueta} fill={p.resultado >= 0 ? c.pos : c.neg} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Naranja = a ingresar · Verde azulado = a compensar
          </p>
        </Tarjeta>
      ) : null}

      {d.retenciones.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Tarjeta
            titulo="Retenciones de IRPF ingresadas"
            ayuda="Modelo 111: lo retenido a la plantilla cada trimestre."
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.retenciones} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                {ejesComunes}
                <YAxis
                  tick={{ fill: c.tinta, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => eur(v)}
                  width={70}
                />
                <Tooltip {...tooltipProps} formatter={(v: number) => [eur2(v), "Retenciones"]} />
                <Bar dataKey="retenciones" name="Retenciones" fill={c.s1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Tarjeta>

          <Tarjeta
            titulo="Tipo medio de retención"
            ayuda="Porcentaje que representa lo retenido sobre las percepciones declaradas."
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={d.retenciones} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                {ejesComunes}
                <YAxis
                  tick={{ fill: c.tinta, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v.toLocaleString("es-ES")} %`}
                  width={56}
                />
                <Tooltip
                  {...tooltipProps}
                  formatter={(v: number) => [`${v.toLocaleString("es-ES")} %`, "Tipo medio"]}
                />
                <Line
                  type="monotone"
                  dataKey="tipoMedio"
                  name="Tipo medio"
                  stroke={c.s2}
                  strokeWidth={2}
                  dot={{ r: 4, fill: c.s2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Tarjeta>
        </div>
      ) : null}

      <div>
        <Button variant="outline" size="sm" onClick={() => setVerTabla((v) => !v)}>
          <Table2 className="mr-1 h-4 w-4" />
          {verTabla ? "Ocultar la tabla" : "Ver los datos en tabla"}
        </Button>
      </div>

      {verTabla ? (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <caption className="p-3 text-left text-xs text-muted-foreground">
              Casillas leídas de los justificantes presentados.
            </caption>
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="p-2 text-left font-medium">Periodo</th>
                <th className="p-2 text-right font-medium">Base ventas</th>
                <th className="p-2 text-right font-medium">IVA repercutido</th>
                <th className="p-2 text-right font-medium">IVA deducible</th>
                <th className="p-2 text-right font-medium">Resultado 303</th>
                <th className="p-2 text-right font-medium">Retenciones 111</th>
              </tr>
            </thead>
            <tbody>
              {d.iva.map((p) => {
                const r = d.retenciones.find((x) => x.etiqueta === p.etiqueta);
                return (
                  <tr key={p.etiqueta} className="border-b last:border-0">
                    <td className="p-2">{p.etiqueta}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{eur2(p.baseVentas)}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{eur2(p.ivaRepercutido)}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{eur2(p.ivaDeducible)}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{eur2(p.resultado)}</td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {r ? eur2(r.retenciones) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
