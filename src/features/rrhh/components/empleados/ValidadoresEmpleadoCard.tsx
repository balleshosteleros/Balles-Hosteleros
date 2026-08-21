"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import {
  getValidadorSolicitudesEmpleado,
  type ValidadorSolicitudesVista,
} from "@/features/rrhh/actions/validadores-actions";

type Props = {
  empleadoId: string;
};

/**
 * Muestra qué departamento valida las solicitudes de este empleado y quiénes
 * pueden aprobarlas hoy. Es solo lectura: la ficha del empleado no edita nada.
 * El departamento validador se define en el puesto (RRHH → Puestos).
 */
export function ValidadoresEmpleadoCard({ empleadoId }: Props) {
  const [datos, setDatos] = useState<ValidadorSolicitudesVista | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    getValidadorSolicitudesEmpleado(empleadoId).then((res) => {
      if (!activo) return;
      setDatos(res.data);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [empleadoId]);

  const depto = datos?.departamentoNombre ?? null;
  const quienes = datos?.quienesPuedenValidar ?? [];

  return (
    <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Validador de solicitudes</h3>
          <p className="text-sm text-muted-foreground">
            Departamento que aprueba o deniega las solicitudes de este empleado.
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="rounded-md border bg-muted/30 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Valida</p>
            <p
              className={
                depto ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground italic"
              }
            >
              {depto ?? "Sin definir"}
            </p>
          </div>

          {depto && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                Pueden aprobarle quienes tengan acceso a {depto} en su rol:
              </p>
              {quienes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {quienes.map((n) => (
                    <span
                      key={n}
                      className="rounded-full border bg-background px-2.5 py-1 text-xs text-foreground"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-rose-600">
                  Ahora mismo nadie tiene acceso a {depto} en su rol, así que sus solicitudes se
                  quedarían sin resolver.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Se define en el puesto y el empleado lo hereda.{" "}
            <Link
              href="/rrhh/puestos"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Ir a puestos
              <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
