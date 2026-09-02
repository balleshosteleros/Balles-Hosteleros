"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import type { LiquidacionDetalle } from "@/features/rrhh/services/nominas/rrhh-pagos-confirmacion";
import {
  calcularDesgloseNomina,
  CONCEPTOS_SS_EMPRESA,
} from "@/features/rrhh/lib/desglose-nomina";
import { friendlyError } from "@/shared/lib/friendly-errors";

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
      // "Ya usado" no es un fallo: la liquidación está confirmada igualmente
      // (p.ej. pestaña abierta desde antes, o ya confirmada desde el portal).
      // Se muestra la pantalla de éxito, no un error en rojo.
      if (json.ok || json.reason === "used") setConfirmada(true);
      else setError(json.error ?? "No se pudo confirmar. Inténtalo de nuevo.");
    } catch (err) {
      setError(friendlyError(err, "confirmar"));
    } finally {
      setConfirmando(false);
    }
  };

  // ── Pantalla de ÉXITO: isotipo de la empresa + check + mensaje ──────────────
  if (confirmada) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 text-center">
          {detalle.marcaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detalle.marcaUrl}
              alt={detalle.empresaNombre}
              className="mx-auto mb-6 h-20 w-20 object-contain"
            />
          ) : null}

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>

          <h1 className="text-xl font-semibold text-zinc-900">¡Liquidación confirmada!</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Gracias, {detalle.empleadoNombre.split(" ")[0] || ""}. Has confirmado que tu liquidación de{" "}
            <b>{detalle.mesLabel}</b> es correcta. {detalle.empresaNombre} ya puede proceder al pago.
          </p>
          <p className="mt-6 text-xs text-zinc-400">Ya puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  // ── Filas del recuadro: desglose bruto → neto y demás conceptos ─────────────
  // Mismo cálculo que el portal "Mis pagos" y el correo de liquidación.
  const d = calcularDesgloseNomina(detalle);
  type Fila = {
    label: string;
    valor: string;
    signo?: "pos" | "neg";
    destacado?: boolean;
    separador?: boolean;
  };
  const filas: Fila[] = [{ label: "Nómina bruta", valor: fmtEur(d.bruto) }];
  if (d.ssEmpleado)
    filas.push({ label: "Seguridad Social (tu parte)", valor: `−${fmtEur(d.ssEmpleado)}`, signo: "neg" });
  if (d.irpf) filas.push({ label: "IRPF", valor: `−${fmtEur(d.irpf)}`, signo: "neg" });
  filas.push({ label: "Nómina neta", valor: fmtEur(d.neto), destacado: true, separador: true });
  if (detalle.complemento) filas.push({ label: "Complemento", valor: fmtEur(detalle.complemento) });
  if (detalle.horasExtras) filas.push({ label: "Horas extras", valor: fmtEur(detalle.horasExtras) });
  if (detalle.bonus) filas.push({ label: "Bonus", valor: fmtEur(detalle.bonus) });
  if (detalle.ajuste)
    filas.push({
      label: "Ajuste",
      valor: `${detalle.ajuste > 0 ? "+" : "−"}${fmtEur(Math.abs(detalle.ajuste))}`,
      signo: detalle.ajuste > 0 ? "pos" : "neg",
    });

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        {detalle.marcaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detalle.marcaUrl}
            alt={detalle.empresaNombre}
            className="mx-auto mb-4 h-14 w-14 object-contain"
          />
        ) : null}
        <h1 className="text-lg font-semibold text-zinc-900">Tu liquidación de {detalle.mesLabel}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {detalle.empleadoNombre} · {detalle.empresaNombre}
        </p>

        {/* Recuadro con SUS datos del mes */}
        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <table className="w-full border-collapse">
            <tbody>
              {filas.map((f, i) => (
                <tr key={`${f.label}-${i}`} className={f.separador ? "border-t border-zinc-200" : ""}>
                  <td className={`py-1.5 text-sm ${f.destacado ? "font-semibold text-zinc-900" : "text-zinc-600"}`}>
                    {f.label}
                  </td>
                  <td
                    className={`py-1.5 text-right text-sm tabular-nums ${
                      f.signo === "neg"
                        ? "text-rose-600"
                        : f.signo === "pos"
                          ? "text-emerald-600"
                          : f.destacado
                            ? "font-semibold text-zinc-900"
                            : "text-zinc-900"
                    }`}
                  >
                    {f.valor}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-zinc-200">
                <td className="py-1.5 text-sm font-semibold text-zinc-900">Total a percibir</td>
                <td className="py-1.5 text-right text-base font-bold tabular-nums text-zinc-900">
                  {fmtEur(detalle.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* LO QUE PAGA LA EMPRESA POR ÉL: informativo, NO se le descuenta. */}
        {d.hayCosteEmpresa && (
          <div className="mt-4 rounded-xl border border-zinc-200 p-4">
            {d.ssEmpresa > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Lo que paga la empresa por ti a la Seguridad Social
                </p>
                <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-sky-900">Aportación de la empresa</span>
                    <span className="text-base font-bold tabular-nums text-sky-900">
                      {fmtEur(d.ssEmpresa)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-sky-900/70">
                    Lo paga la empresa <b>además</b> de tu nómina: no sale de tu bolsillo ni se
                    te descuenta. Cubre {CONCEPTOS_SS_EMPRESA}
                    {d.porcentajeSsEmpresa !== null
                      ? `, y equivale a un ${d.porcentajeSsEmpresa.toLocaleString("es-ES", {
                          maximumFractionDigits: 1,
                        })}% de tu nómina bruta`
                      : ""}
                    .
                  </p>
                </div>
                <table className="mt-3 w-full border-collapse">
                  <tbody>
                    <FilaSimple label="Seguridad Social (tu parte)" valor={fmtEur(d.ssEmpleado)} />
                    <FilaSimple
                      label="Seguridad Social (parte de la empresa)"
                      valor={fmtEur(d.ssEmpresa)}
                    />
                    <FilaSimple
                      label="Total cotizado por ti este mes"
                      valor={fmtEur(d.ssTotal)}
                      destacado
                    />
                  </tbody>
                </table>
              </>
            )}

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Lo que le cuestas a la empresa
            </p>
            <table className="mt-1 w-full border-collapse">
              <tbody>
                <FilaSimple label="Lo que percibes" valor={fmtEur(d.total)} />
                {d.ssEmpleado > 0 && (
                  <FilaSimple
                    label="Seguridad Social (tu parte)"
                    valor={`+${fmtEur(d.ssEmpleado)}`}
                  />
                )}
                {d.irpf > 0 && <FilaSimple label="IRPF (a Hacienda)" valor={`+${fmtEur(d.irpf)}`} />}
                {d.ssEmpresa > 0 && (
                  <FilaSimple
                    label="Seguridad Social (parte de la empresa)"
                    valor={`+${fmtEur(d.ssEmpresa)}`}
                  />
                )}
                <FilaSimple
                  label="Coste total para la empresa"
                  valor={fmtEur(d.costeEmpresa)}
                  destacado
                />
              </tbody>
            </table>
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
              Todo el dinero que la empresa desembolsa por ti este mes: lo que cobras, lo que se
              te retiene y se ingresa en tu nombre, y su propia aportación a la Seguridad Social.
              Es informativo: no se te descuenta nada de aquí.
            </p>
          </div>
        )}

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
      </div>
    </div>
  );
}

/** Fila etiqueta/importe de los recuadros informativos de coste. */
function FilaSimple({
  label,
  valor,
  destacado,
}: {
  label: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <tr className={destacado ? "border-t border-zinc-200" : ""}>
      <td className={`py-1.5 text-sm ${destacado ? "font-semibold text-zinc-900" : "text-zinc-600"}`}>
        {label}
      </td>
      <td
        className={`py-1.5 text-right text-sm tabular-nums ${
          destacado ? "font-bold text-zinc-900" : "text-zinc-900"
        }`}
      >
        {valor}
      </td>
    </tr>
  );
}
