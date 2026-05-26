"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Camera,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  analizarFacturaVsAlbaran,
  getAdjuntoSignedUrl,
  getFactura,
  resolverDiscrepancia,
  subirAdjuntoFactura,
  updateNumeroFacturaProveedor,
  validarFactura,
} from "@/features/logistica/actions/facturas-actions";
import type { Factura } from "@/features/logistica/types/facturas";
import { FacturaComparativa } from "./FacturaComparativa";

interface Props {
  open: boolean;
  facturaId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const FORMATOS_ACEPTADOS = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

export function FacturaDialog({ open, facturaId, onOpenChange, onChanged }: Props) {
  const [factura, setFactura] = useState<Factura | null>(null);
  const [loading, setLoading] = useState(false);
  const [adjuntoUrl, setAdjuntoUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const recargar = useCallback(async () => {
    if (!facturaId) return;
    setLoading(true);
    try {
      const res = await getFactura(facturaId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFactura(res.data);
      if (res.data.adjuntoPath) {
        const url = await getAdjuntoSignedUrl(facturaId);
        if (url.ok) setAdjuntoUrl(url.data.url);
      } else {
        setAdjuntoUrl(null);
      }
    } finally {
      setLoading(false);
    }
  }, [facturaId]);

  useEffect(() => {
    if (open && facturaId) void recargar();
    if (!open) {
      setFactura(null);
      setAdjuntoUrl(null);
    }
  }, [open, facturaId, recargar]);

  const handleSubirArchivo = useCallback(
    (file: File) => {
      if (!facturaId) return;
      startTransition(async () => {
        const fd = new FormData();
        fd.append("facturaId", facturaId);
        fd.append("file", file);
        const res = await subirAdjuntoFactura(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Adjunto subido");
        await recargar();
        onChanged?.();
      });
    },
    [facturaId, recargar, onChanged],
  );

  const handleAnalizar = useCallback(() => {
    if (!facturaId) return;
    startTransition(async () => {
      const res = await analizarFacturaVsAlbaran(facturaId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.resumen.hayAlerta
          ? `Análisis OK — ${res.data.resumen.diferencias + res.data.resumen.extras + res.data.resumen.faltantes} discrepancias`
          : "Análisis OK — sin discrepancias",
      );
      await recargar();
      onChanged?.();
    });
  }, [facturaId, recargar, onChanged]);

  const handleResolver = useCallback(
    (
      lineaId: string,
      resolucion: "acepto_proveedor" | "mantengo_sistema" | "editado_manual",
      valores?: { cantidad?: number; precioUnitario?: number; ivaPorcentaje?: number },
    ) => {
      if (!facturaId) return;
      startTransition(async () => {
        const res = await resolverDiscrepancia({
          facturaId,
          lineaId,
          resolucion,
          ...valores,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        await recargar();
        onChanged?.();
      });
    },
    [facturaId, recargar, onChanged],
  );

  const handleValidar = useCallback(() => {
    if (!facturaId) return;
    startTransition(async () => {
      const res = await validarFactura({ facturaId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Factura validada");
      onOpenChange(false);
      onChanged?.();
    });
  }, [facturaId, onOpenChange, onChanged]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleSubirArchivo(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {factura?.numero ?? "Factura"} ·{" "}
            <Badge variant="outline" className="text-xs">
              {factura?.estado ?? "—"}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Adjunta la factura del proveedor (PDF o foto), compara con el albarán y resuelve discrepancias.
          </DialogDescription>
        </DialogHeader>

        {loading || !factura ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 overflow-hidden">
            {/* Panel izquierdo: cabecera + comparativa */}
            <div className="overflow-y-auto pr-2 space-y-4">
              <CabeceraFactura factura={factura} onChanged={recargar} />
              <FacturaComparativa
                lineas={factura.lineas}
                comparativa={factura.comparativaResultado}
                onResolver={handleResolver}
                busy={isPending}
              />
            </div>

            {/* Panel derecho: adjunto */}
            <div className="flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Factura del proveedor
                </Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={FORMATOS_ACEPTADOS}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSubirArchivo(f);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSubirArchivo(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending}
                  >
                    <Upload className="h-3.5 w-3.5" /> Subir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isPending}
                  >
                    <Camera className="h-3.5 w-3.5" /> Cámara
                  </Button>
                </div>
              </div>

              <div
                className={`flex-1 rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden ${
                  isDragging ? "border-primary bg-primary/5" : "border-border"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
              >
                {adjuntoUrl ? (
                  factura.adjuntoMime?.startsWith("image/") ? (
                    <img
                      src={adjuntoUrl}
                      alt={factura.adjuntoNombre ?? "Factura"}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={adjuntoUrl}
                      title="Factura PDF"
                      className="h-full w-full"
                    />
                  )
                ) : (
                  <div className="text-center p-6 text-xs text-muted-foreground space-y-2">
                    <Upload className="h-8 w-8 mx-auto opacity-50" />
                    <div>Arrastra el PDF o la foto aquí</div>
                    <div className="text-[10px]">
                      Formatos: PDF, JPG, PNG, WEBP, HEIC · máx 20 MB
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleAnalizar}
                disabled={!factura.adjuntoPath || isPending}
                className="gap-2"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Comparar con OCR
              </Button>
              {!factura.albaranId && (
                <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] p-2 flex gap-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Esta factura no tiene albarán de origen. El OCR extraerá las líneas pero no habrá comparativa contra el sistema.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cerrar
          </Button>
          <Button
            onClick={handleValidar}
            disabled={
              !factura ||
              !factura.adjuntoPath ||
              isPending ||
              factura.estado === "Validada" ||
              factura.lineas.some(
                (l) => l.discrepanciaTipo !== null && l.discrepanciaResolucion === null,
              )
            }
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Validar factura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CabeceraFactura({
  factura,
  onChanged,
}: {
  factura: Factura;
  onChanged?: () => void;
}) {
  const [numProv, setNumProv] = useState<string>(factura.numeroFacturaProveedor ?? "");

  useEffect(() => {
    setNumProv(factura.numeroFacturaProveedor ?? "");
  }, [factura.numeroFacturaProveedor]);

  return (
    <div className="rounded-md border bg-card p-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
      <CampoLectura label="Proveedor" value={factura.proveedorNombre || "—"} />
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Nº factura del proveedor
        </div>
        <Input
          value={numProv}
          onChange={(e) => setNumProv(e.target.value)}
          onBlur={async () => {
            const next = numProv.trim() || null;
            if (next === (factura.numeroFacturaProveedor ?? null)) return;
            const res = await updateNumeroFacturaProveedor(factura.id, next);
            if (res.ok) {
              toast.success("Nº proveedor actualizado");
              onChanged?.();
            } else {
              toast.error(res.error);
            }
          }}
          placeholder="(según factura del proveedor)"
          className="h-7 text-sm mt-0.5"
        />
      </div>
      <CampoLectura label="Fecha factura" value={factura.fechaFactura || "—"} />
      <CampoLectura label="Recepción" value={factura.fechaRecepcion} />
      <CampoLectura label="Base" value={`${factura.baseImponible.toFixed(2)} €`} />
      <CampoLectura label="IVA" value={`${factura.ivaTotal.toFixed(2)} €`} />
      <CampoLectura label="Total" value={`${factura.total.toFixed(2)} €`} className="font-semibold" />
      <CampoLectura label="Albarán" value={factura.albaranId ? "Vinculado" : "Huérfana"} />
    </div>
  );
}

function CampoLectura({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm ${className ?? ""}`}>{value}</div>
    </div>
  );
}
