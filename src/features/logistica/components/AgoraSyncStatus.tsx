"use client";

/**
 * AgoraSyncStatus — cómo fue la última sincronización de ventas con Ágora.
 *
 * SOLO INFORMA. Aquí había un botón "Sincronizar" que en realidad traía las
 * existencias de Ágora y **pisaba el stock de Balles** sin dejar apunte en el
 * historial. Se retiró en el PRP-080 Fase 2: Iván decidió en julio que Balles manda
 * el stock, y desde que el kardex se recalcula solo, un saldo escrito por fuera es un
 * saldo que el histórico no explica.
 *
 * Las ventas entran solas cada madrugada (`api/cron/agora-sync`) y lo que se ve aquí
 * es el parte de esa pasada.
 */

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Loader2,
  WifiOff,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getLastSyncLog,
  type AgoraSyncLog,
} from "@/features/logistica/actions/agora-actions";
import type { AgoraSyncStatus } from "@/features/logistica/types/agora";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";

// ─── HELPERS VISUALES ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AgoraSyncStatus,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ok: {
    label: "Sincronizado",
    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    variant: "default",
  },
  partial: {
    label: "Parcial",
    icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    variant: "secondary",
  },
  timeout: {
    label: "Sin respuesta",
    icon: <WifiOff className="h-4 w-4 text-red-500" />,
    variant: "destructive",
  },
  error: {
    label: "Error",
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    variant: "destructive",
  },
};

/** Lo que el cron dejó anotado sobre el descuento de stock de ese día. */
type StockDelSync = {
  aplicado?: boolean;
  motivo?: string;
  ticketsSinDescontar?: number;
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export function AgoraSyncStatus() {
  const { empresaActual } = useEmpresa();
  const [lastLog, setLastLog] = useState<AgoraSyncLog | null>(null);
  const [loadingLog, setLoadingLog] = useState(true);

  const cargarUltimoLog = useCallback(async () => {
    setLoadingLog(true);
    const { data } = await getLastSyncLog();
    setLastLog(data);
    setLoadingLog(false);
  }, []);

  useEffect(() => {
    cargarUltimoLog();
  }, [cargarUltimoLog]);

  const statusCfg = lastLog ? STATUS_CONFIG[lastLog.status as AgoraSyncStatus] : null;

  // Si ese día quedó dentro de un período de almacén ya cerrado, las ventas no se
  // descontaron. No es un fallo, pero tiene que verse: si no, se pierde en silencio.
  const stock = (lastLog?.sales_data as { stock?: StockDelSync } | null)?.stock;
  const sinDescontar = stock?.motivo === "almacen_cerrado" ? (stock.ticketsSinDescontar ?? 0) : 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Ventas de Ágora
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {loadingLog ? (
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : lastLog ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Última entrada:</span>
              <span className="text-xs">
                {formatFechaHoraEnZona(lastLog.sync_at, empresaActual.zonaHoraria, { month: "short" })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estado:</span>
              <Badge variant={statusCfg?.variant ?? "outline"} className="gap-1">
                {statusCfg?.icon}
                {statusCfg?.label ?? lastLog.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Registros:</span>
              <span>
                <span className="font-medium text-green-600">{lastLog.ok_records}</span>
                {" ok / "}
                {lastLog.total_records} total
                {lastLog.error_records > 0 && (
                  <span className="ml-1 text-red-500">({lastLog.error_records} errores)</span>
                )}
              </span>
            </div>
            {lastLog.retry_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reintentos:</span>
                <span className="text-yellow-600">{lastLog.retry_count}</span>
              </div>
            )}
            {sinDescontar > 0 && (
              <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  El almacén ya estaba cerrado a esa fecha, así que{" "}
                  <strong>{sinDescontar} {sinDescontar === 1 ? "ticket" : "tickets"}</strong> no
                  descontaron existencias. La diferencia se arregla en el inventario siguiente.
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no ha entrado ninguna venta de Ágora. Entran solas cada madrugada.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
