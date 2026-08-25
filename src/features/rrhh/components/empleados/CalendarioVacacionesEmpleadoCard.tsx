"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Palmtree } from "lucide-react";
import { getSaldoVacacionesEmpleado } from "@/features/rrhh/actions/calendarios-vacaciones-actions";
import type { SaldoVacaciones } from "@/features/rrhh/data/calendarios-vacaciones";
import { DesgloseVacaciones } from "@/features/rrhh/components/calendarios/DesgloseVacaciones";

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
            <DesgloseVacaciones
              anio={saldo.anio}
              diasTotales={saldo.diasTotales}
              diasDisfrutados={saldo.diasDisfrutados}
              diasAprobadosPendientes={saldo.diasAprobadosPendientes}
              diasPendientesAprobacion={saldo.diasPendientesAprobacion}
              diasRestantes={saldo.diasRestantes}
              tamano="md"
            />
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
