"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Palmtree } from "lucide-react";
import { getSaldoVacacionesEmpleado } from "@/features/rrhh/actions/calendarios-vacaciones-actions";
import type { SaldoVacaciones } from "@/features/rrhh/data/calendarios-vacaciones";

type Props = {
  empleadoId: string;
};

/**
 * Muestra el calendario de vacaciones del empleado y su saldo de días. Es solo
 * lectura: la ficha del empleado no edita nada. El calendario se asigna desde
 * RRHH → Calendarios → Vacaciones.
 */
export function CalendarioVacacionesEmpleadoCard({ empleadoId }: Props) {
  const [saldo, setSaldo] = useState<SaldoVacaciones | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    getSaldoVacacionesEmpleado(empleadoId).then((res) => {
      if (!activo) return;
      setSaldo(res.ok ? res.data : null);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [empleadoId]);

  const asignado = Boolean(saldo?.calendarioId);

  return (
    <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
          <Palmtree className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Calendario de vacaciones</h3>
          <p className="text-sm text-muted-foreground">
            Días disponibles y periodos en los que este empleado puede pedir vacaciones.
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="rounded-md border bg-muted/30 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Calendario asignado</p>
            <p
              className={
                asignado
                  ? "text-sm font-medium text-foreground"
                  : "text-sm text-muted-foreground italic"
              }
            >
              {asignado ? saldo?.calendarioNombre ?? "Sin nombre" : "Sin asignar"}
            </p>
          </div>

          {asignado && saldo && (
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
              <div>
                <p className="text-lg font-semibold">{saldo.diasTotales}</p>
                <p className="text-xs text-muted-foreground">Totales {saldo.anio}</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-amber-600">{saldo.diasGastados}</p>
                <p className="text-xs text-muted-foreground">Gastados</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-600">{saldo.diasRestantes}</p>
                <p className="text-xs text-muted-foreground">Restantes</p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Se asigna desde{" "}
            <Link
              href="/rrhh/calendarios"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              RRHH → Calendarios
              <ExternalLink className="h-3 w-3" />
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
