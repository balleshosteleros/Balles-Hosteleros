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
  // Siempre con dos decimales: es dinero. Antes 1.366,50 € se pintaba "1.366,5 €".
  return (
    n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
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
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // Bruto = nómina neta + SS trabajador + IRPF (lo que la empresa declara).
  const bruto = r2(pago.nomina + pago.ssEmpleado + pago.irpf);
  // Coste real de la empresa = lo que percibe + lo retenido + la SS patronal.
  const costeEmpresa = r2(pago.total + pago.ssEmpleado + pago.irpf + pago.ssEmpresa);
  const totalSs = r2(pago.ssEmpleado + pago.ssEmpresa);
  const hayOtros =
    pago.complemento > 0 ||
    pago.horasExtras > 0 ||
    pago.bonus > 0 ||
    pago.ajuste !== 0;

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
          {/* TU NÓMINA: de lo que la empresa declara hasta lo que te queda. */}
          <Rotulo texto="Tu nómina" />
          <dl className="text-sm divide-y divide-border/60">
            <Fila label="Salario bruto" valor={fmtEur(bruto)} />
            {pago.ssEmpleado > 0 && (
              <Fila
                label="Seguridad Social (tu parte)"
                valor={`−${fmtEur(pago.ssEmpleado)}`}
                rojo
              />
            )}
            {pago.irpf > 0 && <Fila label="IRPF (retención)" valor={`−${fmtEur(pago.irpf)}`} rojo />}
            <Fila label="Nómina neta" valor={fmtEur(pago.nomina)} destacado />
          </dl>

          {/* OTROS CONCEPTOS: solo se pinta el bloque si hay alguno. */}
          {hayOtros && (
            <>
              <Rotulo texto="Otros conceptos" />
              <dl className="text-sm divide-y divide-border/60">
                {pago.complemento > 0 && (
                  <Fila label="Complemento" valor={`+${fmtEur(pago.complemento)}`} />
                )}
                {pago.horasExtras > 0 && (
                  <Fila label="Horas extras" valor={`+${fmtEur(pago.horasExtras)}`} />
                )}
                {pago.bonus > 0 && <Fila label="Bonus" valor={`+${fmtEur(pago.bonus)}`} />}
                {pago.ajuste !== 0 && (
                  <Fila
                    label="Ajuste"
                    valor={`${pago.ajuste > 0 ? "+" : "−"}${fmtEur(Math.abs(pago.ajuste))}`}
                    rojo={pago.ajuste < 0}
                  />
                )}
              </dl>
            </>
          )}

          <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Total a percibir
            </span>
            <span className="text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
              {fmtEur(pago.total)}
            </span>
          </div>

          {/* LO QUE LE CUESTA A LA EMPRESA: informativo, NO se le descuenta.
              Se dice explícitamente para que nadie lo lea como un descuento. */}
          {costeEmpresa > pago.total && (
            <>
              <Rotulo texto="Lo que le cuesta a la empresa" />
              <dl className="text-sm divide-y divide-border/60">
                <Fila label="Lo que percibes" valor={fmtEur(pago.total)} />
                {pago.ssEmpleado > 0 && (
                  <Fila label="Seguridad Social (tu parte)" valor={`+${fmtEur(pago.ssEmpleado)}`} />
                )}
                {pago.irpf > 0 && <Fila label="IRPF (a Hacienda)" valor={`+${fmtEur(pago.irpf)}`} />}
                {pago.ssEmpresa > 0 && (
                  <Fila
                    label="Seguridad Social (parte de la empresa)"
                    valor={`+${fmtEur(pago.ssEmpresa)}`}
                  />
                )}
                <Fila label="Coste total para la empresa" valor={fmtEur(costeEmpresa)} destacado />
              </dl>
              {totalSs > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                  En Seguridad Social se cotizan {fmtEur(totalSs)} en total por ti este mes
                  ({fmtEur(pago.ssEmpleado)} tuyos y {fmtEur(pago.ssEmpresa)} de la empresa).
                  Esta parte no se te descuenta de lo que percibes: ya está reflejada arriba.
                </p>
              )}
            </>
          )}

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

/** Encabezado de sección dentro del desglose. */
function Rotulo({ texto }: { texto: string }) {
  return (
    <p className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {texto}
    </p>
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
