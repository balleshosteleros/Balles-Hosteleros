"use client";

/**
 * Formulario público de reseña. Recibe el token, muestra 5 estrellas
 * grandes, un comentario opcional, y al enviar POSTea a /api/visita/resena.
 *
 * Si la empresa tiene activado `redirigir_5estrellas_google` y el cliente
 * elige 5 estrellas → tras enviar redirige a Google Reviews. Si elige
 * menos, la reseña queda interna (se ve en /calidad/resenas).
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
};

export function ResenaForm({
  token,
  nombreLead,
  nombreEmpresa,
  logoUrl,
  colorPrimario,
  ratingInicial,
  redirigir5EstrellasGoogle,
  googleReviewUrl,
}: Props) {
  const [rating, setRating] = useState<number>(ratingInicial ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const color = colorPrimario || "#0ea5e9";

  const onSubmit = async () => {
    if (rating < 1) {
      setError("Pulsa una estrella para valorar");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/visita/resena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, comentario: comentario.trim() }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        redirect?: string;
      };
      if (!r.ok || !body.ok) {
        throw new Error(body.error || `Error ${r.status}`);
      }
      // Redirección Google si aplica.
      if (
        rating === 5 &&
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
      {/* Header */}
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
          <h2 className="text-xl font-semibold">¡Gracias, {nombreLead}!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Tu opinión es muy importante para nosotros. Esperamos verte pronto.
          </p>
        </div>
      ) : (
        <div className="w-full rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="text-center text-lg font-semibold text-gray-900">
            Hola {nombreLead}, ¿qué tal lo pasaste?
          </h2>
          <p className="mt-1 text-center text-sm text-gray-600">
            Tu opinión nos ayuda a mejorar.
          </p>

          {/* Estrellas */}
          <div
            className="mt-6 flex items-center justify-center gap-1.5"
            onMouseLeave={() => setHover(null)}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const activa = (hover ?? rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  className="rounded-full p-1 transition-transform hover:scale-110"
                  aria-label={`${n} estrellas`}
                >
                  <Star
                    className="h-10 w-10 transition-colors"
                    style={{
                      color: activa ? color : "#e5e7eb",
                      fill: activa ? color : "transparent",
                    }}
                  />
                </button>
              );
            })}
          </div>

          {rating > 0 && (
            <p className="mt-2 text-center text-xs font-medium" style={{ color }}>
              {["", "Lo sentimos", "No fue lo esperado", "Está bien", "Muy bueno", "¡Excelente!"][rating]}
            </p>
          )}

          {/* Comentario */}
          <div className="mt-5">
            <label className="block text-xs font-medium text-gray-700">
              ¿Quieres contarnos algo más? <span className="text-gray-400">(opcional)</span>
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
