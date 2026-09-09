"use client";

/**
 * Qué ha hecho realmente una automatización, paso a paso.
 *
 * Es la mitad del valor del submódulo: sin esto, encender algo que escribe a
 * clientes es un acto de fe. Aquí se ve a quién le tocó, qué se le mandó y qué
 * pasó — incluido lo que NO se mandó y por qué.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { listarEjecucionesAction } from "@/features/marketing/actions/automatizaciones-actions";
import type { Automatizacion, EjecucionResumen } from "@/features/marketing/data/automatizaciones";

const ESTADO: Record<EjecucionResumen["estado"], { label: string; clase: string }> = {
  pendiente: { label: "En marcha", clase: "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/30" },
  hecha: { label: "Terminada", clase: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30" },
  cortada: { label: "Parada", clase: "bg-muted text-muted-foreground border-border" },
  error: { label: "Con fallos", clase: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/30" },
};

const RESULTADO: Record<string, string> = {
  enviado: "Enviado",
  simulado: "Simulado (modo pruebas)",
  saltado: "Sin efecto",
  cortado: "Paró aquí",
  error: "Falló",
};

interface Props {
  automatizacion: Automatizacion | null;
  onOpenChange: (open: boolean) => void;
  tz: string;
}

export function HistorialSheet({ automatizacion, onOpenChange, tz }: Props) {
  const [filas, setFilas] = useState<EjecucionResumen[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!automatizacion) return;
    setCargando(true);
    listarEjecucionesAction(automatizacion.id).then((r) => {
      if (r.ok) setFilas(r.data);
      else toast.error(r.error);
      setCargando(false);
    });
  }, [automatizacion]);

  return (
    <Sheet open={automatizacion !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-1">
          <SheetTitle>{automatizacion?.nombre ?? "Historial"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 px-1 pb-28">
          {cargando ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : filas.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Todavía no se ha disparado con nadie.
            </p>
          ) : (
            filas.map((f) => {
              const quien = (f.contexto.nombre as string) ?? "un cliente";
              const meta = ESTADO[f.estado];
              return (
                <div key={f.id} className="rounded-xl border bg-card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium flex-1 truncate">{quien}</span>
                    <Badge variant="outline" className={meta.clase}>{meta.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatFechaHoraEnZona(f.createdAt, tz)}
                    {f.estado === "pendiente" && ` · sigue el ${formatFechaHoraEnZona(f.ejecutarEn, tz)}`}
                  </p>
                  {f.historial.length > 0 && (
                    <ul className="space-y-1 border-t pt-2">
                      {f.historial.map((h, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          <span className="text-foreground">{RESULTADO[h.resultado] ?? h.resultado}</span>
                          {h.detalle ? ` — ${h.detalle}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {f.ultimoError && <p className="text-xs text-destructive">{f.ultimoError}</p>}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
