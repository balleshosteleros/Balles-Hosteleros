"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, Link2, Link2Off } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getConexionAgora,
  updateAgoraId,
  type ConexionAgora,
} from "@/features/logistica/actions/conexion-agora-actions";
import { toast } from "sonner";

/** Conexión con Ágora del producto: ID de Ágora (editable), nombre con que lo vende Ágora
 *  y si se ha vendido. "Configurable desde Balles" (PRP-057). */
export function ConexionAgoraSection({ productoId }: { productoId: string }) {
  const [info, setInfo] = useState<ConexionAgora | null>(null);
  const [agoraId, setAgoraId] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardado, setGuardado] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getConexionAgora(productoId).then((res) => {
      if (cancelled) return;
      setInfo(res);
      setAgoraId(res.agoraId ?? "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [productoId]);

  function guardar() {
    setGuardado(false);
    startTransition(async () => {
      const res = await updateAgoraId(productoId, agoraId);
      if (res.ok) {
        setInfo((prev) => (prev ? { ...prev, agoraId: agoraId.trim() } : prev));
        setGuardado(true);
        setTimeout(() => setGuardado(false), 2000);
      } else {
        toast.error(res.error ?? "No se pudo guardar el ID de Ágora");
      }
    });
  }

  const cambiado = (info?.agoraId ?? "") !== (agoraId.trim() || "");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {info?.agoraId ? (
            <Link2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Link2Off className="h-4 w-4 text-muted-foreground" />
          )}
          Conexión con Ágora
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted-foreground">
                ID de Ágora
                <input
                  value={agoraId}
                  onChange={(e) => setAgoraId(e.target.value)}
                  placeholder="Ej: 2414"
                  className="mt-1 block w-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <Button size="sm" onClick={guardar} disabled={isPending || !cambiado} className="gap-1">
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : guardado ? (
                  <Check className="h-4 w-4" />
                ) : null}
                {guardado ? "Guardado" : "Guardar"}
              </Button>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Nombre en Ágora:</span>
                <span className="font-medium">{info?.nombreAgora ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Se vende en Ágora:</span>
                {info?.vendidoEnAgora ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Sí · {info.unidadesVendidas.toLocaleString("es-ES", { maximumFractionDigits: 0 })} uds
                  </Badge>
                ) : (
                  <Badge variant="secondary">Todavía no</Badge>
                )}
              </div>
              {info?.ultimaVenta && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Última venta:</span>
                  <span className="font-medium">
                    {new Date(info.ultimaVenta).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {!info?.agoraId && (
              <p className="text-[11px] text-muted-foreground">
                Sin ID de Ágora, las ventas de este producto en el TPV no se cruzan con Balles
                (no descontarán stock).
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
