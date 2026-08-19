"use client";

import { useState, useTransition } from "react";
import { CalendarX, CalendarCheck, Info, Users, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelarReservaPorToken,
  type ReservaCancelable,
} from "@/features/reservar-publica/actions/cancelar-reserva-publica";

/** "2026-08-20" → "jueves, 20 de agosto". Fecha civil: sin zona horaria. */
function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function CancelarClient({
  token,
  reserva,
}: {
  token: string;
  reserva: ReservaCancelable;
}) {
  const [cancelada, setCancelada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function onCancelar() {
    setError(null);
    startTransition(async () => {
      const r = await cancelarReservaPorToken(token);
      if (!r.ok) setError(r.error);
      else setCancelada(true);
    });
  }

  const hecho = cancelada || reserva.estado === "CANCELADA";

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-gradient-to-b from-zinc-50 to-zinc-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-100 p-8 space-y-5">
        <div className="text-center space-y-3">
          <div
            className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
              hecho ? "bg-zinc-100" : "bg-amber-50"
            }`}
          >
            {hecho ? (
              <CalendarX className="h-8 w-8 text-zinc-500" />
            ) : (
              <CalendarCheck className="h-8 w-8 text-amber-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {hecho ? "Reserva cancelada" : "¿Cancelar tu reserva?"}
          </h1>
          <p className="text-zinc-600 text-sm">
            {hecho
              ? `Hemos avisado a ${reserva.empresaNombre}. Gracias por decírnoslo.`
              : `Tu mesa en ${reserva.empresaNombre}`}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-zinc-500">
                <Calendar className="h-3.5 w-3.5" /> Día
              </dt>
              <dd className="font-semibold text-zinc-900">{formatearFecha(reserva.fecha)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-zinc-500">
                <Clock className="h-3.5 w-3.5" /> Hora
              </dt>
              <dd className="font-semibold text-zinc-900 tabular-nums">{reserva.hora}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-zinc-500">
                <Users className="h-3.5 w-3.5" /> Comensales
              </dt>
              <dd className="font-semibold text-zinc-900">
                {reserva.personas} {reserva.personas === 1 ? "persona" : "personas"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Aviso de cargo ANTES de confirmar: el cliente decide con la
            información delante, no después. */}
        {!hecho && reserva.avisoPolitica && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-2">
            <Info className="h-4 w-4 mt-0.5 text-amber-700 shrink-0" />
            <p className="text-sm text-amber-900">
              Estás cancelando con menos de{" "}
              <strong>{reserva.avisoPolitica.horas} h</strong> de antelación, así que
              puede aplicarse un cargo de{" "}
              <strong>
                {reserva.avisoPolitica.importe.toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                })}{" "}
                €
              </strong>{" "}
              según la política que aceptaste al reservar.
            </p>
          </div>
        )}

        {reserva.bloqueada && !cancelada ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-600">
            {reserva.motivoBloqueo}
          </div>
        ) : hecho ? null : (
          <div className="space-y-2">
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <Button
              onClick={onCancelar}
              disabled={enviando}
              size="lg"
              className="w-full h-12 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
            >
              {enviando ? "Cancelando…" : "Sí, cancelar mi reserva"}
            </Button>
            <p className="text-center text-xs text-zinc-400">
              Si prefieres cambiar la hora en vez de cancelar, llama al restaurante.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
