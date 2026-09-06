"use client";

/**
 * Todo lo que le ha pasado a la entrega de un mes, en orden.
 *
 * Junta en una sola línea de tiempo lo que antes estaba disperso o no se veía:
 * las subidas de nóminas y de seguros sociales, los archivos rechazados por venir
 * de otro mes, las devoluciones a la gestoría con el texto que se les escribió, y
 * las aprobaciones. Sirve para responder "¿qué pasó aquí?" sin abrir tres sitios.
 *
 * Se carga solo al desplegarlo: son cuatro consultas y el 99 % de las veces nadie
 * lo abre.
 */

import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";
import {
  CheckCircle2,
  Loader2,
  Undo2,
  Upload,
  XCircle,
} from "lucide-react";
import type {
  HistoricoEntrada,
  HistoricoTipo,
} from "@/features/rrhh/actions/nominas-aprobacion-actions";

/** Icono y color de cada cosa que puede pasar. */
const ESTILO: Record<HistoricoTipo, { Icono: typeof Upload; color: string }> = {
  subida_nominas: { Icono: Upload, color: "text-muted-foreground" },
  subida_seguros: { Icono: Upload, color: "text-muted-foreground" },
  rechazo_archivo: { Icono: XCircle, color: "text-destructive" },
  aprobado_nominas: { Icono: CheckCircle2, color: "text-emerald-600" },
  aprobado_seguros: { Icono: CheckCircle2, color: "text-emerald-600" },
  devuelto_nominas: { Icono: Undo2, color: "text-amber-600" },
  devuelto_seguros: { Icono: Undo2, color: "text-amber-600" },
  reabierto_nominas: { Icono: Undo2, color: "text-muted-foreground" },
};

function fmtCuando(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  );
}

export function HistoricoEntrega({
  periodo,
  cargar,
}: {
  periodo: string;
  cargar: () => Promise<HistoricoEntrada[]>;
}) {
  const [filas, setFilas] = useState<HistoricoEntrada[] | null>(null);

  useEffect(() => {
    let vivo = true;
    setFilas(null);
    void cargar().then((r) => {
      if (vivo) setFilas(r);
    });
    return () => {
      vivo = false;
    };
    // `cargar` la re-crea el padre en cada render: la dependencia real es el mes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  if (filas === null) {
    return (
      <div className="flex items-center justify-center gap-2 border-t px-3 py-6 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <p className="border-t px-3.5 py-5 text-center text-xs text-muted-foreground">
        Todavía no ha pasado nada en este mes.
      </p>
    );
  }

  return (
    <div className="max-h-80 space-y-3 overflow-y-auto border-t bg-muted/20 px-3.5 py-3">
      {filas.map((f) => {
        const { Icono, color } = ESTILO[f.tipo];
        return (
          <div key={f.id} className="flex gap-2.5">
            <Icono className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", color)} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-xs font-medium">{f.titulo}</p>
                {f.importe != null && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {f.importe.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {fmtCuando(f.cuando)} · {f.quien ?? "Gestoría"}
              </p>
              {f.detalle && (
                <p className="mt-1 whitespace-pre-line text-[11px] leading-snug text-muted-foreground">
                  {f.detalle}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
