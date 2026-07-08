"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  listPagosAbonadosEmpleado,
  type PagoAbonado,
} from "@/features/rrhh/actions/pagos-actions";
import { HistorialPagos } from "@/features/rrhh/components/pagos/HistorialPagos";
import { Loader2 } from "lucide-react";

/**
 * Pestaña "Pagos" de la ficha del empleado (lado RRHH): histórico de las
 * liquidaciones ya abonadas a ESE empleado en la empresa activa.
 */
export function PagosEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const [pagos, setPagos] = useState<PagoAbonado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    listPagosAbonadosEmpleado(empleadoId)
      .then((res) => {
        if (activo) setPagos(res.ok ? res.data : []);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [empleadoId]);

  if (cargando) {
    return (
      <Card className="p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  return <HistorialPagos pagos={pagos} />;
}
