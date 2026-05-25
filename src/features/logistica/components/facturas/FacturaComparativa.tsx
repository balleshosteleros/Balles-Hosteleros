"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Pencil, AlertTriangle } from "lucide-react";
import type {
  ComparativaResultado,
  DiscrepanciaTipo,
  LineaFactura,
} from "@/features/logistica/types/facturas";

interface Props {
  lineas: LineaFactura[];
  comparativa: ComparativaResultado | null;
  onResolver: (
    lineaId: string,
    resolucion: "acepto_proveedor" | "mantengo_sistema" | "editado_manual",
    valores?: { cantidad?: number; precioUnitario?: number; ivaPorcentaje?: number },
  ) => void;
  busy?: boolean;
}

const TIPO_LABEL: Record<DiscrepanciaTipo, string> = {
  cantidad: "Cantidad distinta",
  precio: "Precio distinto",
  iva: "IVA distinto",
  importe: "Importe distinto",
  nombre: "Nombre distinto",
  formato: "Formato distinto",
  extra: "Línea extra del proveedor",
  faltante: "Línea no facturada",
};

const TIPO_COLOR: Record<DiscrepanciaTipo, string> = {
  cantidad: "bg-amber-50 text-amber-900 border-amber-200",
  precio: "bg-rose-50 text-rose-900 border-rose-200",
  iva: "bg-violet-50 text-violet-900 border-violet-200",
  importe: "bg-rose-50 text-rose-900 border-rose-200",
  nombre: "bg-sky-50 text-sky-900 border-sky-200",
  formato: "bg-sky-50 text-sky-900 border-sky-200",
  extra: "bg-orange-50 text-orange-900 border-orange-200",
  faltante: "bg-zinc-50 text-zinc-900 border-zinc-200",
};

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

export function FacturaComparativa({ lineas, comparativa, onResolver, busy }: Props) {
  const ordenadas = useMemo(
    () => [...lineas].sort((a, b) => a.orden - b.orden),
    [lineas],
  );

  if (!comparativa) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sube la factura del proveedor y pulsa "Comparar con OCR" para ver las discrepancias.
      </div>
    );
  }

  const { resumen, diferenciaTotal, diferenciaIva } = comparativa;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <Kpi label="Total" value={resumen.totalLineas} tone="neutral" />
        <Kpi label="Coinciden" value={resumen.coincidencias} tone="ok" />
        <Kpi label="Diferencias" value={resumen.diferencias} tone="warn" />
        <Kpi label="Extras" value={resumen.extras} tone="warn" />
        <Kpi label="Faltantes" value={resumen.faltantes} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="font-mono">
          Δ Total: {diferenciaTotal >= 0 ? "+" : ""}
          {fmt(diferenciaTotal)} €
        </Badge>
        <Badge variant="outline" className="font-mono">
          Δ IVA: {diferenciaIva >= 0 ? "+" : ""}
          {fmt(diferenciaIva)} €
        </Badge>
        {resumen.hayAlerta && (
          <Badge className="gap-1 bg-amber-100 text-amber-900 border-amber-200">
            <AlertTriangle className="h-3 w-3" /> Hay discrepancias por resolver
          </Badge>
        )}
      </div>

      {/* Tabla comparativa */}
      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="px-3 py-2 text-right">Sistema</th>
              <th className="px-3 py-2 text-right">Factura proveedor</th>
              <th className="px-3 py-2 text-left">Discrepancia</th>
              <th className="px-3 py-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <FilaComparativa key={l.id} linea={l} onResolver={onResolver} busy={busy} />
            ))}
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  Sin líneas que mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "neutral" }) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : "bg-muted text-foreground border-border";
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function FilaComparativa({
  linea,
  onResolver,
  busy,
}: {
  linea: LineaFactura;
  onResolver: Props["onResolver"];
  busy?: boolean;
}) {
  const tipo = linea.discrepanciaTipo;
  const resuelta = linea.discrepanciaResolucion !== null;
  const sis = linea.valorSistema;
  const bg = !tipo
    ? ""
    : resuelta
      ? "bg-emerald-50/30"
      : (TIPO_COLOR[tipo] ?? "");

  return (
    <tr className={`border-b ${bg}`}>
      <td className="px-3 py-2 max-w-[260px]">
        <div className="font-medium truncate" title={linea.nombre}>
          {linea.nombre}
        </div>
        {sis && tipo === "nombre" && (
          <div className="text-[10px] text-muted-foreground truncate">
            Sistema: {sis.nombre}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {sis ? (
          <>
            <div>
              {fmt(sis.cantidad)} {sis.unidad} × {fmt(sis.precioUnitario)} €
            </div>
            <div className="text-[10px] text-muted-foreground">
              IVA {fmt(sis.ivaPorcentaje)}% · {fmt(sis.importeLinea)} €
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {tipo === "faltante" ? (
          <span className="text-muted-foreground">No facturada</span>
        ) : (
          <>
            <div>
              {fmt(linea.cantidad)} {linea.unidad} × {fmt(linea.precioUnitario)} €
            </div>
            <div className="text-[10px] text-muted-foreground">
              IVA {fmt(linea.ivaPorcentaje)}% · {fmt(linea.importeLinea)} €
            </div>
          </>
        )}
      </td>
      <td className="px-3 py-2">
        {tipo ? (
          <Badge variant="outline" className={`text-[10px] ${TIPO_COLOR[tipo]}`}>
            {TIPO_LABEL[tipo]}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-900 border-emerald-200">
            Coincide
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {!tipo ? (
          <span className="text-muted-foreground text-[10px]">—</span>
        ) : resuelta ? (
          <Badge variant="outline" className="text-[10px]">
            {linea.discrepanciaResolucion === "acepto_proveedor"
              ? "Acepto proveedor"
              : linea.discrepanciaResolucion === "mantengo_sistema"
                ? "Mantengo sistema"
                : "Editado manual"}
          </Badge>
        ) : (
          <div className="flex justify-end gap-1">
            {tipo !== "faltante" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1"
                onClick={() => onResolver(linea.id, "acepto_proveedor")}
                disabled={busy}
              >
                <Check className="h-3 w-3" /> Acepto
              </Button>
            )}
            {tipo !== "extra" && sis && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1"
                onClick={() => onResolver(linea.id, "mantengo_sistema")}
                disabled={busy}
              >
                <X className="h-3 w-3" /> Mantengo
              </Button>
            )}
            <EditarLineaInline linea={linea} onResolver={onResolver} busy={busy} />
          </div>
        )}
      </td>
    </tr>
  );
}

function EditarLineaInline({
  linea,
  onResolver,
  busy,
}: {
  linea: LineaFactura;
  onResolver: Props["onResolver"];
  busy?: boolean;
}) {
  return (
    <details className="inline-block">
      <summary className="list-none cursor-pointer">
        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1">
          <span>
            <Pencil className="h-3 w-3" /> Editar
          </span>
        </Button>
      </summary>
      <form
        className="absolute right-2 mt-1 z-10 flex gap-1 rounded-md border bg-popover p-2 shadow-md"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onResolver(linea.id, "editado_manual", {
            cantidad: Number(fd.get("cantidad")),
            precioUnitario: Number(fd.get("precio")),
            ivaPorcentaje: Number(fd.get("iva")),
          });
        }}
      >
        <Input
          name="cantidad"
          type="number"
          step="0.001"
          defaultValue={linea.cantidad}
          className="h-7 w-20 text-[11px]"
          placeholder="Cant."
        />
        <Input
          name="precio"
          type="number"
          step="0.0001"
          defaultValue={linea.precioUnitario}
          className="h-7 w-24 text-[11px]"
          placeholder="Precio"
        />
        <Input
          name="iva"
          type="number"
          step="0.5"
          defaultValue={linea.ivaPorcentaje}
          className="h-7 w-16 text-[11px]"
          placeholder="IVA"
        />
        <Button type="submit" size="sm" className="h-7 px-2 text-[10px]" disabled={busy}>
          OK
        </Button>
      </form>
    </details>
  );
}
