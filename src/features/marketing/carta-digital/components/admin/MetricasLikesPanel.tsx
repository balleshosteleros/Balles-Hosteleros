"use client";

import { useEffect, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { obtenerRankingLikes } from "../../actions/likes-estadisticas-actions";
import type { FilaRanking, PeriodoRanking } from "../../services/likes-estadisticas";

const PERIODOS: { clave: PeriodoRanking; etiqueta: string }[] = [
  { clave: "semana", etiqueta: "Semana" },
  { clave: "mes", etiqueta: "Mes" },
  { clave: "trimestre", etiqueta: "Trimestre" },
  { clave: "anio", etiqueta: "Año" },
];

/**
 * Los 5 platos más votados, por periodo.
 *
 * Cuenta solo votos REALES: el número que ve el comensal lleva además el
 * arranque configurado en cada plato, y sumarlo aquí haría que el ranking
 * dijera quién empezó más alto en vez de qué gusta. Esta tabla se usa para
 * decidir en cocina, así que tiene que ser el dato limpio.
 */
export function MetricasLikesPanel({ empresaId }: { empresaId: string }) {
  const [periodo, setPeriodo] = useState<PeriodoRanking>("mes");
  const [filas, setFilas] = useState<FilaRanking[]>([]);
  const [total, setTotal] = useState(0);
  const [cargado, setCargado] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let vivo = true;
    setCargado(false);
    startTransition(async () => {
      const r = await obtenerRankingLikes(periodo);
      if (!vivo) return;
      setFilas(r.filas);
      setTotal(r.total);
      setCargado(true);
    });
    return () => {
      vivo = false;
    };
  }, [periodo, empresaId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <span>Platos más votados</span>
          <span className="text-sm font-normal text-stone-500">
            {cargado ? `${total} me gusta en el periodo` : "Cargando…"}
          </span>
        </CardTitle>

        <div className="mt-2 flex gap-1 rounded-full bg-stone-100 p-1">
          {PERIODOS.map((p) => {
            const on = periodo === p.clave;
            return (
              <button
                key={p.clave}
                type="button"
                onClick={() => setPeriodo(p.clave)}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  on ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {p.etiqueta}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {!cargado ? (
          <p className="py-6 text-center text-sm text-stone-400">Cargando…</p>
        ) : filas.length === 0 ? (
          // Sin votos aún no es un error: la carta acaba de publicarse o el
          // periodo es corto. Se dice qué falta, no "no hay datos".
          <p className="py-6 text-center text-sm text-stone-500">
            Todavía nadie ha votado en este periodo. Los me gusta llegan cuando
            los clientes abren la carta con el QR de la mesa.
          </p>
        ) : (
          <ol className="space-y-2">
            {filas.map((f, i) => (
              <li
                key={f.item_id}
                className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-5 shrink-0 font-bold text-stone-400">#{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{f.nombre}</span>
                    <span className="block truncate text-xs text-stone-500">{f.categoria}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 font-semibold text-rose-600">
                  <Heart className="h-4 w-4 fill-current" />
                  {f.votos}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
