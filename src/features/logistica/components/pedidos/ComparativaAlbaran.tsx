import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Package, Info } from "lucide-react";
import type { AnalisisAlbaran } from "@/features/logistica/data/pedidos";

interface Props {
  analisis: AnalisisAlbaran;
}

function TipoBadge({ tipo }: { tipo: string }) {
  switch (tipo) {
    case "coincide":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">Correcto</Badge>;
    case "cantidad_diferente":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]">Cantidad diferente</Badge>;
    case "precio_diferente":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]">Precio diferente</Badge>;
    case "cantidad_y_precio":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]">Cant. y precio dif.</Badge>;
    case "extra":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px]">Extra (no pedido)</Badge>;
    case "faltante":
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-[10px]">Faltante</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{tipo}</Badge>;
  }
}

export function ComparativaAlbaran({ analisis }: Props) {
  const { datosAlbaran, lineas, resumen } = analisis;
  const hayAlerta = resumen.hayAlerta;

  return (
    <div className="space-y-4">
      {/* Header alerta */}
      {hayAlerta ? (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">ALERTA — Discrepancias detectadas</p>
            <p className="text-xs text-red-600 dark:text-red-400/80">
              {resumen.diferencias} diferencia(s), {resumen.extras} producto(s) extra, {resumen.faltantes} producto(s) faltante(s)
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">Sin discrepancias</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400/80">El albarán del proveedor coincide con el pedido interno.</p>
          </div>
        </div>
      )}

      {/* Datos generales del albarán */}
      {datosAlbaran && (datosAlbaran.proveedor || datosAlbaran.numero || datosAlbaran.fecha) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Datos leídos del albarán</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {datosAlbaran.proveedor && <div><span className="text-muted-foreground text-xs block">Proveedor</span><span className="font-medium">{datosAlbaran.proveedor}</span></div>}
              {datosAlbaran.numero && <div><span className="text-muted-foreground text-xs block">Nº Albarán</span><span className="font-medium">{datosAlbaran.numero}</span></div>}
              {datosAlbaran.fecha && <div><span className="text-muted-foreground text-xs block">Fecha</span><span className="font-medium">{datosAlbaran.fecha}</span></div>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xl font-black text-foreground">{resumen.totalLineas}</div>
          <p className="text-[10px] text-muted-foreground font-medium">Líneas totales</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{resumen.coincidencias}</div>
          <p className="text-[10px] text-muted-foreground font-medium">Correctas</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xl font-black text-red-600 dark:text-red-400">{resumen.diferencias}</div>
          <p className="text-[10px] text-muted-foreground font-medium">Diferencias</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">{resumen.extras}</div>
          <p className="text-[10px] text-muted-foreground font-medium">Extras</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xl font-black text-orange-600 dark:text-orange-400">{resumen.faltantes}</div>
          <p className="text-[10px] text-muted-foreground font-medium">Faltantes</p>
        </div>
      </div>

      {/* Tabla comparativa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> COMPARATIVA PEDIDO vs ALBARÁN PROVEEDOR</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-muted-foreground">Estado</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-muted-foreground" colSpan={3}>
                    <span className="text-primary">📋 Pedido interno</span>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-muted-foreground" colSpan={3}>
                    <span className="text-muted-foreground">📦 Albarán proveedor</span>
                  </th>
                </tr>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-muted-foreground"></th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-primary/70">Producto</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-primary/70">Cantidad</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-primary/70">Precio</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-muted-foreground">Producto</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-muted-foreground">Cantidad</th>
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-muted-foreground">Precio</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => {
                  const esDiferente = l.tipo !== "coincide";
                  const cantDif = l.tipo === "cantidad_diferente" || l.tipo === "cantidad_y_precio";
                  const precioDif = l.tipo === "precio_diferente" || l.tipo === "cantidad_y_precio";
                  const esExtra = l.tipo === "extra";
                  const esFaltante = l.tipo === "faltante";

                  return (
                    <tr key={i} className={`border-b ${esDiferente ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                      <td className="px-3 py-2"><TipoBadge tipo={l.tipo} /></td>
                      {/* Pedido interno */}
                      <td className="px-3 py-2 font-medium text-foreground">
                        {esFaltante ? <span className="text-orange-600 dark:text-orange-400 italic">{l.productoInterno || "—"}</span> : (l.productoInterno || "—")}
                      </td>
                      <td className="px-3 py-2">{esFaltante || esExtra ? "—" : `${l.cantidadInterna} ${l.unidadProveedor || ""}`}</td>
                      <td className="px-3 py-2">{esFaltante || esExtra ? "—" : `${(l.precioInterno ?? 0).toFixed(2)} €`}</td>
                      {/* Albarán proveedor */}
                      <td className={`px-3 py-2 font-medium ${esExtra ? "text-amber-600 dark:text-amber-400 italic" : esFaltante ? "text-muted-foreground" : "text-foreground"}`}>
                        {esFaltante ? "—" : l.productoProveedor}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${cantDif ? "text-red-600 dark:text-red-400" : ""}`}>
                        {esFaltante ? "—" : `${l.cantidadProveedor} ${l.unidadProveedor || ""}`}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${precioDif ? "text-red-600 dark:text-red-400" : ""}`}>
                        {esFaltante ? "—" : `${(l.precioProveedor ?? 0).toFixed(2)} €`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
