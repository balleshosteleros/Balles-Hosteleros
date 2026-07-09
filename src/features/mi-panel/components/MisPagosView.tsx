"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listMisPagosAbonados,
  type PagoAbonado,
} from "@/features/rrhh/actions/pagos-actions";
import { HistorialPagos } from "@/features/rrhh/components/pagos/HistorialPagos";
import { Euro, Loader2 } from "lucide-react";

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
      <Card className="p-4 md:p-5 flex items-center gap-4 border-dashed">
        <div className="h-10 w-10 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <Euro className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Tus pagos abonados</p>
          <p className="text-xs text-muted-foreground">
            Histórico de las liquidaciones que ya se te han abonado, con su fecha
            e importe percibido.
          </p>
        </div>
        {!cargando && (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-0">
            {pagos.length} {pagos.length === 1 ? "pago" : "pagos"}
          </Badge>
        )}
      </Card>

      {cargando ? (
        <Card className="p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ) : (
        <HistorialPagos pagos={pagos} />
      )}
    </div>
  );
}
