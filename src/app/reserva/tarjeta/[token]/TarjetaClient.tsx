"use client";

/**
 * Pantalla donde el cliente deja su tarjeta (PRP-082 fase 2).
 *
 * No hay ningún campo de tarjeta aquí: al pulsar, se le lleva al formulario de
 * Revolut, que vive en su dominio. Nosotros solo explicamos el cargo y
 * confirmamos el resultado al volver.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, CreditCard, CheckCircle2 } from "lucide-react";
import {
  confirmarPagoTarjeta,
  iniciarPagoTarjeta,
  type TarjetaPendiente,
} from "@/features/reservar-publica/actions/tarjeta-reserva-publica";

const EUR = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2 });

export function TarjetaClient({
  token,
  datos,
  vuelveDePagar,
}: {
  token: string;
  datos: TarjetaPendiente;
  vuelveDePagar: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Al volver de Revolut hay que preguntarle si el pago salió: el webhook
  // puede tardar, y el cliente vería "pendiente" después de haber pagado.
  const [comprobando, setComprobando] = useState(vuelveDePagar && !datos.resuelta);
  const [resuelta, setResuelta] = useState(datos.resuelta);

  const comprobar = useCallback(async () => {
    const res = await confirmarPagoTarjeta(token);
    setComprobando(false);
    if (res.ok && res.data.confirmada) {
      setResuelta(true);
      return;
    }
    setError(
      "No hemos podido confirmar el pago. Si ya lo has hecho, espera un momento y recarga la página.",
    );
  }, [token]);

  useEffect(() => {
    if (comprobando) comprobar();
  }, [comprobando, comprobar]);

  async function pagar() {
    setEnviando(true);
    setError(null);
    const res = await iniciarPagoTarjeta(token);
    if (!res.ok) {
      setError(res.error);
      setEnviando(false);
      return;
    }
    // La pasarela no se abre dentro de un iframe: si esta pantalla acabara
    // incrustada, se salta al marco superior para que el pago ocupe la ventana.
    if (window.self !== window.top && window.top) {
      window.top.location.href = res.data.urlPago;
    } else {
      window.location.href = res.data.urlPago;
    }
  }

  // Manda la garantía si la reserva lleva las dos: es la más estricta.
  const politica = datos.garantia ?? datos.cancelacion;
  const esGarantia = datos.garantia !== null;
  const importe = politica?.importe ?? 0;
  const horasAntes = politica?.horasAntes ?? 24;
  // El importe guardado en la reserva YA viene multiplicado si la política es
  // por comensal, así que aquí solo hay que deshacer la cuenta para poder
  // enseñarla: "2 € por persona × 6 = 12 €".
  const porComensal = politica?.porComensal ?? false;
  const importePorPersona = porComensal && datos.personas > 0
    ? importe / datos.personas
    : null;

  if (resuelta) {
    return (
      <Marco>
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold">Todo listo</h1>
          <p className="text-zinc-600 text-sm">
            Tu reserva en {datos.empresaNombre} está confirmada. Te esperamos el{" "}
            {formatearFecha(datos.fecha)} a las {datos.hora}.
          </p>
        </div>
      </Marco>
    );
  }

  if (comprobando) {
    return (
      <Marco>
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 text-zinc-400 mx-auto animate-spin" />
          <p className="text-zinc-600 text-sm">Comprobando el pago…</p>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <div className="h-11 w-11 rounded-full bg-zinc-900 text-white grid place-items-center mx-auto">
            {esGarantia ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
          </div>
          <h1 className="text-xl font-bold">Necesitamos tu tarjeta</h1>
          <p className="text-zinc-600 text-sm">
            Para confirmar tu reserva en {datos.empresaNombre}.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm space-y-1.5">
          <Fila etiqueta="Fecha" valor={formatearFecha(datos.fecha)} />
          <Fila etiqueta="Hora" valor={datos.hora} />
          <Fila
            etiqueta="Comensales"
            valor={`${datos.personas} ${datos.personas === 1 ? "persona" : "personas"}`}
          />
        </div>

        {/* La diferencia entre las dos políticas importa, y se dice sin rodeos:
            retener no es cobrar. */}
        <div
          className={`rounded-xl border p-4 text-sm ${
            esGarantia
              ? "border-sky-200 bg-sky-50 text-sky-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="font-semibold mb-1">
            {esGarantia
              ? "Esta reserva lleva política de garantía"
              : "Esta reserva lleva política de cancelación"}
          </div>
          <p className="leading-relaxed">
            Si no te presentas, o cancelas con menos de{" "}
            <strong>{horasAntes} {horasAntes === 1 ? "hora" : "horas"}</strong> de
            antelación, se te cargarán{" "}
            {importePorPersona !== null ? (
              <>
                <strong>{EUR.format(importePorPersona)} €</strong> por cada
                persona de la reserva:{" "}
                <strong>
                  {EUR.format(importePorPersona)} € × {datos.personas} ={" "}
                  {EUR.format(importe)} €
                </strong>
                .
              </>
            ) : (
              <>
                <strong>{EUR.format(importe)} €</strong>.
              </>
            )}
            {esGarantia && (
              <>
                {" "}
                Ese importe se <strong>retiene</strong> ahora, no se cobra: se
                libera en cuanto te presentes en el restaurante.
              </>
            )}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={pagar}
          disabled={enviando}
          className="w-full h-11 rounded-xl bg-zinc-900 text-white font-medium text-sm inline-flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-60 transition-colors"
        >
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Abriendo el pago…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" /> Introducir tarjeta
            </>
          )}
        </button>

        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          El pago lo gestiona Revolut. Tus datos de tarjeta no pasan por{" "}
          {datos.empresaNombre} ni quedan guardados en esta web.
        </p>
      </div>
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-gradient-to-b from-zinc-50 to-zinc-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-100 p-8">
        {children}
      </div>
    </main>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500">{etiqueta}</span>
      <span className="font-medium text-zinc-900">{valor}</span>
    </div>
  );
}

/** "2026-09-05" → "sábado 5 de septiembre" */
function formatearFecha(f: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (!m) return f;
  // Mediodía UTC para que el día no se desplace por la zona del navegador.
  const d = new Date(`${f}T12:00:00Z`);
  const dias = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const meses = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()} de ${meses[d.getUTCMonth()]}`;
}
