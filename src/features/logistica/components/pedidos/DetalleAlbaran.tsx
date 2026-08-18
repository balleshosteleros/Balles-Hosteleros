import { useEffect, useState } from "react";
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
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { updateAlbaranNumeroProveedor, marcarAlbaranCompleto } from "@/features/logistica/actions/albaranes-actions";
import { adjuntarDocumentoDesdeImportacion } from "@/features/logistica/actions/importaciones-albaran-actions";
import { analizarFotoContraPedido } from "@/features/logistica/lib/albaranes/analizar-foto-contra-pedido";
import {
  emparejarLineasAlbaran,
  resolverAlbaranRevision,
  type LineaEmparejada,
} from "@/features/logistica/actions/asistente-albaran-actions";
import { listCategoriasProducto } from "@/features/logistica/actions/categorias-producto-actions";
import { listarIncidenciasAlbaran } from "@/features/logistica/actions/incidencias-albaran-actions";
import { AsistenteAlbaranPanel } from "@/features/logistica/components/albaranes/AsistenteAlbaranPanel";
import { ArrowLeft, FileText, Send, Paperclip, CheckCircle2, Loader2, AlertTriangle, FileWarning, Eye, Receipt, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Props {
  albaran: Albaran;
  pedidoOrigen: Pedido | null;
  zonaHoraria: string;
  onBack: () => void;
  onEntregar: (albaran: Albaran) => void;
  onDelete?: (albaran: Albaran) => void;
  onGenerarFactura?: (albaran: Albaran) => void;
  /** Tras confirmar un albarán en Revisión (asistente): el padre recarga y refresca el detalle. */
  onConfirmadoRevision?: () => void;
}

/** Campos extra que el flujo "subir por foto" guarda en cada línea del jsonb. */
type LineaConOrigen = Albaran["lineas"][number] & { nombreProveedor?: string; ignorada?: boolean };

export function DetalleAlbaran({ albaran, pedidoOrigen, zonaHoraria, onBack, onEntregar, onDelete, onGenerarFactura, onConfirmadoRevision }: Props) {
  const totales = calcularTotalesLineas(albaran.lineas);
  const diaReparto = pedidoOrigen?.fechaEntrega
    ? `${pedidoOrigen.fechaEntrega}${diaSemanaDeFechaISO(pedidoOrigen.fechaEntrega) ? ` · ${diaSemanaDeFechaISO(pedidoOrigen.fechaEntrega)}` : ""}`
    : "";
  const horaReparto = formatoHoraReparto(pedidoOrigen?.horaEntrega, pedidoOrigen?.horaEntregaHasta);
  const canEntregar = albaran.estado === "Pendiente";        // recepción → suma stock
  const canFacturar = albaran.estado === "Entregado";        // ya recepcionado → crear factura
  const canDelete = albaran.estado !== "Confirmado";         // si tiene factura, no se borra
  // "Revisión" = subido por foto con líneas sin resolver: se resuelve con el asistente y
  // SOLO al confirmar entra el stock. Sin Entregar/Facturar hasta entonces.
  const enRevision = albaran.estado === "Revisión";

  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analisisResult, setAnalisisResult] = useState<AnalisisAlbaran | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>(albaran.documentos ?? []);
  const [showComparativa, setShowComparativa] = useState(false);
  const [numProv, setNumProv] = useState<string>(albaran.numeroProveedor ?? "");
  // Documento incompleto (falta una página): estado local para reflejar "ya está completo".
  const [parcial, setParcial] = useState<boolean>(albaran.documentoParcial === true);
  const [completando, setCompletando] = useState(false);

  // ── Asistente (solo en Revisión): emparejar huérfanas + categorías para "crear producto" ──
  const [asistLineas, setAsistLineas] = useState<LineaEmparejada[] | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  // Decisiones "crear producto" tomadas en la mesa de incidencias durante la subida:
  // la mesa no puede crearlos (falta la categoría), así que la intención viaja hasta
  // aquí y el asistente abre directo en el formulario de crear.
  const [intencionesCrear, setIntencionesCrear] = useState<Record<string, { iva?: string | null }>>({});
  const lineasConOrigen = albaran.lineas as LineaConOrigen[];
  const huerfanas = lineasConOrigen.filter((l) => !l.productoId && l.ignorada !== true);
  const resueltas = lineasConOrigen.filter((l) => !!l.productoId);

  useEffect(() => {
    if (!enRevision) return;
    let alive = true;
    (async () => {
      const [cats, emp, incs] = await Promise.all([
        listCategoriasProducto("compra"),
        emparejarLineasAlbaran(
          huerfanas.map((l) => ({
            id: l.id,
            // El texto del proveedor es la clave de matching (y del alias a memorizar).
            nombre: l.nombreProveedor ?? l.producto,
            cantidad: l.cantidad,
            precioUnitario: l.precioUC || null,
          })),
        ),
        listarIncidenciasAlbaran(albaran.id),
      ]);
      if (!alive) return;
      if (cats.ok) setCategorias(cats.data.map((c) => c.nombre));
      setAsistLineas(emp.ok ? emp.lineas : []);
      if (incs.ok) {
        const crear: Record<string, { iva?: string | null }> = {};
        for (const inc of incs.incidencias) {
          if (inc.lineaId && inc.decision?.accion === "crear") {
            crear[inc.lineaId] = { iva: (inc.decision.payload?.iva as string | undefined) ?? null };
          }
        }
        setIntencionesCrear(crear);
      }
    })();
    return () => { alive = false; };
    // huerfanas se deriva de albaran.lineas; el albarán es inmutable mientras está montado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enRevision, albaran.id]);

  // Autosave (F5): cada resolución del asistente se guarda al vuelo en el jsonb del
  // albarán (resolverAlbaranRevision con confirmar=false ya sabía guardar progreso
  // parcial — solo faltaba llamarlo). Una recarga ya no pierde el trabajo hecho.
  const handleResolucionParcial = (
    lineaId: string,
    res: { productoId: string | null; ignorada: boolean; motivoIgnorada?: string },
  ) => {
    void resolverAlbaranRevision(albaran.id, { [lineaId]: res }, false).then((r) => {
      if (!r.ok) {
        toast.warning(
          "No se pudo guardar el progreso de esa línea — se aplicará igualmente al confirmar.",
        );
      }
    });
  };

  const handleConfirmarRevision = async (
    resoluciones: Record<
      string,
      // motivoIgnorada (PRP-074 F4): viaja hasta el jsonb de la línea.
      { productoId: string | null; ignorada: boolean; motivoIgnorada?: string }
    >,
  ) => {
    setConfirmando(true);
    const res = await resolverAlbaranRevision(albaran.id, resoluciones, true);
    setConfirmando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo confirmar el albarán");
      return;
    }
    if (res.stockAviso) toast.warning(res.stockAviso);
    toast.success(
      `Albarán confirmado — stock actualizado${res.preciosRegistrados ? ` y ${res.preciosRegistrados} precio(s) registrados` : ""}`,
    );
    onConfirmadoRevision?.();
  };

  const handleFileReady = async (file: File) => {
    setUploadOpen(false);
    setAnalyzing(true);
    setShowComparativa(false);
    setAnalisisResult(null);

    try {
      const lineasRef = pedidoOrigen
        ? pedidoOrigen.lineas.map((l) => ({ producto: l.producto, cantidad: l.cantidad, precioUC: l.precioUC, unidad: l.unidad }))
        : albaran.lineas.map((l) => ({ producto: l.producto, cantidad: l.cantidad, precioUC: l.precioUC, unidad: l.unidad }));

      // PRP-073 F6: mismo camino fiable que el alta libre (compresión + subida
      // directa + extractor único), sin la Edge Function no versionada.
      const res = await analizarFotoContraPedido(file, lineasRef, pedidoOrigen?.id ?? null);
      if (!res.ok) throw new Error(res.error);

      const analisis = res.analisis;
      setAnalisisResult(analisis);
      setShowComparativa(true);

      // El original ya vive en Storage (importación): se mueve al path del albarán.
      const persistRes = await adjuntarDocumentoDesdeImportacion({
        albaranId: albaran.id,
        importacionId: res.importacionId,
        analisis,
        hayAlerta: analisis.resumen.hayAlerta,
        uploadedBy: albaran.creador,
      });
      if (persistRes.ok) {
        setDocumentos((prev) => [...prev, persistRes.data as unknown as DocumentoAdjunto]);
      } else {
        toast.error(persistRes.message ?? "No se pudo guardar el documento adjunto");
      }

      if (analisis.resumen.hayAlerta) {
        toast.warning("Se han detectado discrepancias en el albarán del proveedor");
      } else if (persistRes.ok) {
        toast.success("Albarán analizado y guardado. Sin discrepancias.");
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
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><FileText className="h-4 w-4" /> Imprimir</Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => {
          const asunto = encodeURIComponent(`Albarán ${albaran.numero}`);
          const cuerpo = encodeURIComponent(`Adjunto información del albarán ${albaran.numero} (${albaran.proveedor}).\nTotal: ${formatEur(totales.total)}`);
          window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
        }}><Send className="h-4 w-4" /> Enviar por correo</Button>
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
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Alerta — discrepancias en el albarán del proveedor</p>
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
            <CardTitle className="text-base">Documentos adjuntos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documentos.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatFechaHoraEnZona(doc.uploadedAt, zonaHoraria)} — {doc.uploadedBy}</p>
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
                  <AlertTriangle className="h-3 w-3" /> Alerta
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
            <div><span className="text-muted-foreground text-xs block">Pedido origen</span><span className="font-medium">{pedidoOrigen?.numero || "—"}</span></div>
            <div><span className="text-muted-foreground text-xs block">Creador</span><span className="font-medium">{albaran.creador}</span></div>
            <div>
              <span className="text-muted-foreground text-xs block">Estado</span>
              <div className="mt-0.5"><EstadoAlbaranBadge value={albaran.estado} /></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documento incompleto: se guardó a sabiendas de que falta una página. Bloquea la
          confirmación (RPC) hasta que se adjunten las páginas y alguien lo dé por completo. */}
      {parcial && (
        <Card className="border-red-300 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-red-600" />
              A este albarán le falta al menos una página
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se guardó como incompleto
              {albaran.paginasEsperadas ? ` (el papel decía ${albaran.paginasEsperadas} páginas)` : ""}.
              No se puede confirmar hasta completarlo: adjunta la foto de la página que falta con
              «Adjuntar» (arriba), añade sus líneas si procede, y márcalo como completo.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={completando}
              onClick={async () => {
                setCompletando(true);
                const r = await marcarAlbaranCompleto(albaran.id);
                setCompletando(false);
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo marcar como completo");
                  return;
                }
                setParcial(false);
                toast.success("Albarán marcado como completo: ya se puede confirmar");
              }}
            >
              {completando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Ya está completo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Asistente de resolución (solo en Revisión) */}
      {enRevision && (
        <Card className="border-orange-300 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Albarán en revisión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {resueltas.length} línea(s) reconocidas automáticamente
              {huerfanas.length > 0
                ? ` y ${huerfanas.length} por resolver. Vincula, crea o ignora cada producto y confirma: al confirmar entra el stock y se registran los precios.`
                : ". Todo resuelto: confirma para que entre el stock y se registren los precios."}
            </p>
            {asistLineas === null ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparando el asistente…
              </div>
            ) : (
              <AsistenteAlbaranPanel
                key={albaran.id}
                lineas={asistLineas}
                lineasYaVinculadas={resueltas
                  .filter((l) => l.ignorada !== true)
                  .map((l) => ({
                    nombre: l.producto,
                    cantidad: l.cantidad,
                    precioUnitario: l.precioUC || null,
                  }))}
                intencionesCrear={intencionesCrear}
                onResolucion={handleResolucionParcial}
                proveedorAlbaran={albaran.proveedor}
                categorias={categorias}
                onConfirmar={handleConfirmarRevision}
                confirmando={confirmando}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Productos del albarán.
          En Revisión NO se pinta: el asistente de arriba ya lista las mismas líneas para
          resolverlas una a una, y repetirlas aquí debajo mostraba cada producto dos veces
          (un albarán de 23 líneas se veía como 46 filas). Al confirmar, el asistente
          desaparece y esta tabla pasa a ser la vista del albarán. */}
      {!enRevision && (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Productos del albarán</CardTitle></CardHeader>
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
      )}

      {/* Pie + Totales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pie</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Dto %</span><span>{albaran.dtoPct}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dto €</span><span>{formatEur(albaran.dtoEur)}</span></div>
            <Separator />
            <div><span className="text-muted-foreground text-xs">Notas</span><p className="text-foreground mt-1">{albaran.notas || "—"}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Totales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span className="font-semibold">{formatEur(totales.base)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cuota impuesto</span><span className="font-semibold">{formatEur(totales.cuota)}</span></div>
            <Separator />
            <div className="flex justify-between text-lg font-black"><span>Total</span><span>{formatEur(totales.total)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Upload modal */}
      <AlbaranUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onFileReady={handleFileReady} />
    </div>
  );
}
