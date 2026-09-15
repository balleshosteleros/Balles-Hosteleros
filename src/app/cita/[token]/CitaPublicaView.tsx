"use client";

/**
 * Lo que ve quien reservó al abrir el enlace de su cita (PRP-088).
 *
 * Solo dos cosas: cuándo es, y el botón de no poder ir. La confirmación es
 * NUESTRA, en la propia pantalla — nada de los avisos del navegador.
 */
import { useState } from "react";
import { CalendarX2, CheckCircle2, Video } from "lucide-react";

interface Props {
  token: string;
  empresaNombre: string;
  color: string;
  calendario: string;
  fechaLarga: string;
  hora: string;
  ciudadZona: string;
  meetUrl: string | null;
  yaAnulada: boolean;
  yaPaso: boolean;
}

export function CitaPublicaView(props: Props) {
  const [anulada, setAnulada] = useState(props.yaAnulada);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anular = async () => {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/citas/anular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "No se ha podido anular. Inténtalo de nuevo.");
        return;
      }
      setAnulada(true);
      setConfirmando(false);
    } catch {
      setError("No se ha podido anular. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: anulada ? "#FBE9E7" : `${props.color}1A` }}
        >
          {anulada ? (
            <CalendarX2 className="h-6 w-6 text-rose-600" />
          ) : (
            <CheckCircle2 className="h-6 w-6" style={{ color: props.color }} />
          )}
        </div>

        <h1 className="text-center text-lg font-semibold text-zinc-900">
          {anulada ? "Tu cita está anulada" : "Tu cita"}
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-500">{props.calendario}</p>

        <dl className="mt-6 space-y-2 rounded-xl border border-zinc-200 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Día</dt>
            <dd className="text-right font-semibold text-zinc-900">{props.fechaLarga}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Hora</dt>
            <dd className="text-right font-semibold text-zinc-900">
              {props.hora} (hora de {props.ciudadZona})
            </dd>
          </div>
        </dl>

        {anulada ? (
          <p className="mt-6 text-center text-sm text-zinc-600">
            El hueco vuelve a estar libre. Si quieres otro día, escríbenos y te lo buscamos.
          </p>
        ) : props.yaPaso ? (
          <p className="mt-6 text-center text-sm text-zinc-500">Esta cita ya ha pasado.</p>
        ) : (
          <>
            {props.meetUrl && (
              <a
                href={props.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white"
                style={{ background: props.color }}
              >
                <Video className="h-4 w-4" /> Entrar a la videollamada
              </a>
            )}

            {!confirmando ? (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="mt-3 w-full rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                No puedo ir
              </button>
            ) : (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm text-rose-900">
                  ¿Anulamos tu cita del {props.fechaLarga} a las {props.hora}? El hueco quedará
                  libre para otra persona.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    disabled={enviando}
                    className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => void anular()}
                    disabled={enviando}
                    className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {enviando ? "Anulando…" : "Sí, anular"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}

        <p className="mt-6 text-center text-xs text-zinc-400">{props.empresaNombre}</p>
      </div>
    </div>
  );
}
