"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";
import type { PagoAbonado } from "@/features/rrhh/actions/pagos-actions";
import {
  getMiNominaUrl,
  getNominaArchivoUrl,
} from "@/features/rrhh/actions/nominas-archivo-actions";
import { CheckCircle2, ChevronDown, Euro, FileText, Loader2 } from "lucide-react";

function fmtEur(n: number): string {
  return (
    n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) +
    " €"
  );
}

/**
 * Histórico de pagos abonados de un empleado. Cada mes es una tarjeta con el
 * neto percibido y la fecha de abono; al desplegarla se ve el desglose
 * bruto → −SS → −IRPF → nómina neta → +extras → total a percibir.
 *
 * Se usa tanto en el portal del empleado ("Mis pagos") como en la ficha del
 * empleado del lado de RRHH.
 */
export function HistorialPagos({
  pagos,
  empleadoId,
}: {
  pagos: PagoAbonado[];
  /**
   * Solo desde la ficha de RRHH: de quién son estos pagos. En el portal del
   * trabajador se omite y la nómina se pide con la sesión, sin id por medio.
   */
  empleadoId?: string;
}) {
  if (pagos.length === 0) {
    return (
      <Card className="p-10 flex flex-col items-center justify-center text-center gap-2">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Euro className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">Todavía no hay pagos abonados</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Cuando se marque una liquidación como pagada, aparecerá aquí con su
          fecha e importe.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {pagos.map((p) => (
        <PagoCard key={p.id} pago={p} empleadoId={empleadoId} />
      ))}
    </div>
  );
}

function PagoCard({ pago, empleadoId }: { pago: PagoAbonado; empleadoId?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [errorNomina, setErrorNomina] = useState<string | null>(null);

  // La nómina se abre en una pestaña nueva con una URL firmada temporal. Si el
  // mes tiene varias (finiquito + normal), llegan combinadas en un solo PDF.
  async function abrirNomina() {
    setAbriendo(true);
    setErrorNomina(null);
    try {
      const res = empleadoId
        ? await getNominaArchivoUrl(pago.periodo, empleadoId)
        : await getMiNominaUrl(pago.periodo);
      if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
      else setErrorNomina(res.error);
    } finally {
      setAbriendo(false);
    }
  }
  // Bruto = nómina neta + SS trabajador + IRPF (lo que la empresa declara).
  const bruto = Math.round((pago.nomina + pago.ssEmpleado + pago.irpf) * 100) / 100;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold capitalize truncate">{pago.periodoLabel}</p>
          <p className="text-xs text-muted-foreground">
            {pago.pagadoAtLabel ? `Abonado el ${pago.pagadoAtLabel}` : "Abonado"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold tabular-nums">{fmtEur(pago.total)}</p>
          <p className="text-[11px] text-muted-foreground">a percibir</p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
            abierto && "rotate-180",
          )}
        />
      </button>

      {abierto && (
        <div className="border-t px-4 py-3 bg-muted/20">
          <dl className="text-sm divide-y divide-border/60">
            <Fila label="Bruto" valor={fmtEur(bruto)} />
            {pago.ssEmpleado > 0 && (
              <Fila label="Seguridad Social" valor={`−${fmtEur(pago.ssEmpleado)}`} rojo />
            )}
            {pago.irpf > 0 && <Fila label="IRPF" valor={`−${fmtEur(pago.irpf)}`} rojo />}
            <Fila label="Nómina neta" valor={fmtEur(pago.nomina)} destacado />
            {pago.complemento > 0 && <Fila label="Complemento" valor={fmtEur(pago.complemento)} />}
            {pago.complementoMesAnterior > 0 && (
              <Fila label="Complemento mes anterior" valor={fmtEur(pago.complementoMesAnterior)} />
            )}
            {pago.horasExtras > 0 && (
              <Fila label="Horas extras" valor={fmtEur(pago.horasExtras)} />
            )}
            {pago.bonus > 0 && <Fila label="Bonus" valor={fmtEur(pago.bonus)} />}
            {pago.ajuste !== 0 && (
              <Fila
                label="Ajuste"
                valor={`${pago.ajuste > 0 ? "+" : "−"}${fmtEur(Math.abs(pago.ajuste))}`}
                rojo={pago.ajuste < 0}
              />
            )}
            <Fila label="Total a percibir" valor={fmtEur(pago.total)} destacado />
          </dl>

          {pago.nominaPath && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={abrirNomina}
                disabled={abriendo}
              >
                {abriendo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Ver nómina
              </Button>
              {errorNomina && <span className="text-xs text-destructive">{errorNomina}</span>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Fila({
  label,
  valor,
  rojo,
  destacado,
}: {
  label: string;
  valor: string;
  rojo?: boolean;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <dt className={cn("text-muted-foreground", destacado && "font-semibold text-foreground")}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums font-medium",
          destacado && "font-bold",
          rojo && "text-rose-600",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}
