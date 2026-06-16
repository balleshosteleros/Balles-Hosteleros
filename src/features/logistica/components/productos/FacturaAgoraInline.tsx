"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getFacturaAgora, type FacturaAgora } from "@/features/logistica/actions/kardex-actions";

function eur(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

/** Detalle de la factura de Ágora desplegado inline (sin salir a Ágora). */
export function FacturaAgoraInline({ ticketId }: { ticketId: string }) {
  const [factura, setFactura] = useState<FacturaAgora | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFacturaAgora(ticketId).then((res) => {
      if (!cancelled) {
        setFactura(res.data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando factura…
      </div>
    );
  }
  if (!factura) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">No se encontró la factura.</div>;
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">
          Factura {factura.numero ?? `${factura.agora_serie ?? ""}-${factura.agora_numero ?? ""}`}
        </span>
        <span className="text-muted-foreground">
          {factura.comensales != null ? `${factura.comensales} comensales · ` : ""}
          Total {eur(factura.total)}
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1 font-medium">Producto</th>
            <th className="py-1 text-right font-medium">Uds</th>
            <th className="py-1 text-right font-medium">Precio</th>
          </tr>
        </thead>
        <tbody>
          {factura.lineas.map((l) => (
            <tr key={l.id} className="border-t border-border/50">
              <td className="py-1">{l.nombre ?? "—"}</td>
              <td className="py-1 text-right tabular-nums">{l.cantidad}</td>
              <td className="py-1 text-right tabular-nums">{eur(l.precio_unitario)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-end gap-4 border-t pt-2 text-muted-foreground">
        <span>Subtotal {eur(factura.subtotal)}</span>
        <span>IVA {eur(factura.iva_total)}</span>
        <span className="font-medium text-foreground">Total {eur(factura.total)}</span>
      </div>
    </div>
  );
}
