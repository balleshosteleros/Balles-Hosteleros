"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listMisPagosAbonados,
  type PagoAbonado,
} from "@/features/rrhh/actions/pagos-actions";
import { HistorialPagos } from "@/features/rrhh/components/pagos/HistorialPagos";
import { Loader2 } from "lucide-react";

/**
 * Portal del empleado → "Mis pagos". Muestra SOLO las liquidaciones ya abonadas
 * por RRHH (histórico de dinero recibido), con su fecha de abono y desglose.
 * Los pagos aún no abonados no aparecen aquí: el empleado los ve, mientras están
 * pendientes, a través de la notificación de liquidación / el enlace de correo.
 */
export function MisPagosView() {
  const { empresaActual } = useEmpresa();
  const [pagos, setPagos] = useState<PagoAbonado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    listMisPagosAbonados()
      .then((res) => {
        if (activo) setPagos(res.ok ? res.data : []);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [empresaActual.id]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {cargando ? (
        <Card className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </Card>
      ) : (
        <HistorialPagos pagos={pagos} />
      )}
    </div>
  );
}
