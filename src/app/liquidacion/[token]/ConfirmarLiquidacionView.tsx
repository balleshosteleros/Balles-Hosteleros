"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import type { LiquidacionDetalle } from "@/features/rrhh/services/nominas/rrhh-pagos-confirmacion";

interface Props {
  /** Endpoint POST para confirmar. */
  endpoint: string;
  detalle: LiquidacionDetalle;
}

function fmtEur(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
}

export function ConfirmarLiquidacionView({ endpoint, detalle }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Confirmada si ya venía confirmada del servidor o si el usuario acaba de confirmar.
  const [confirmada, setConfirmada] = useState<boolean>(!!detalle.confirmadoEn);

  const confirmar = async () => {
    setConfirmando(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json();
      if (json.ok) setConfirmada(true);
      else setError(json.error ?? "No se pudo confirmar. Inténtalo de nuevo.");
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setConfirmando(false);
    }
  };

  // Filas del recuadro: solo los conceptos con valor (nómina y total siempre).
  const filas: { label: string; valor: string; destacado?: boolean; signo?: "pos" | "neg" }[] = [
    { label: "Nómina", valor: fmtEur(detalle.nomina) },
  ];
  if (detalle.propina) filas.push({ label: "Propina", valor: fmtEur(detalle.propina) });
  if (detalle.propinaMantenimiento)
    filas.push({ label: "Propina mes anterior", valor: fmtEur(detalle.propinaMantenimiento) });
  if (detalle.horasExtras) filas.push({ label: "Horas extras", valor: fmtEur(detalle.horasExtras) });
  if (detalle.bonus) filas.push({ label: "Bonus", valor: fmtEur(detalle.bonus) });
  if (detalle.ajuste)
    filas.push({
      label: "Ajuste",
      valor: `${detalle.ajuste > 0 ? "+" : "−"}${fmtEur(Math.abs(detalle.ajuste))}`,
      signo: detalle.ajuste > 0 ? "pos" : "neg",
    });
  if (detalle.irpf) filas.push({ label: "IRPF", valor: fmtEur(detalle.irpf) });
  if (detalle.ssEmpleado)
    filas.push({ label: "Seguridad Social (tu parte)", valor: fmtEur(detalle.ssEmpleado) });

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-zinc-900">Tu liquidación de {detalle.mesLabel}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {detalle.empleadoNombre} · {detalle.empresaNombre}
        </p>

        {/* Recuadro con SUS datos del mes */}
        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <table className="w-full border-collapse">
            <tbody>
              {filas.map((f) => (
                <tr key={f.label}>
                  <td className="py-1.5 text-sm text-zinc-600">{f.label}</td>
                  <td
                    className={`py-1.5 text-right text-sm tabular-nums ${
                      f.signo === "neg"
                        ? "text-rose-600"
                        : f.signo === "pos"
                          ? "text-emerald-600"
                          : "text-zinc-900"
                    }`}
                  >
                    {f.valor}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="border-t border-zinc-200 pt-0" />
              </tr>
              <tr>
                <td className="py-1.5 text-sm font-semibold text-zinc-900">Total</td>
                <td className="py-1.5 text-right text-base font-bold tabular-nums text-zinc-900">
                  {fmtEur(detalle.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {confirmada ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-900">
                <p className="font-semibold">Liquidación confirmada</p>
                <p className="mt-1">
                  Gracias. Has confirmado que tu liquidación de {detalle.mesLabel} es correcta. La
                  empresa ya puede proceder al pago.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <p>
                Revisa que los importes son correctos. Al confirmar, das el visto bueno a esta
                liquidación y la empresa podrá proceder al pago.
              </p>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 text-sm text-rose-600">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={confirmar}
              disabled={confirmando}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 hover:bg-emerald-700 transition"
            >
              {confirmando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {confirmando ? "Confirmando…" : "Confirmar que es correcto"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
