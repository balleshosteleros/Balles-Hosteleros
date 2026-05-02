"use client";

import { useEffect, useState } from "react";
import { Loader2, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listarMisFichajes } from "@/features/mi-panel/actions/mi-panel-actions";
import type { MiFichajeHoy } from "@/features/mi-panel/types";
import { FichajeBar } from "./FichajeBar";

const ESTADO_COLOR: Record<string, string> = {
  trabajando: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pausa: "bg-amber-100 text-amber-700 border-amber-200",
  completado: "bg-slate-100 text-slate-700 border-slate-200",
  pendiente: "bg-blue-100 text-blue-700 border-blue-200",
};

function formatFecha(s: string): string {
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}

function formatHora(s: string | null): string {
  if (!s) return "—";
  if (s.includes("T")) {
    return new Date(s).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return s.slice(0, 5);
}

export function MisFichajesView() {
  const [items, setItems] = useState<MiFichajeHoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    listarMisFichajes(60).then((res) => {
      if (cancel) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [refreshKey]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <FichajeBar onChange={() => setRefreshKey((k) => k + 1)} />

      <Card className="p-4 md:p-5">
        <h2 className="text-lg font-semibold mb-3">Historial</h2>
        {loading ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
            <Inbox className="h-6 w-6 mb-1" />
            Aún no tienes fichajes registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 px-3 font-medium">Entrada</th>
                  <th className="py-2 px-3 font-medium">Pausa</th>
                  <th className="py-2 px-3 font-medium">Salida</th>
                  <th className="py-2 px-3 font-medium text-right">Horas</th>
                  <th className="py-2 pl-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{formatFecha(f.fecha)}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {formatHora(f.horaEntrada)}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {f.pausaInicio ? `${formatHora(f.pausaInicio)} – ${formatHora(f.pausaFin)}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {formatHora(f.horaSalida)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {f.horasTotales ? f.horasTotales.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 pl-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${ESTADO_COLOR[f.estado] ?? ESTADO_COLOR.pendiente}`}
                      >
                        {f.estado}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
