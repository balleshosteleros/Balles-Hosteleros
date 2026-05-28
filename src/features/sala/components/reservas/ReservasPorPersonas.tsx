"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { listReservasRango } from "@/features/sala/actions/reservas-actions";
import type { EstadoReserva, Reserva } from "@/features/sala/data/reservas";

interface Props {
  fecha: string;
  reservasDia: Reserva[];
}

const EXCLUIDOS = new Set<EstadoReserva>(["CANCELADA", "NO_SHOW", "LIBERADA"]);

type Scope = "dia" | "mes";
type DataRow = { personas: number; estado: EstadoReserva };
type Fila = { key: string; label: string; count: number; pct: number };

function rangoMes(fecha: string): { desde: string; hasta: string } {
  const d = new Date(fecha + "T12:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const desde = new Date(y, m, 1).toISOString().split("T")[0];
  const hasta = new Date(y, m + 1, 0).toISOString().split("T")[0];
  return { desde, hasta };
}

function calcularFilas(rows: DataRow[]): { filas: Fila[]; total: number } {
  const validas = rows.filter((r) => !EXCLUIDOS.has(r.estado));
  const total = validas.length;

  const counts = new Map<number, number>();
  for (const r of validas) {
    const n = r.personas ?? 0;
    if (n < 1) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }

  const ordenado = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0] - b[0],
  );

  const top = ordenado.slice(0, 4);
  const resto = ordenado.slice(4);
  const restoCount = resto.reduce((s, [, c]) => s + c, 0);

  const filas: Fila[] = top.map(([n, c]) => ({
    key: `n-${n}`,
    label: `${n} ${n === 1 ? "persona" : "personas"}`,
    count: c,
    pct: total > 0 ? (c / total) * 100 : 0,
  }));

  if (restoCount > 0) {
    filas.push({
      key: "otros",
      label: "Otros",
      count: restoCount,
      pct: (restoCount / total) * 100,
    });
  }

  return { filas, total };
}

export function ReservasPorPersonas({ fecha, reservasDia }: Props) {
  const [scope, setScope] = useState<Scope>("dia");
  const [mesData, setMesData] = useState<DataRow[]>([]);
  const [loadingMes, setLoadingMes] = useState(false);

  useEffect(() => {
    if (scope !== "mes") return;
    let cancelled = false;
    setLoadingMes(true);
    (async () => {
      const { desde, hasta } = rangoMes(fecha);
      const r = await listReservasRango(desde, hasta);
      if (cancelled) return;
      if (r.ok) {
        setMesData(
          (r.data as Array<{ personas: number; estado: EstadoReserva }>).map((row) => ({
            personas: row.personas ?? 0,
            estado: row.estado,
          })),
        );
      } else {
        setMesData([]);
      }
      setLoadingMes(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, fecha]);

  const { filas, total } = useMemo(() => {
    if (scope === "dia") {
      return calcularFilas(
        reservasDia.map((r) => ({ personas: r.comensales ?? 0, estado: r.estado })),
      );
    }
    return calcularFilas(mesData);
  }, [scope, reservasDia, mesData]);

  const maxPct = filas.length > 0 ? Math.max(...filas.map((f) => f.pct), 1) : 1;

  return (
    <div className="px-3 py-2 border-b bg-card/50 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Top nº de personas
        </span>
        <div className="flex items-center gap-1">
          {(["dia", "mes"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "h-5 px-1.5 rounded text-[10px] font-medium transition-colors",
                scope === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {s === "dia" ? "Día" : "Mes"}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground tabular-nums ml-1">
            {scope === "mes" && loadingMes ? "…" : `${total} reservas`}
          </span>
        </div>
      </div>
      {filas.length === 0 ? (
        <p className="text-[10px] text-muted-foreground py-1">
          {scope === "mes" && loadingMes ? "Cargando…" : "Sin reservas válidas en el rango."}
        </p>
      ) : (
        <div className="space-y-1">
          {filas.map((f) => (
            <div
              key={f.key}
              className="grid grid-cols-[68px_28px_1fr_46px] gap-1.5 items-center text-[10px]"
            >
              <span className="text-muted-foreground truncate">{f.label}</span>
              <span className="tabular-nums font-semibold text-right">{f.count}</span>
              <div className="h-2 rounded-sm bg-muted overflow-hidden">
                <div
                  className={
                    f.key === "otros" ? "h-full bg-muted-foreground/40" : "h-full bg-amber-400"
                  }
                  style={{ width: `${(f.pct / maxPct) * 100}%` }}
                />
              </div>
              <span className="tabular-nums text-muted-foreground text-right">
                {f.pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
