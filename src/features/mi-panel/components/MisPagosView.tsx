"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listMisPagosAbonados,
  getMiLiquidacionPendiente,
  type PagoAbonado,
  type PagoPendiente,
} from "@/features/rrhh/actions/pagos-actions";
import { LiquidacionPendienteCard } from "./LiquidacionPendienteCard";
import { HistorialPagos } from "@/features/rrhh/components/pagos/HistorialPagos";
import { Loader2 } from "lucide-react";

/**
 * Portal del empleado → "Mis pagos".
 *
 * Arriba, la liquidación que espera su respuesta: la ve con su desglose y decide
 * si la cobra o la rechaza. Debajo, el histórico de lo ya abonado.
 *
 * El pendiente vivía solo en un pop-up de notificación, que aparece una vez y
 * desaparece: si lo cerraba sin querer, no tenía dónde volver a mirarlo.
 */
export function MisPagosView() {
  const { empresaActual } = useEmpresa();
  const [pagos, setPagos] = useState<PagoAbonado[]>([]);
  const [pendiente, setPendiente] = useState<PagoPendiente | null>(null);
  const [cargando, setCargando] = useState(true);
  // Al cobrar o rechazar se recarga todo: el pendiente desaparece y, si lo
  // cobró, la fila pasa al histórico en cuanto RRHH la marque como pagada.
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    Promise.all([listMisPagosAbonados(), getMiLiquidacionPendiente()])
      .then(([resPagos, resPend]) => {
        if (!activo) return;
        setPagos(resPagos.ok ? resPagos.data : []);
        setPendiente(resPend.ok ? resPend.data : null);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [empresaActual.id, recarga]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {cargando ? (
        <Card className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </Card>
      ) : (
        <>
          {pendiente && (
            <LiquidacionPendienteCard
              pago={pendiente}
              onResuelta={() => setRecarga((n) => n + 1)}
            />
          )}
          <HistorialPagos pagos={pagos} />
        </>
      )}
    </div>
  );
}
