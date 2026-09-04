"use client";

import { useState, useTransition } from "react";
import {
  CalendarCheck,
  CalendarX,
  CircleCheckBig,
  Info,
  Users,
  Calendar,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  reconfirmarReservaPorToken,
  rechazarReservaPorToken,
  type ReservaReconfirmable,
} from "@/features/reservar-publica/actions/reconfirmar-reserva-publica";

/** "2026-08-20" → "jueves, 20 de agosto". Fecha civil: sin zona horaria. */
function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

type Resultado = "confirmada" | "cancelada" | null;

export function ReconfirmarClient({
  token,
  reserva,
  intencion,
}: {
  token: string;
  reserva: ReservaReconfirmable;
  /** Botón que pulsó en el correo. Preselecciona, no aplica. */
  intencion: "si" | "no" | null;
}) {
  const [resultado, setResultado] = useState<Resultado>(
    reserva.yaReconfirmada ? "confirmada" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function onConfirmar() {
    setError(null);
    startTransition(async () => {
      const r = await reconfirmarReservaPorToken(token);
      if (!r.ok) setError(r.error);
      else setResultado("confirmada");
    });
  }

  function onRechazar() {
    setError(null);
    startTransition(async () => {
      const r = await rechazarReservaPorToken(token);
      if (!r.ok) setError(r.error);
      else setResultado("cancelada");
    });
  }

  // La reserva ya no admite respuesta (cancelada, sentada, pasada…). Se dice el
  // motivo concreto y no se pinta ningún botón: ofrecer una acción que va a
  // fallar es peor que no ofrecerla.
  if (reserva.bloqueada && !resultado) {
    return (
      <Marco>
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center">
            <Info className="h-8 w-8 text-zinc-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tu reserva</h1>
          <p className="text-zinc-600 text-sm">{reserva.motivoBloqueo}</p>
        </div>
        <DatosReserva reserva={reserva} />
      </Marco>
    );
  }

  if (resultado) {
    const confirmada = resultado === "confirmada";
    return (
      <Marco>
        <div className="text-center space-y-3">
          <div
            className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
              confirmada ? "bg-emerald-50" : "bg-zinc-100"
            }`}
          >
            {confirmada ? (
              <CircleCheckBig className="h-8 w-8 text-emerald-600" />
            ) : (
              <CalendarX className="h-8 w-8 text-zinc-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {confirmada ? "¡Contamos contigo!" : "Reserva cancelada"}
          </h1>
          <p className="text-zinc-600 text-sm">
            {confirmada
              ? `Tu mesa queda confirmada. Te esperamos en ${reserva.empresaNombre}.`
              : "Gracias por avisarnos. Hemos liberado tu mesa."}
          </p>
        </div>
        {confirmada && <DatosReserva reserva={reserva} />}
      </Marco>
    );
  }

  return (
    <Marco>
      <div className="text-center space-y-3">
        <div className="mx-auto h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center">
          <CalendarCheck className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {intencion === "no" ? "¿No podrás venir?" : "¿Nos confirmas que vienes?"}
        </h1>
        <p className="text-zinc-600 text-sm">
          {reserva.clienteNombre
            ? `${reserva.clienteNombre}, esta es tu reserva en ${reserva.empresaNombre}.`
            : `Esta es tu reserva en ${reserva.empresaNombre}.`}
        </p>
      </div>

      <DatosReserva reserva={reserva} />

      {/* Aviso de cargo ANTES de confirmar que no viene: el cliente decide con
          la información delante, no después. */}
      {intencion === "no" && reserva.avisoPolitica && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-relaxed">
          Cancelar con menos de {reserva.avisoPolitica.horas} h de antelación
          conlleva un cargo de{" "}
          {reserva.avisoPolitica.importe.toLocaleString("es-ES", {
            style: "currency",
            currency: "EUR",
          })}
          , según las condiciones que aceptaste al reservar.
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}

      {/* Los dos botones, siempre los dos: quien llega desde "No podré ir" y se
          arrepiente puede confirmar sin volver al correo, y al revés. El orden
          y el peso visual no cambian con la intención — mover el botón bajo el
          dedo del cliente es la forma de que pulse lo que no quería. Verde y
          rojo, los mismos colores que en el correo: el cliente reconoce el
          botón que acaba de pulsar y no duda de si ha llegado al sitio bueno. */}
      <div className="space-y-2">
        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          size="lg"
          onClick={onConfirmar}
          disabled={enviando}
        >
          Sí, confirmo que voy
        </Button>
        <Button
          className="w-full bg-red-600 hover:bg-red-700 text-white"
          size="lg"
          onClick={onRechazar}
          disabled={enviando}
        >
          No podré ir
        </Button>
      </div>
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-gradient-to-b from-zinc-50 to-zinc-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-100 p-8 space-y-5">
        {children}
      </div>
    </main>
  );
}

function DatosReserva({ reserva }: { reserva: ReservaReconfirmable }) {
  return (
    <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-4 space-y-2 text-sm">
      <Fila icono={<Calendar className="h-4 w-4" />}>
        {formatearFecha(reserva.fecha)}
      </Fila>
      <Fila icono={<Clock className="h-4 w-4" />}>{reserva.hora}</Fila>
      <Fila icono={<Users className="h-4 w-4" />}>
        {reserva.personas === 1 ? "1 persona" : `${reserva.personas} personas`}
      </Fila>
    </div>
  );
}

function Fila({
  icono,
  children,
}: {
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-zinc-700">
      <span className="text-zinc-400">{icono}</span>
      <span className="capitalize">{children}</span>
    </div>
  );
}
