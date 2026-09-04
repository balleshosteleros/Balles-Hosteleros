"use client";

/**
 * Formulario público de valoración. Recibe el token y guarda la puntuación.
 *
 * DOS MODOS, según de dónde venga el token:
 *
 * - `desglosado` (correo posterior a una reserva): tres valoraciones —comida,
 *   servicio y ambiente— porque una nota global no dice QUÉ arreglar: un 3
 *   puede ser gran cocina con servicio lento, y son departamentos distintos.
 *   La de comida suele llegar ya puesta desde el correo (el cliente pulsó una
 *   estrella allí), así que aquí solo tiene que completar lo que quiera.
 *
 * - simple (QR de la carta): una sola valoración, como siempre. No hay visita
 *   concreta que desglosar.
 *
 * Servicio, ambiente y comentario son OPCIONALES a propósito: cuantos menos
 * campos obligatorios, más gente termina.
 *
 * Si la empresa tiene activado `redirigir_5estrellas_google` y la nota final
 * es 5 → tras enviar redirige a Google. Con menos, queda interna.
 */

import { useState } from "react";
import { Loader2, Check, Star } from "lucide-react";

type Props = {
  token: string;
  nombreLead: string;
  nombreEmpresa: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  ratingInicial: number | null;
  redirigir5EstrellasGoogle: boolean;
  googleReviewUrl: string | null;
  /** true = token de reserva: se piden las valoraciones por separado. */
  desglosado?: boolean;
  /**
   * Qué preguntas enseña la encuesta, según lo que cada empresa haya activado
   * en Reservas → Configuración → Comunicaciones. Solo aplica en modo
   * desglosado. Si se apagan todas, queda la nota general de siempre.
   */
  campos?: { cocina: boolean; servicio: boolean; ambiente: boolean };
  /**
   * true = con este enlace ya se valoró antes. Se enseña el agradecimiento en
   * vez del formulario: solo se admite una valoración por visita, y dejar el
   * formulario abierto haría creer que la segunda cuenta cuando se descarta.
   */
  yaRespondio?: boolean;
};

const LEYENDA = [
  "",
  "Lo sentimos",
  "No fue lo esperado",
  "Está bien",
  "Muy bueno",
  "¡Excelente!",
];

export function ResenaForm({
  token,
  nombreLead,
  nombreEmpresa,
  logoUrl,
  colorPrimario,
  ratingInicial,
  redirigir5EstrellasGoogle,
  googleReviewUrl,
  desglosado = false,
  campos = { cocina: true, servicio: true, ambiente: true },
  yaRespondio = false,
}: Props) {
  // Si la empresa apagó todas las preguntas, no hay nada que desglosar: se cae
  // a la estrella única, que se pregunta siempre.
  const desglose = desglosado && (campos.cocina || campos.servicio || campos.ambiente);
  // La nota que llega del correo es la valoración GENERAL de la experiencia.
  // En modo desglosado se usa como punto de partida de las tres categorías:
  // así el cliente ve reflejado el clic que ya hizo y solo corrige lo que
  // difiera, en vez de empezar de cero.
  const [comida, setComida] = useState<number>(ratingInicial ?? 0);
  const [servicio, setServicio] = useState<number>(
    desglose ? (ratingInicial ?? 0) : 0,
  );
  const [ambiente, setAmbiente] = useState<number>(
    desglose ? (ratingInicial ?? 0) : 0,
  );
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Si ya se valoró con este enlace, se entra directamente en la pantalla de
  // agradecimiento (mismo destino que tras enviar).
  const [exito, setExito] = useState(yaRespondio);
  const [error, setError] = useState<string | null>(null);

  const color = colorPrimario || "#0ea5e9";

  /**
   * Nota global: media de lo que haya puntuado. Es la que decide Google.
   * Solo entran las preguntas que la empresa enseña: una nota apagada podría
   * conservar un valor de arranque y falsear la media.
   */
  const notas = (
    desglose
      ? [
          campos.cocina ? comida : 0,
          campos.servicio ? servicio : 0,
          campos.ambiente ? ambiente : 0,
        ]
      : [comida]
  ).filter((n) => n > 0);
  const media =
    notas.length > 0
      ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length)
      : 0;

  const onSubmit = async () => {
    if (media < 1) {
      setError("Pulsa una estrella para valorar");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/visita/resena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating: media,
          comentario: comentario.trim(),
          ...(desglose
            ? {
                ratingComida: (campos.cocina && comida) || undefined,
                ratingServicio: (campos.servicio && servicio) || undefined,
                ratingAmbiente: (campos.ambiente && ambiente) || undefined,
              }
            : {}),
        }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        redirect?: string;
      };
      if (!r.ok || !body.ok) {
        throw new Error(body.error || `Error ${r.status}`);
      }
      if (
        media === 5 &&
        redirigir5EstrellasGoogle &&
        (body.redirect || googleReviewUrl)
      ) {
        window.location.href = body.redirect || googleReviewUrl!;
        return;
      }
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={nombreEmpresa}
            className="mx-auto mb-3 h-14 w-auto object-contain"
          />
        ) : (
          <div className="mb-3 text-xl font-bold" style={{ color }}>
            {nombreEmpresa}
          </div>
        )}
      </div>

      {exito ? (
        <div className="w-full rounded-2xl bg-white p-8 text-center shadow-lg">
          <div
            className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ background: color }}
          >
            <Check className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">
            ¡Gracias{nombreLead ? `, ${nombreLead}` : ""}!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {yaRespondio
              ? "Ya habías valorado esta visita, así que tu opinión está registrada. Esperamos verte pronto."
              : "Tu opinión es muy importante para nosotros. Esperamos verte pronto."}
          </p>
        </div>
      ) : (
        <div className="w-full rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="text-center text-lg font-semibold text-gray-900">
            {nombreLead ? `Hola ${nombreLead}, ` : ""}¿qué tal lo pasaste?
          </h2>
          <p className="mt-1 text-center text-sm text-gray-600">
            {desglose
              ? "Ajusta lo que quieras y envía."
              : "Tu opinión nos ayuda a mejorar."}
          </p>

          {desglose ? (
            <div className="mt-6 space-y-4">
              {campos.cocina && (
                <FilaEstrellas label="Comida" valor={comida} onChange={setComida} color={color} />
              )}
              {campos.servicio && (
                <FilaEstrellas label="Servicio" valor={servicio} onChange={setServicio} color={color} />
              )}
              {campos.ambiente && (
                <FilaEstrellas label="Ambiente" valor={ambiente} onChange={setAmbiente} color={color} />
              )}
            </div>
          ) : (
            <>
              <Estrellas valor={comida} onChange={setComida} color={color} tamano="grande" />
              {comida > 0 && (
                <p className="mt-2 text-center text-xs font-medium" style={{ color }}>
                  {LEYENDA[comida]}
                </p>
              )}
            </>
          )}

          <div className="mt-5">
            <label className="block text-xs font-medium text-gray-700">
              ¿Quieres contarnos algo más?{" "}
              <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ outlineColor: color }}
              placeholder="Cuéntanos lo bueno y lo que podemos mejorar"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            onClick={onSubmit}
            disabled={enviando}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: color }}
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? "Enviando…" : "Enviar valoración"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Una categoría con su nombre a la izquierda y sus estrellas a la derecha. */
function FilaEstrellas({
  label,
  valor,
  onChange,
  color,
}: {
  label: string;
  valor: number;
  onChange: (n: number) => void;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <Estrellas valor={valor} onChange={onChange} color={color} tamano="normal" />
    </div>
  );
}

function Estrellas({
  valor,
  onChange,
  color,
  tamano,
}: {
  valor: number;
  onChange: (n: number) => void;
  color: string;
  tamano: "normal" | "grande";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cls = tamano === "grande" ? "h-10 w-10" : "h-7 w-7";
  return (
    <div
      className={
        tamano === "grande"
          ? "mt-6 flex items-center justify-center gap-1.5"
          : "flex items-center gap-0.5"
      }
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const activa = (hover ?? valor) >= n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded-full p-1 transition-transform hover:scale-110"
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
          >
            <Star
              className={`${cls} transition-colors`}
              style={{
                color: activa ? color : "#e5e7eb",
                fill: activa ? color : "transparent",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
