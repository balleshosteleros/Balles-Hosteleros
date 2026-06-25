import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EstadoPedidoBadge } from "./BadgesPedido";
import { ESTADOS_PEDIDO, PROVEEDOR_EMAILS, calcularTotalesLineas, type Pedido, type Albaran } from "@/features/logistica/data/pedidos";
import { ArrowLeft, FileText, MessageCircle, CheckCircle2, AlertTriangle, PackageCheck, Mail } from "lucide-react";

interface Props {
  pedido: Pedido;
  albaran: Albaran | null;
  onBack: () => void;
  onUpdateEstado: (id: string, estado: string) => void;
  onConfirmar: (pedido: Pedido) => void;
  onOpenAlbaran: (albaranId: string) => void;
  onEnviarProveedor: (pedido: Pedido) => void;
  onEnviarWhatsapp: (pedido: Pedido) => void;
}

export function DetallePedido({ pedido, albaran, onBack, onUpdateEstado, onConfirmar, onOpenAlbaran, onEnviarProveedor, onEnviarWhatsapp }: Props) {
  const totales = calcularTotalesLineas(pedido.lineas);
  const canConfirm = pedido.estado === "Borrador" || pedido.estado === "Pendiente";
  const canSend = pedido.estado !== "Borrador" && pedido.estado !== "Cancelado" && !pedido.enviadoAt;
  const proveedorEmail = PROVEEDOR_EMAILS[pedido.proveedor] || "";

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><FileText className="h-4 w-4" /> Guardar PDF</Button>
        <Button variant="outline" size="sm" className="gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20" onClick={() => onEnviarWhatsapp(pedido)}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
        {canSend && (
          <Button size="sm" variant="outline" className="gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20" onClick={() => onEnviarProveedor(pedido)}>
            <Mail className="h-4 w-4" /> Enviar al proveedor
          </Button>
        )}
        {canConfirm && (
          <Button size="sm" className="gap-1" onClick={() => onConfirmar(pedido)}><CheckCircle2 className="h-4 w-4" /> Confirmar pedido</Button>
        )}
      </div>

      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl font-black tracking-tight">{pedido.numero}</CardTitle>
            <EstadoPedidoBadge value={pedido.estado} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground text-xs block">Proveedor</span><span className="font-semibold">{pedido.proveedor}</span></div>
            <div><span className="text-muted-foreground text-xs block">Email proveedor</span><span className="font-medium">{proveedorEmail || <span className="text-destructive">Sin email configurado</span>}</span></div>
            <div><span className="text-muted-foreground text-xs block">Almacén</span><span className="font-medium">{pedido.almacen}</span></div>
            <div><span className="text-muted-foreground text-xs block">Fecha</span><span className="font-medium">{pedido.fecha}</span></div>
            <div><span className="text-muted-foreground text-xs block">Fecha Entrega</span><span className="font-medium">{pedido.fechaEntrega || "—"}</span></div>
            <div><span className="text-muted-foreground text-xs block">Creador</span><span className="font-medium">{pedido.creador}</span></div>
            <div>
              <span className="text-muted-foreground text-xs block">Estado</span>
              <Select value={pedido.estado} onValueChange={(v) => onUpdateEstado(pedido.id, v)}>
                <SelectTrigger className="h-8 text-xs w-[130px] border-0 p-0"><EstadoPedidoBadge value={pedido.estado} /></SelectTrigger>
                <SelectContent>{ESTADOS_PEDIDO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {pedido.enviadoAt && (
              <>
                <div><span className="text-muted-foreground text-xs block">Enviado el</span><span className="font-medium text-emerald-700 dark:text-emerald-400">{new Date(pedido.enviadoAt).toLocaleString("es-ES")}</span></div>
                <div><span className="text-muted-foreground text-xs block">Enviado a</span><span className="font-medium text-emerald-700 dark:text-emerald-400">{pedido.enviadoEmail}</span></div>
              </>
            )}
            {pedido.albaranId && (
              <div>
                <span className="text-muted-foreground text-xs block">Albarán vinculado</span>
                <Button variant="link" size="sm" className="p-0 h-auto text-primary gap-1" onClick={() => onOpenAlbaran(pedido.albaranId!)}>
                  <PackageCheck className="h-3.5 w-3.5" /> {albaran?.numero || pedido.albaranId}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">PRODUCTOS DEL PEDIDO</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                {["Producto", "Cantidad", "Unidad", "Servida", "Precio U.C.", "% Imp.", "Dto %", "Dto €", "Total €"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {pedido.lineas.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-3 py-2 font-medium text-foreground">{l.producto}</td>
                    <td className="px-3 py-2">{l.cantidad}</td>
                    <td className="px-3 py-2">{l.unidad}</td>
                    <td className="px-3 py-2">{l.servida}</td>
                    <td className="px-3 py-2">{l.precioUC.toFixed(2)} €</td>
                    <td className="px-3 py-2">{l.impuesto}%</td>
                    <td className="px-3 py-2">{l.dtoPct}%</td>
                    <td className="px-3 py-2">{l.dtoEur.toFixed(2)} €</td>
                    <td className="px-3 py-2 font-semibold">{l.total.toFixed(2)} €</td>
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
            <div className="flex justify-between"><span className="text-muted-foreground">Dto %</span><span>{pedido.dtoPct}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dto €</span><span>{pedido.dtoEur.toFixed(2)} €</span></div>
            <Separator />
            <div><span className="text-muted-foreground text-xs">Notas</span><p className="text-foreground mt-1">{pedido.notas || "—"}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">TOTALES</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span className="font-semibold">{totales.base.toFixed(2)} €</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cuota impuesto</span><span className="font-semibold">{totales.cuota.toFixed(2)} €</span></div>
            <Separator />
            <div className="flex justify-between text-lg font-black"><span>TOTAL</span><span>{totales.total.toFixed(2)} €</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {pedido.albaranId && (
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Este pedido tiene un albarán vinculado y no puede eliminarse.
        </div>
      )}
      {pedido.enviadoAt && !pedido.albaranId && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3">
          <Mail className="h-4 w-4 shrink-0" />
          Este pedido fue enviado al proveedor y no puede eliminarse.
        </div>
      )}
    </div>
  );
}
