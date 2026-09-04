"use client";

/**
 * Evolución mensual de las valoraciones, encima del pipeline de reseñas.
 *
 * El pipeline enseña las reseñas de una en una, que es lo que hace falta para
 * gestionarlas. Esto contesta lo otro: si vamos mejorando o empeorando, y en qué
 * meses la gente nos escribió más.
 *
 * Al pulsar un mes se filtra el pipeline de abajo, en vez de abrir otra
 * pantalla: leer los comentarios de un mes malo es justo lo siguiente que se
 * quiere hacer después de verlo en la gráfica, y separarlo en dos sitios
 * obligaba a volver a filtrar a mano lo que ya se había señalado con el dedo.
 */

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Star, MessageSquare, TrendingUp } from "lucide-react";
import {
  getAnaliticaResenas,
  type AnaliticaResenas,
  type MesValoraciones,
} from "@/features/calidad/actions/analitica-resenas-actions";

/** "2026-08" → "ago 26". Corto porque en el eje X caben 12 etiquetas. */
function etiquetaMes(clave: string): string {
  const [a, m] = clave.split("-").map(Number);
  const d = new Date(Date.UTC(a, (m ?? 1) - 1, 1));
  const mes = d.toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" });
  return `${mes.replace(".", "")} ${String(a).slice(2)}`;
}

export function ResenasAnaliticaPanel({
  mesSeleccionado,
  onSeleccionarMes,
}: {
  mesSeleccionado: string | null;
  onSeleccionarMes: (mes: string | null) => void;
}) {
  const [datos, setDatos] = useState<AnaliticaResenas | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    getAnaliticaResenas(12)
      .then((d) => {
        if (vigente) setDatos(d);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  if (cargando) {
    return (
      <Card className="p-4">
        <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
          Cargando…
        </div>
      </Card>
    );
  }

  if (!datos || datos.total === 0) {
    return (
      <Card className="p-4">
        <div className="h-[120px] flex flex-col items-center justify-center gap-2 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Todavía no hay valoraciones en los últimos 12 meses.
          </p>
        </div>
      </Card>
    );
  }

  const filas = datos.serie.map((m) => ({
    ...m,
    etiqueta: etiquetaMes(m.mes),
    // Recharts dibuja el punto en 0 si le llega null, y un mes sin valoraciones
    // no es un mes con nota cero: se deja el hueco.
    nota: m.notaMedia,
  }));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Evolución de las valoraciones</h3>
          <p className="text-xs text-muted-foreground">
            Últimos 12 meses. Pulsa un mes para ver sus comentarios abajo.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Resumen
            icono={<Star className="h-3.5 w-3.5" />}
            valor={
              datos.notaMediaGlobal !== null
                ? datos.notaMediaGlobal.toFixed(2).replace(".", ",")
                : "—"
            }
            etiqueta="nota media"
          />
          <Resumen
            icono={<MessageSquare className="h-3.5 w-3.5" />}
            valor={String(datos.totalConComentario)}
            etiqueta={`de ${datos.total} con comentario`}
          />
        </div>
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={filas}
            margin={{ top: 8, right: 8, bottom: 4, left: -22 }}
            onClick={(e) => {
              const clave = (e?.activePayload?.[0]?.payload as MesValoraciones | undefined)?.mes;
              if (!clave) return;
              // Volver a pulsar el mes ya elegido lo quita: es la forma natural
              // de "quitar el filtro" sin buscar otro botón.
              onSeleccionarMes(clave === mesSeleccionado ? null : clave);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            {/* Dos ejes porque son magnitudes distintas: la nota va de 1 a 5 y
                el número de comentarios puede ser 50. Con un solo eje, la línea
                de la nota quedaba aplastada contra el suelo. */}
            <YAxis yAxisId="nota" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="vol" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(valor, nombre) => {
                if (nombre === "nota") {
                  return [
                    typeof valor === "number" ? valor.toFixed(2).replace(".", ",") : "—",
                    "Nota media",
                  ];
                }
                if (nombre === "conComentario") return [valor, "Con comentario"];
                return [valor, "Valoraciones"];
              }}
            />
            <Bar yAxisId="vol" dataKey="total" fill="hsl(var(--muted-foreground))" fillOpacity={0.25} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="vol" dataKey="conComentario" fill="hsl(var(--primary))" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
            <Line
              yAxisId="nota"
              type="monotone"
              dataKey="nota"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {mesSeleccionado && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span>
            Mostrando abajo las valoraciones de{" "}
            <strong>{etiquetaMes(mesSeleccionado)}</strong>.
          </span>
          <button
            type="button"
            onClick={() => onSeleccionarMes(null)}
            className="underline text-muted-foreground hover:text-foreground"
          >
            Ver todas
          </button>
        </div>
      )}
    </Card>
  );
}

function Resumen({
  icono,
  valor,
  etiqueta,
}: {
  icono: React.ReactNode;
  valor: string;
  etiqueta: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icono}</span>
      <div className="leading-tight">
        <div className="text-sm font-semibold">{valor}</div>
        <div className="text-[10px] text-muted-foreground">{etiqueta}</div>
      </div>
    </div>
  );
}
