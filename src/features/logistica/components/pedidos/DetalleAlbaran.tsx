import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatEur } from "@/shared/lib/numero";
import { EstadoAlbaranBadge } from "./BadgesPedido";
import { AlbaranUploadModal } from "./AlbaranUploadModal";
import { ComparativaAlbaran } from "./ComparativaAlbaran";
import { calcularTotalesLineas, diaSemanaDeFechaISO, formatoHoraReparto, type Albaran, type Pedido, type AnalisisAlbaran, type DocumentoAdjunto } from "@/features/logistica/data/pedidos";
import { updateAlbaranNumeroProveedor } from "@/features/logistica/actions/albaranes-actions";
import { ArrowLeft, FileText, Send, Paperclip, CheckCircle2, Loader2, AlertTriangle, FileWarning, Eye, Receipt, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

interface Props {
  albaran: Albaran;
  pedidoOrigen: Pedido | null;
  onBack: () => void;
  onEntregar: (albaran: Albaran) => void;
  onDelete?: (albaran: Albaran) => void;
  onGenerarFactura?: (albaran: Albaran) => void;
}

export function DetalleAlbaran({ albaran, pedidoOrigen, onBack, onEntregar, onDelete, onGenerarFactura }: Props) {
  const totales = calcularTotalesLineas(albaran.lineas);
  const diaReparto = pedidoOrigen?.fechaEntrega
    ? `${pedidoOrigen.fechaEntrega}${diaSemanaDeFechaISO(pedidoOrigen.fechaEntrega) ? ` · ${diaSemanaDeFechaISO(pedidoOrigen.fechaEntrega)}` : ""}`
    : "";
  const horaReparto = formatoHoraReparto(pedidoOrigen?.horaEntrega, pedidoOrigen?.horaEntregaHasta);
  const canEntregar = albaran.estado === "Pendiente";        // recepción → suma stock
  const canFacturar = albaran.estado === "Entregado";        // ya recepcionado → crear factura
  const canDelete = albaran.estado !== "Confirmado";         // si tiene factura, no se borra

  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analisisResult, setAnalisisResult] = useState<AnalisisAlbaran | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>([]);
  const [showComparativa, setShowComparativa] = useState(false);
  const [numProv, setNumProv] = useState<string>(albaran.numeroProveedor ?? "");

  const handleFileReady = async (file: File) => {
    setUploadOpen(false);
    setAnalyzing(true);
    setShowComparativa(false);
    setAnalisisResult(null);

    try {
      const lineasRef = pedidoOrigen
        ? pedidoOrigen.lineas.map((l) => ({ producto: l.producto, cantidad: l.cantidad, precioUC: l.precioUC, unidad: l.unidad }))
        : albaran.lineas.map((l) => ({ producto: l.producto, cantidad: l.cantidad, precioUC: l.precioUC, unidad: l.unidad }));

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

      const analisis = data as AnalisisAlbaran;
      setAnalisisResult(analisis);
      setShowComparativa(true);

      const newDoc: DocumentoAdjunto = {
        id: `doc-${Date.now()}`,
        fileName: file.name,
        fileUrl: "",
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: albaran.creador,
        analisis,
        hayAlerta: analisis.resumen.hayAlerta,
      };
      setDocumentos((prev) => [...prev, newDoc]);

      if (analisis.resumen.hayAlerta) {
        toast.warning("Se han detectado discrepancias en el albarán del proveedor");
      } else {
        toast.success("Albarán analizado correctamente. Sin discrepancias.");
      }
    } catch (err) {
      console.error("Error analyzing albaran:", err);
      const message = err instanceof Error ? err.message : "Error al analizar el albarán. Inténtalo de nuevo.";
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><FileText className="h-4 w-4" /> Guardar PDF</Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => {
          const asunto = encodeURIComponent(`Albarán ${albaran.numero}`);
          const cuerpo = encodeURIComponent(`Adjunto información del albarán ${albaran.numero} (${albaran.proveedor}).\nTotal: ${formatEur(totales.total)}`);
          window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
        }}><Send className="h-4 w-4" /> Enviar</Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setUploadOpen(true)}>
          <Paperclip className="h-4 w-4" /> Asociar archivo
        </Button>
        {canEntregar && (
          <Button size="sm" className="gap-1" onClick={() => onEntregar(albaran)}><CheckCircle2 className="h-4 w-4" /> Marcar entregado</Button>
        )}
        {canFacturar && onGenerarFactura && (
          <Button size="sm" className="gap-1" onClick={() => onGenerarFactura(albaran)}>
            <Receipt className="h-4 w-4" /> Crear factura
          </Button>
        )}
        {canDelete && onDelete && (
          <Button size="sm" variant="outline" className="gap-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Borrar
          </Button>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar albarán?</AlertDialogTitle>
            <AlertDialogDescription>
              Se devolverá el stock recepcionado y el pedido de origen volverá a ser editable (a <strong>Enviado</strong> si se había enviado por correo, o a <strong>Pendiente</strong> si no). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmDelete(false); onDelete?.(albaran); }}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Analyzing state */}
      {analyzing && (
        <Card className="border-primary/30">
          <CardContent className="flex items-center justify-center gap-4 py-10">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <div>
              <p className="font-semibold text-foreground">Analizando albarán del proveedor…</p>
              <p className="text-sm text-muted-foreground">Leyendo productos, cantidades y precios. Esto puede tardar unos segundos.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert badge */}
      {documentos.some((d) => d.hayAlerta) && !showComparativa && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <FileWarning className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">ALERTA — Discrepancias en albarán del proveedor</p>
            <p className="text-xs text-red-600 dark:text-red-400/80">Se han detectado diferencias entre el pedido interno y el albarán recibido.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400" onClick={() => setShowComparativa(true)}>
            <Eye className="h-4 w-4" /> Ver comparativa
          </Button>
        </div>
      )}

      {/* Comparativa */}
      {showComparativa && analisisResult && (
        <ComparativaAlbaran analisis={analisisResult} />
      )}

      {/* Documentos adjuntos */}
      {documentos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">DOCUMENTOS ADJUNTOS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documentos.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(doc.uploadedAt).toLocaleString("es-ES")} — {doc.uploadedBy}</p>
                  </div>
                  {doc.hayAlerta ? (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px] gap-1 shrink-0">
                      <AlertTriangle className="h-3 w-3" /> Alerta
                    </Badge>
                  ) : doc.analisis ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px] gap-1 shrink-0">
                      <CheckCircle2 className="h-3 w-3" /> Verificado
                    </Badge>
                  ) : null}
                  {doc.analisis && (
                    <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => { setAnalisisResult(doc.analisis); setShowComparativa(true); }}>
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl font-black tracking-tight">{albaran.numero}</CardTitle>
            <div className="flex items-center gap-2">
              {documentos.some((d) => d.hayAlerta) && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
                  <AlertTriangle className="h-3 w-3" /> ALERTA
                </Badge>
              )}
              <EstadoAlbaranBadge value={albaran.estado} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground text-xs block">Proveedor</span><span className="font-semibold">{albaran.proveedor}</span></div>
            <div>
              <span className="text-muted-foreground text-xs block">Nº albarán del proveedor</span>
              <Input
                value={numProv}
                onChange={(e) => setNumProv(e.target.value)}
                onBlur={async () => {
                  const next = numProv.trim() || null;
                  if (next === (albaran.numeroProveedor ?? null)) return;
                  const res = await updateAlbaranNumeroProveedor(albaran.id, next);
                  if (res.ok) toast.success("Nº proveedor actualizado");
                  else toast.error(res.error ?? "No se pudo guardar");
                }}
                placeholder="(según factura del proveedor)"
                className="h-8 text-sm font-medium mt-0.5"
              />
            </div>
            <div><span className="text-muted-foreground text-xs block">Almacén</span><span className="font-medium">{albaran.almacen}</span></div>
            <div><span className="text-muted-foreground text-xs block">Fecha</span><span className="font-medium">{albaran.fecha}</span></div>
            {diaReparto && <div><span className="text-muted-foreground text-xs block">Día de reparto</span><span className="font-medium">{diaReparto}</span></div>}
            {horaReparto && <div><span className="text-muted-foreground text-xs block">Hora de reparto</span><span className="font-medium">{horaReparto}</span></div>}
            <div><span className="text-muted-foreground text-xs block">Pedido origen</span><span className="font-medium">{albaran.pedidoId}</span></div>
            <div><span className="text-muted-foreground text-xs block">Creador</span><span className="font-medium">{albaran.creador}</span></div>
            <div>
              <span className="text-muted-foreground text-xs block">Estado</span>
              <div className="mt-0.5"><EstadoAlbaranBadge value={albaran.estado} /></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">PRODUCTOS DEL ALBARÁN</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                {["Producto", "Cantidad", "Unidad", "Precio U.C.", "% Imp.", "Dto %", "Dto €", "Total €", "Doc. Pedido"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {albaran.lineas.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-3 py-2 font-medium text-foreground">{l.producto}</td>
                    <td className="px-3 py-2">{l.cantidad}</td>
                    <td className="px-3 py-2">{l.unidad}</td>
                    <td className="px-3 py-2">{formatEur(l.precioUC)}</td>
                    <td className="px-3 py-2">{l.impuesto}%</td>
                    <td className="px-3 py-2">{l.dtoPct}%</td>
                    <td className="px-3 py-2">{formatEur(l.dtoEur)}</td>
                    <td className="px-3 py-2 font-semibold">{formatEur(l.total)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.docPedido}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pie + Totales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">PIE</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Dto %</span><span>{albaran.dtoPct}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dto €</span><span>{formatEur(albaran.dtoEur)}</span></div>
            <Separator />
            <div><span className="text-muted-foreground text-xs">Notas</span><p className="text-foreground mt-1">{albaran.notas || "—"}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">TOTALES</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span className="font-semibold">{formatEur(totales.base)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cuota impuesto</span><span className="font-semibold">{formatEur(totales.cuota)}</span></div>
            <Separator />
            <div className="flex justify-between text-lg font-black"><span>TOTAL</span><span>{formatEur(totales.total)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Upload modal */}
      <AlbaranUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onFileReady={handleFileReady} />
    </div>
  );
}
