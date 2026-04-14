"use client";

/**
 * AgoraSyncStatus — Componente de estado de sincronización con Ágora POS.
 *
 * Implementa visualmente la Regla de Seguridad Ágora:
 * Cuando una sincronización falla, NO reintenta sola.
 * Muestra el error exacto y pregunta al usuario qué hacer.
 */

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Loader2,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  syncVentasAgoraAction,
  getLastSyncLog,
  type AgoraSyncActionResult,
  type AgoraSyncLog,
} from "@/features/logistica/actions/agora-actions";
import type { AgoraSyncStatus } from "@/features/logistica/types/agora";

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

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export function AgoraSyncStatus() {
  const [lastLog, setLastLog] = useState<AgoraSyncLog | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [pendingError, setPendingError] = useState<AgoraSyncActionResult | null>(null);
  const [loadingLog, setLoadingLog] = useState(true);

  // Cargar último sync al montar
  const cargarUltimoLog = useCallback(async () => {
    setLoadingLog(true);
    const { data } = await getLastSyncLog();
    setLastLog(data);
    setLoadingLog(false);
  }, []);

  useEffect(() => {
    cargarUltimoLog();
  }, [cargarUltimoLog]);

  // ─── Disparar sincronización ─────────────────────────────────────────────

  async function handleSync(esReintentoAprobado = false) {
    setSyncing(true);
    setErrorDialogOpen(false);
    setPendingError(null);

    try {
      const result = await syncVentasAgoraAction(esReintentoAprobado);
      await cargarUltimoLog();

      if (result.ok) {
        toast.success(result.mensaje);
      } else {
        // Regla Seguridad Ágora: mostrar error exacto + pedir aprobación
        setPendingError(result);
        setErrorDialogOpen(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Error inesperado — también abre el diálogo de seguridad
      setPendingError({
        ok: false,
        status: "error",
        mensaje: `Error inesperado: ${msg}`,
        totalRecords: 0,
        okRecords: 0,
        errorRecords: 0,
        retryCount: 0,
      });
      setErrorDialogOpen(true);
    } finally {
      setSyncing(false);
    }
  }

  // ─── Decisiones del usuario ante el error ───────────────────────────────

  async function handleReintentar() {
    await handleSync(true);
  }

  function handleIgnorar() {
    setErrorDialogOpen(false);
    setPendingError(null);
    toast.info("Error ignorado. Los datos actuales de Ágora no han cambiado.");
  }

  async function handleCrearBackup() {
    // Backup: el error ya quedó registrado en agora_sync_log por el servicio.
    // Informar al usuario que el log fue guardado como referencia.
    setErrorDialogOpen(false);
    setPendingError(null);
    toast.success(
      "Registro de backup guardado en agora_sync_log con todos los detalles del error."
    );
    await cargarUltimoLog();
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  const statusCfg = lastLog ? STATUS_CONFIG[lastLog.status as AgoraSyncStatus] : null;

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Sincronización Ágora POS
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync(false)}
              disabled={syncing}
              className="h-8 gap-1.5"
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {syncing ? "Sincronizando…" : "Sincronizar"}
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          {loadingLog ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando estado…
            </div>
          ) : lastLog ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Último sync:</span>
                <span className="text-xs">{formatFecha(lastLog.sync_at)}</span>
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
                  <span className="text-green-600 font-medium">{lastLog.ok_records}</span>
                  {" ok / "}
                  {lastLog.total_records} total
                  {lastLog.error_records > 0 && (
                    <span className="text-red-500 ml-1">({lastLog.error_records} errores)</span>
                  )}
                </span>
              </div>
              {lastLog.retry_count > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reintentos:</span>
                  <span className="text-yellow-600">{lastLog.retry_count}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin sincronizaciones previas. Pulsa &ldquo;Sincronizar&rdquo; para conectar con Ágora.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Diálogo Regla Seguridad Ágora ─────────────────────────────────── */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Error de comunicación con Ágora
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p className="font-medium text-foreground">
                Balles, el botón &quot;Sincronizar Ágora&quot; ha fallado al comunicarse con Ágora.
              </p>
              {pendingError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs font-mono text-red-700 break-all">
                  {pendingError.mensaje}
                </div>
              )}
              {pendingError?.retryCount !== undefined && pendingError.retryCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Reintentos automáticos realizados: {pendingError.retryCount}/3
                </p>
              )}
              <p className="font-medium">¿Qué quieres hacer?</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleReintentar}
              disabled={syncing}
              className="w-full"
            >
              {syncing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Reintentando…</>
              ) : (
                <>Reintentar la conexión</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCrearBackup}
              className="w-full"
            >
              Crear registro de backup
            </Button>
            <Button
              variant="ghost"
              onClick={handleIgnorar}
              className="w-full text-muted-foreground"
            >
              Ignorar el error
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
