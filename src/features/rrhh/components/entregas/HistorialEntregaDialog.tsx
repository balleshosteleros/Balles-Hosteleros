"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Eye, FileText, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { getHistorialEntrega } from "@/features/rrhh/actions/entregas-actions";
import {
  getDescargaFirmadoUrl,
  getVisorFirmadoUrl,
} from "@/features/rrhh/actions/firmas-actions";
import type { ActaEntrega, Entrega } from "@/features/rrhh/data/entregas";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

/**
 * Historial de una entrega: qué actas se le han mandado al trabajador, a qué
 * hora salió cada correo, si hubo que reenviarlo, cuándo lo abrió y cuándo
 * firmó — y el PDF firmado, que es la prueba.
 *
 * Antes esto no se veía en ningún sitio: la pantalla solo decía "firmada", sin
 * el documento ni el rastro de los envíos.
 */
const ETIQUETA_ACTA: Record<ActaEntrega["tipo"], string> = {
  entrega: "Entrega",
  devolucion: "Devolución",
  merma: "Baja por deterioro",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Esperando su firma",
  firmado: "Firmado",
  rechazado: "Rechazado",
  expirado: "Anulado",
};

export function HistorialEntregaDialog({
  entrega,
  onOpenChange,
}: {
  /** La entrega cuyo historial se mira. Null = diálogo cerrado. */
  entrega: Entrega | null;
  onOpenChange: (abierto: boolean) => void;
}) {
  const { empresaActual } = useEmpresa();
  const [actas, setActas] = useState<ActaEntrega[] | null>(null);
  const [cargando, setCargando] = useState(false);
  /** Documento cuyo PDF se está abriendo, para no repetir el clic. */
  const [abriendo, setAbriendo] = useState<string | null>(null);

  const fechaHora = useCallback(
    (iso: string | null): string =>
      formatFechaHoraEnZona(iso, empresaActual?.zonaHoraria ?? "") || "—",
    [empresaActual?.zonaHoraria],
  );

  useEffect(() => {
    if (!entrega) { setActas(null); return; }
    let vigente = true;
    setCargando(true);
    void getHistorialEntrega(entrega.id).then((res) => {
      if (!vigente) return;
      setCargando(false);
      if (!res.ok) { toast.error(res.error); setActas([]); return; }
      setActas(res.actas);
    });
    return () => { vigente = false; };
  }, [entrega]);

  async function ver(documentoId: string) {
    setAbriendo(documentoId);
    const res = await getVisorFirmadoUrl(documentoId);
    setAbriendo(null);
    if (!res.ok) { toast.error(res.error); return; }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function descargar(documentoId: string) {
    setAbriendo(documentoId);
    const res = await getDescargaFirmadoUrl(documentoId);
    setAbriendo(null);
    if (!res.ok) { toast.error(res.error); return; }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={entrega !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de la entrega</DialogTitle>
          <DialogDescription>
            {entrega
              ? `${entrega.item?.tipoNombre ?? "Material"} de ${entrega.empleadoNombre}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!cargando && actas?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Todavía no se le ha mandado ningún documento a firmar.
          </p>
        )}

        {!cargando && actas && actas.length > 0 && (
          <div className="space-y-4">
            {actas.map((acta) => (
              <div key={acta.documentoId} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {ETIQUETA_ACTA[acta.tipo]}
                    </span>
                    <Badge variant={acta.estado === "firmado" ? "default" : "secondary"}>
                      {ETIQUETA_ESTADO[acta.estado] ?? acta.estado}
                    </Badge>
                  </div>

                  {/* El PDF firmado solo existe cuando lo ha firmado. */}
                  {acta.tieneDocumentoFirmado && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={abriendo === acta.documentoId}
                        onClick={() => void ver(acta.documentoId)}
                      >
                        {abriendo === acta.documentoId ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4 mr-1" />
                        )}
                        Ver documento
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={abriendo === acta.documentoId}
                        onClick={() => void descargar(acta.documentoId)}
                        title="Descargar el documento firmado"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Cuántas veces se le insistió, de un vistazo. */}
                {acta.reenvios > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-500">
                    <Mail className="h-3.5 w-3.5" />
                    {acta.reenvios === 1
                      ? "Se le reenvió el correo 1 vez"
                      : `Se le reenvió el correo ${acta.reenvios} veces`}
                  </p>
                )}

                <ol className="space-y-2 border-l pl-4">
                  {acta.hitos.map((h, i) => (
                    <li key={`${acta.documentoId}-${i}`} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/40" />
                      <span className="text-foreground">{h.titulo}</span>
                      <span className="text-muted-foreground"> · {fechaHora(h.fecha)}</span>
                      {h.detalle && (
                        <span className="block text-xs text-muted-foreground">
                          {h.detalle}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
