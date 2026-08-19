"use client";

/**
 * Vista general del almacén: TODOS los movimientos de stock (kardex de empresa).
 * "Qué entró, qué salió, por qué y cuándo" (Iván 14-ago). Complementa la sección
 * por-producto de la ficha. Solo lectura. Hoy casi todo son entradas por albarán;
 * se irá llenando cuando ventas/mermas/inventarios empiecen a descontar.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Trash2,
  Warehouse,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import { formatNumero } from "@/shared/lib/numero";
import {
  listMovimientosAlmacen,
  type MovimientoAlmacen,
} from "@/features/logistica/actions/kardex-actions";
import { DOCUMENTO_TIPO_LABEL, type DocumentoTipo } from "@/features/logistica/data/kardex";

const ICONO_TIPO: Record<string, { Icon: typeof ArrowDownToLine; color: string }> = {
  albaran: { Icon: ArrowDownToLine, color: "text-emerald-700 dark:text-emerald-400" },
  pos_ticket: { Icon: ArrowUpFromLine, color: "text-amber-700 dark:text-amber-400" },
  inventario: { Icon: ClipboardList, color: "text-sky-700 dark:text-sky-400" },
  merma: { Icon: Trash2, color: "text-rose-700 dark:text-rose-400" },
  ajuste: { Icon: ArrowDownToLine, color: "text-muted-foreground" },
};

const FILTRO_TIPOS: Array<{ value: "" | DocumentoTipo; label: string }> = [
  { value: "", label: "Todos los tipos" },
  { value: "albaran", label: "Compras" },
  { value: "pos_ticket", label: "Ventas" },
  { value: "merma", label: "Mermas" },
  { value: "inventario", label: "Inventarios" },
  { value: "ajuste", label: "Ajustes" },
];

export function MovimientosAlmacenView() {
  const { empresaActual } = useEmpresa();
  const tz = empresaActual?.zonaHoraria ?? "";

  const [busqueda, setBusqueda] = useState("");
  const [documentoTipo, setDocumentoTipo] = useState<"" | DocumentoTipo>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [movimientos, setMovimientos] = useState<MovimientoAlmacen[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await listMovimientosAlmacen({
      busqueda: busqueda || null,
      documentoTipo: documentoTipo || null,
      desde: desde || null,
      hasta: hasta || null,
    });
    if (res.ok) setMovimientos(res.data);
    setCargando(false);
  }, [busqueda, documentoTipo, desde, hasta]);

  // Recarga con un pequeño debounce (la búsqueda por nombre es lo que más cambia).
  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  const fmtFecha = (iso: string) =>
    formatFechaEnZona(iso, tz, { day: "2-digit", month: "short", year: "numeric" });

  const resumen = useMemo(() => {
    let entra = 0;
    let sale = 0;
    for (const m of movimientos) (m.signo === 1 ? (entra += 1) : (sale += 1));
    return { entra, sale };
  }, [movimientos]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Warehouse className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Movimientos de almacén</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Todo lo que ha entrado y salido del stock: compras, ventas, mermas, inventarios y ajustes.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Producto o referencia</label>
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="h-9" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={documentoTipo}
            onChange={(e) => setDocumentoTipo(e.target.value as "" | DocumentoTipo)}
          >
            {FILTRO_TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9" />
        </div>
      </div>

      {/* Aviso mientras el circuito solo suma (ventas/mermas/inventarios aún no descuentan). */}
      {!cargando && resumen.sale === 0 && movimientos.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          De momento solo hay <b>entradas por compras</b>: las ventas, mermas e inventarios todavía no
          descuentan stock. A medida que se activen, sus salidas aparecerán aquí.
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando movimientos…
            </div>
          ) : movimientos.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No hay movimientos con estos filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Producto</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-4 py-2 text-right font-medium">Saldo</th>
                    <th className="px-4 py-2 font-medium">Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => {
                    const meta = ICONO_TIPO[m.documento_tipo] ?? ICONO_TIPO.ajuste;
                    const Icon = meta.Icon;
                    const sinCambios = m.documento_tipo === "inventario" && Number(m.cantidad) === 0;
                    return (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                        <td className="px-4 py-2 font-medium">{m.productoNombre}</td>
                        <td className="px-4 py-2">
                          <span className={cn("inline-flex items-center gap-1", meta.color)}>
                            <Icon className="h-3.5 w-3.5" />
                            {DOCUMENTO_TIPO_LABEL[m.documento_tipo]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {sinCambios ? (
                            <span className="text-muted-foreground">Sin cambios</span>
                          ) : (
                            <span className={m.signo === 1 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                              {m.signo === 1 ? "+" : "−"}
                              {formatNumero(Number(m.cantidad), { max: 2 })}
                              {m.productoMedida ? ` ${m.productoMedida}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {formatNumero(Number(m.saldo_resultante), { max: 2 })}
                        </td>
                        <td className="px-4 py-2">
                          <span className="whitespace-nowrap">{m.referencia ?? "—"}</span>
                          {m.motivo ? <span className="block text-xs text-muted-foreground">{m.motivo}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!cargando && movimientos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {movimientos.length} movimiento(s) · {resumen.entra} entrada(s) · {resumen.sale} salida(s)
          {movimientos.length >= 500 ? " · mostrando los 500 más recientes" : ""}
        </p>
      )}
    </div>
  );
}
