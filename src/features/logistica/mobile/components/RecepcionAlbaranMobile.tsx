"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AlbaranUploadModal } from "@/features/logistica/components/pedidos/AlbaranUploadModal";
import { ComparativaAlbaran } from "@/features/logistica/components/pedidos/ComparativaAlbaran";
import { recibirAlbaranDesdePedido } from "@/features/logistica/actions/recepcion-movil-actions";
import { subirDocumentoAlbaran } from "@/features/logistica/actions/albaranes-actions";
import type { AnalisisAlbaran } from "@/features/logistica/data/pedidos";
import { Camera, Loader2, CheckCircle2, PackageCheck } from "lucide-react";

interface LineaRecepcion {
  id: string;
  productoId: string | null;
  producto: string;
  cantidadPedida: number;
  unidad: string;
  precioUC: number;
}

export function RecepcionAlbaranMobile({
  pedidoId,
  lineas,
}: {
  pedidoId: string;
  lineas: LineaRecepcion[];
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [recibido, setRecibido] = useState<Record<string, string>>(() =>
    Object.fromEntries(lineas.map((l) => [l.id, String(l.cantidadPedida)])),
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analisis, setAnalisis] = useState<AnalisisAlbaran | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{ numero?: string; aviso?: string } | null>(null);

  const parse = (v: string) => Number((v || "").replace(",", ".")) || 0;
  const setQty = (id: string, value: string) => {
    if (value === "" || /^\d*[.,]?\d*$/.test(value)) {
      setRecibido((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleFileReady = async (file: File) => {
    setUploadOpen(false);
    setAnalyzing(true);
    setFoto(file);
    try {
      const lineasRef = lineas.map((l) => ({
        producto: l.producto,
        cantidad: l.cantidadPedida,
        precioUC: l.precioUC,
        unidad: l.unidad,
      }));
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("analizar-albaran", {
        body: { imageBase64: base64, mimeType: file.type || "image/jpeg", lineasPedido: lineasRef },
      });
      if (error) throw error;
      const a = data as AnalisisAlbaran;
      setAnalisis(a);
      if (a?.resumen?.hayAlerta) {
        toast.warning("La foto muestra diferencias con el pedido. Revísalas abajo.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo analizar la foto. Puedes ajustar las cantidades a mano.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmar = async () => {
    setConfirming(true);
    try {
      const recibidos = lineas.map((l) => ({ lineaId: l.id, cantidad: parse(recibido[l.id]) }));
      if (recibidos.every((r) => r.cantidad <= 0)) {
        toast.error("Indica al menos una cantidad recibida.");
        setConfirming(false);
        return;
      }
      const res = await recibirAlbaranDesdePedido({ pedidoId, recibidos });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo confirmar la recepción");
        setConfirming(false);
        return;
      }
      // La foto es evidencia secundaria: la recepción ya está confirmada.
      if (foto && res.albaranId) {
        try {
          const fd = new FormData();
          fd.append("albaranId", res.albaranId);
          fd.append("file", foto);
          if (analisis) {
            fd.append("analisis", JSON.stringify(analisis));
            fd.append("hayAlerta", String(analisis.resumen.hayAlerta));
          }
          await subirDocumentoAlbaran(fd);
        } catch {
          toast.warning("Recepción confirmada, pero no se pudo guardar la foto.");
        }
      }
      setDone({ numero: res.numero, aviso: res.stockAviso });
      if (res.stockAviso) toast.warning(`Recepción confirmada. Aviso de stock: ${res.stockAviso}`);
      else toast.success("Recepción confirmada — stock actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar la recepción");
    } finally {
      setConfirming(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Recepción confirmada</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {done.numero ? `Albarán ${done.numero} creado. ` : ""}El stock se ha actualizado con lo recibido.
        </p>
        {done.aviso && (
          <p className="mt-2 max-w-xs text-xs text-amber-600 dark:text-amber-400">
            Aviso de stock: {done.aviso}
          </p>
        )}
        <Button className="mt-6" onClick={() => router.push("/m/albaranes")}>
          Volver a la bandeja
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Foto del albarán */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Haz una foto del albarán del proveedor para comprobar lo recibido contra el pedido. Es
            opcional: también puedes ajustar las cantidades a mano.
          </p>
          <Button
            variant="outline"
            className="mt-3 w-full gap-2"
            onClick={() => setUploadOpen(true)}
            disabled={analyzing}
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {analyzing ? "Analizando…" : foto ? "Repetir foto" : "Hacer foto del albarán"}
          </Button>
        </CardContent>
      </Card>

      {/* Comparativa pedido ↔ albarán */}
      {analisis && <ComparativaAlbaran analisis={analisis} />}

      {/* Cantidades recibidas (editables, precargadas con lo pedido) */}
      <div className="space-y-2.5">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cantidades recibidas
        </p>
        {lineas.map((l) => {
          const val = recibido[l.id] ?? "";
          const distinto = parse(val) !== l.cantidadPedida;
          return (
            <Card key={l.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">{l.producto}</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido: {l.cantidadPedida} {l.unidad}
                  </p>
                </div>
                <Input
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => setQty(l.id, e.target.value)}
                  aria-label={`Recibido de ${l.producto}`}
                  className={`h-10 w-20 text-center text-base font-semibold ${
                    distinto ? "border-amber-400 text-amber-700 dark:text-amber-400" : ""
                  }`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 px-2 text-xs text-muted-foreground"
                  onClick={() => setQty(l.id, "0")}
                >
                  No llegó
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmar — barra fija sobre el bottom-nav */}
      <div className="fixed inset-x-0 bottom-[84px] z-30 mx-auto max-w-screen-sm px-3">
        <Button
          className="w-full gap-2 shadow-lg"
          size="lg"
          onClick={handleConfirmar}
          disabled={confirming}
        >
          {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />}
          {confirming ? "Confirmando…" : "Confirmar recepción"}
        </Button>
      </div>

      <AlbaranUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onFileReady={handleFileReady} />
    </div>
  );
}
