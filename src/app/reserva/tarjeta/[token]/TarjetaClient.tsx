"use client";

/**
 * Pantalla donde el cliente deja su tarjeta (PRP-082 fase 2).
 *
 * No hay ningún campo de tarjeta aquí: al pulsar, se le lleva al formulario de
 * Revolut, que vive en su dominio. Nosotros solo explicamos el cargo y
 * confirmamos el resultado al volver.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  /**
   * El formulario de tarjeta se monta DENTRO de esta pantalla (widget de
   * Revolut), no en su página alojada. Así el cliente no ve el "Pagar X €" de
   * Revolut, ni sus botones de Revolut Pay, ni su publicidad: solo los campos
   * de la tarjeta y nuestro botón.
   *
   * Los números de la tarjeta siguen SIN pasar por nosotros: viven dentro de
   * un marco de Revolut al que esta página no tiene acceso.
   */
  const contenedorTarjeta = useRef<HTMLDivElement | null>(null);
  const campoRef = useRef<{
    submit: (meta?: Record<string, unknown>) => void;
    destroy: () => void;
  } | null>(null);
  const [montandoCampo, setMontandoCampo] = useState(false);
  const [campoListo, setCampoListo] = useState(false);
  /**
   * Titular de la tarjeta, en un campo NUESTRO y ya relleno con el nombre de
   * la reserva. El cliente solo lo toca si la tarjeta va a otro nombre —su
   * pareja, la empresa—, que es un caso real y bastante común.
   */
  const [titular, setTitular] = useState(datos.clienteNombre ?? "");
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

  /** Abre la orden en Revolut y pinta sus campos de tarjeta aquí dentro. */
  async function mostrarFormulario() {
    setMontandoCampo(true);
    setError(null);

    const res = await iniciarPagoTarjeta(token);
    if (!res.ok) {
      setError(res.error);
      setMontandoCampo(false);
      return;
    }

    try {
      const { default: RevolutCheckout } = await import("@revolut/checkout");
      const instancia = await RevolutCheckout(
        res.data.tokenPago,
        res.data.entorno === "pruebas" ? "sandbox" : "prod",
      );

      const destino = contenedorTarjeta.current;
      if (!destino) {
        setError("No pudimos abrir el formulario. Recarga la página.");
        setMontandoCampo(false);
        return;
      }

      campoRef.current = instancia.createCardField({
        target: destino,
        locale: "es",
        // El código postal no se le pide: la reserva no lo necesita y es un
        // campo más para algo que no se le va a cobrar.
        hidePostcodeField: true,
        // En la política de cancelación la tarjeta se GUARDA para poder
        // cobrarla si el cliente no viene. En la de garantía no hace falta: el
        // dinero ya queda retenido.
        ...(res.data.guardarTarjeta ? { savePaymentMethodFor: "merchant" as const } : {}),
        // Revolut exige que el titular tenga al menos dos palabras. Si la
        // reserva vino sin apellidos, mejor no mandar nada: así el widget lo
        // pide en su propio campo en vez de rechazar un nombre incompleto.
        // El titular NO se le manda: al pasárselo rechazaba la tarjeta con "el
        // nombre del titular debe tener al menos dos palabras", incluso con un
        // nombre y un apellido correctos. Sin él, el widget añade su propio
        // campo de titular y lo valida mientras el cliente escribe, que además
        // es más fiable: la tarjeta puede estar a nombre de otra persona.
        email: datos.clienteEmail ?? undefined,
        onSuccess() {
          // El widget avisa, pero no es de fiar: un anuncio bloqueado o una
          // conexión caída se lo comen. Se comprueba contra Revolut.
          setCampoListo(false);
          setComprobando(true);
        },
        onValidation() {
          // El cliente está corrigiendo: fuera el error del intento anterior,
          // que si no se queda en pantalla y parece que sigue fallando.
          setError(null);
        },
        onError(err: unknown) {
          setError(
            err instanceof Error
              ? `No se pudo validar la tarjeta: ${err.message}`
              : "No se pudo validar la tarjeta. Revisa los datos e inténtalo de nuevo.",
          );
          setEnviando(false);
        },
      });

      setCampoListo(true);
    } catch {
      setError("No pudimos abrir el formulario de tarjeta. Inténtalo de nuevo.");
    } finally {
      setMontandoCampo(false);
    }
  }

  /** Envía la tarjeta que el cliente acaba de teclear. */
  function confirmarTarjeta() {
    setEnviando(true);
    setError(null);
    campoRef.current?.submit({
      name: titular.trim(),
      email: datos.clienteEmail ?? undefined,
    });
  }

  // React monta los efectos dos veces en desarrollo: sin esto quedarían dos
  // formularios de tarjeta superpuestos.
  useEffect(() => {
    return () => {
      campoRef.current?.destroy();
      campoRef.current = null;
    };
  }, []);

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
            Para confirmar tu reserva en {datos.empresaNombre}.{" "}
            <strong className="text-zinc-900">No se te cobra nada ahora.</strong>
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

        {/* Titular y campos de tarjeta. Vacío hasta que pulsa el botón. */}
        <div className={campoListo ? "space-y-3" : "hidden"}>
          <div>
            <label
              htmlFor="titular-tarjeta"
              className="block text-xs font-medium text-zinc-600 mb-1.5"
            >
              Nombre del titular de la tarjeta
            </label>
            <input
              id="titular-tarjeta"
              type="text"
              value={titular}
              onChange={(e) => {
                setTitular(e.target.value);
                setError(null);
              }}
              placeholder="Nombre y apellidos"
              autoComplete="cc-name"
              className="w-full h-11 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
            />
            {titular.trim() !== "" && !titular.trim().includes(" ") && (
              <p className="mt-1 text-[11px] text-amber-700">
                Escribe el nombre y el apellido tal y como salen en la tarjeta.
              </p>
            )}
          </div>

          <div ref={contenedorTarjeta} className="rounded-xl border border-zinc-200 p-3" />
        </div>

        {campoListo ? (
          <button
            type="button"
            onClick={confirmarTarjeta}
            disabled={enviando || !titular.trim().includes(" ")}
            className="w-full h-11 rounded-xl bg-zinc-900 text-white font-medium text-sm inline-flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-60 transition-colors"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Comprobando…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Confirmar reserva
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={mostrarFormulario}
            disabled={montandoCampo}
            className="w-full h-11 rounded-xl bg-zinc-900 text-white font-medium text-sm inline-flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-60 transition-colors"
          >
            {montandoCampo ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Un momento…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" /> Introducir tarjeta
              </>
            )}
          </button>
        )}

        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          Los datos de tu tarjeta los recoge Revolut directamente: no pasan por{" "}
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
