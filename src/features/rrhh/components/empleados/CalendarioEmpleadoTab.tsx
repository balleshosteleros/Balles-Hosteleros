"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listAusenciasEmpresa,
  type AusenciaCalendario,
} from "@/features/rrhh/actions/calendario-ausencias-actions";
import { useFestivos } from "@/features/rrhh/hooks/useFestivos";
import { CalendarioUnico } from "@/features/rrhh/components/calendarios/CalendarioUnico";
import { getSaldoVacacionesEmpleado } from "@/features/rrhh/actions/calendarios-vacaciones-actions";
import type { SaldoVacaciones } from "@/features/rrhh/data/calendarios-vacaciones";
import { DesgloseVacaciones } from "@/features/rrhh/components/calendarios/DesgloseVacaciones";

type Props = {
  empleadoId: string;
  empresaId: string;
  /** Las ausencias se guardan contra el usuario, no contra la ficha. */
  userId: string;
};

/**
 * El año de este empleado: sus vacaciones, bajas médicas, permisos y bajas de
 * contrato pintadas en el calendario, más su saldo de vacaciones.
 *
 * Reutiliza el mismo calendario que RRHH → Calendarios, pero con las ausencias
 * filtradas a esta persona, así que se ve igual en los dos sitios.
 */
export function CalendarioEmpleadoTab({ empleadoId, empresaId, userId }: Props) {
  const [anio, setAnio] = useState<number>(() => new Date().getFullYear());
  const { festivoEnFecha } = useFestivos(anio);
  const [ausencias, setAusencias] = useState<AusenciaCalendario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [saldo, setSaldo] = useState<SaldoVacaciones | null>(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    listAusenciasEmpresa(empresaId, anio).then((res) => {
      if (!activo) return;
      setAusencias(res.ok ? res.data : []);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [empresaId, anio]);

  useEffect(() => {
    let activo = true;
    getSaldoVacacionesEmpleado(empleadoId).then((res) => {
      if (!activo) return;
      setSaldo(res.ok ? res.data : null);
    });
    return () => {
      activo = false;
    };
  }, [empleadoId]);

  // Solo las suyas: el calendario de la ficha es de esta persona, no de la
  // plantilla entera.
  const misAusencias = useMemo(
    () => (userId ? ausencias.filter((a) => a.userId === userId) : []),
    [ausencias, userId],
  );

  return (
    <div className="p-6 space-y-6">
      {saldo?.calendarioId && (
        <div className="rounded-lg border bg-card p-4 md:p-5">
          <DesgloseVacaciones
            anio={saldo.anio}
            diasTotales={saldo.diasTotales}
            diasDisfrutados={saldo.diasDisfrutados}
            diasAprobadosPendientes={saldo.diasAprobadosPendientes}
            diasPendientesAprobacion={saldo.diasPendientesAprobacion}
            diasRestantes={saldo.diasRestantes}
            tamano="md"
          />
        </div>
      )}

      <CalendarioUnico
        ausencias={misAusencias}
        festivoEnFecha={festivoEnFecha}
        onAnioChange={setAnio}
        cargando={cargando}
      />
    </div>
  );
}
