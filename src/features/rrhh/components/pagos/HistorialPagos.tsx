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
import { calcularDesgloseNomina } from "@/features/rrhh/lib/desglose-nomina";
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
  // Bruto, retenciones y coste de empresa: mismo cálculo que el correo y la web
  // de confirmación (features/rrhh/lib/desglose-nomina).
  const d = calcularDesgloseNomina(pago);
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
          {/* TU NÓMINA: del bruto (que ya incluye tu SS y tu IRPF) a lo que
              te queda en el banco, restando una a una las retenciones. */}
          <Rotulo texto="Tu nómina" />
          {d.totalRetenido > 0 && (
            <p className="mb-1 text-[11px] text-muted-foreground leading-snug">
              Tu nómina bruta ya incluye tu Seguridad Social y tu IRPF. Se te descuentan
              aquí abajo hasta llegar a la nómina neta.
            </p>
          )}
          <dl className="text-sm divide-y divide-border/60">
            <Fila label="Nómina bruta" valor={fmtEur(d.bruto)} />
            {d.ssEmpleado > 0 && (
              <Fila
                label="Seguridad Social (trabajador)"
                valor={`−${fmtEur(d.ssEmpleado)}`}
                rojo
              />
            )}
            {d.irpf > 0 && <Fila label="IRPF (retención)" valor={`−${fmtEur(d.irpf)}`} rojo />}
            <Fila label="Nómina neta" valor={fmtEur(d.neto)} destacado />
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

          {/* RESUMEN COMPACTO debajo de lo que cobra: su IRPF, las dos partes de la
              Seguridad Social y el coste total. Cada línea lleva al lado, en
              pequeño, el porcentaje que supone sobre el coste total de la empresa;
              lo que se le RETIENE va en negativo, porque resta de lo que percibe. */}
          {d.hayCosteEmpresa && d.reparto && (
            <div className="mt-2.5 rounded-lg border border-dashed px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Lo que cuesta tu puesto a la empresa
              </p>
              <dl className="mt-1.5 text-[13px]">
                <FilaPct label="Nómina neta" valor={fmtEur(d.neto)} pct={d.reparto.neto} />
                {pago.complemento > 0 && (
                  <FilaPct
                    label="Complemento"
                    valor={fmtEur(pago.complemento)}
                    pct={d.reparto.complemento}
                  />
                )}
                {pago.horasExtras > 0 && (
                  <FilaPct
                    label="Horas extras"
                    valor={fmtEur(pago.horasExtras)}
                    pct={d.reparto.horasExtras}
                  />
                )}
                {pago.bonus > 0 && (
                  <FilaPct label="Bonus" valor={fmtEur(pago.bonus)} pct={d.reparto.bonus} />
                )}
                {pago.ajuste !== 0 && (
                  <FilaPct
                    label="Ajuste"
                    valor={`${pago.ajuste < 0 ? "−" : ""}${fmtEur(Math.abs(pago.ajuste))}`}
                    pct={d.reparto.ajuste}
                    rojo={pago.ajuste < 0}
                  />
                )}
                {d.ssEmpleado > 0 && (
                  <FilaPct
                    label="Seguridad Social (trabajador)"
                    valor={fmtEur(d.ssEmpleado)}
                    pct={d.reparto.ssEmpleado}
                  />
                )}
                {d.irpf > 0 && (
                  <FilaPct
                    label="Tu IRPF (a Hacienda)"
                    valor={fmtEur(d.irpf)}
                    pct={d.reparto.irpf}
                  />
                )}
                {d.ssEmpresa > 0 && (
                  <FilaPct
                    label="Seguridad Social (empresa)"
                    valor={fmtEur(d.ssEmpresa)}
                    pct={d.reparto.ssEmpresa}
                  />
                )}
                <div className="mt-1 flex items-baseline justify-between gap-2 border-t pt-1.5">
                  <dt className="font-semibold">Coste total para la empresa</dt>
                  <dd className="tabular-nums font-bold">
                    {fmtEur(d.costeEmpresa)}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      100%
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
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

/**
 * Fila del resumen de coste: concepto, importe y, en pequeño, el porcentaje que
 * supone sobre el coste total de la empresa.
 *
 * Todos los conceptos van en POSITIVO: aquí no se está restando nada, se está
 * repartiendo el coste total de la empresa entre sus partes (lo que cobra, lo
 * que se le retiene y se ingresa en su nombre, y la aportación patronal). Las
 * retenciones ya se muestran restando arriba, en el bloque de la nómina.
 *
 * REGLA: un importe solo se pinta en negativo cuando el dinero va de verdad en
 * negativo — un ajuste que resta, o una nómina que viene negativa. La Seguridad
 * Social y el IRPF no son eso: son partes del coste, no devoluciones.
 */
function FilaPct({
  label,
  valor,
  pct,
  rojo,
}: {
  label: string;
  valor: string;
  pct: number;
  /** Solo cuando el importe es de verdad negativo (un ajuste que resta). */
  rojo?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums font-medium", rojo && "text-rose-600")}>
        {valor}
        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
          {pct.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%
        </span>
      </dd>
    </div>
  );
}
