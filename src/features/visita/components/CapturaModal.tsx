"use client";

/**
 * Pop-up de captura de lead en la landing /v/[slug].
 *
 * - Aparece automáticamente tras 12 segundos viendo la página, o si el
 *   usuario pulsa el botón de "Suscribirme" desde el hero.
 * - Una sola sesión: si el visitante lo cierra o lo envía, no vuelve a
 *   aparecer en la misma navegación (localStorage por empresa).
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Check, X } from "lucide-react";

type Props = {
  empresaId: string;
  empresaSlug: string;
  colorPrimario: string | null;
  titulo: string;
  subtitulo: string;
  botonTexto: string;
};

const AUTO_OPEN_MS = 12_000;

function lsKey(slug: string): string {
  return `visita_capturado_${slug}`;
}

export function CapturaModal({
  empresaId,
  empresaSlug,
  colorPrimario,
  titulo,
  subtitulo,
  botonTexto,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggeredRef = useRef(false);

  // Auto-open tras AUTO_OPEN_MS, salvo que ya se haya capturado en esta sesión.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(lsKey(empresaSlug))) return;

    const onAbrirManual = () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      setAbierto(true);
    };

    window.addEventListener("visita:abrir-captura", onAbrirManual);

    const t = setTimeout(() => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      setAbierto(true);
    }, AUTO_OPEN_MS);

    return () => {
      clearTimeout(t);
      window.removeEventListener("visita:abrir-captura", onAbrirManual);
    };
  }, [empresaSlug]);

  const cerrar = () => {
    setAbierto(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(lsKey(empresaSlug), "cerrado");
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const nombre = String(formData.get("nombre") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const telefono = String(formData.get("telefono") ?? "").trim();
    const consentimiento = formData.get("consentimiento") === "on";

    if (!nombre) return setError("Cuéntanos tu nombre");
    if (!email && !telefono)
      return setError("Déjanos un email o un teléfono para poder escribirte");
    if (!consentimiento) return setError("Acepta el aviso de privacidad");

    setEnviando(true);
    try {
      const r = await fetch("/api/visita/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          empresa_slug: empresaSlug,
          nombre,
          email: email || null,
          telefono: telefono || null,
          consentimiento,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `Error ${r.status}`);
      }
      setExito(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(lsKey(empresaSlug), "enviado");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) return null;

  const color = colorPrimario || "#0ea5e9";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        style={{ borderTop: `4px solid ${color}` }}
      >
        <button
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>

        {exito ? (
          <div className="py-4 text-center">
            <div
              className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full text-white"
              style={{ background: color }}
            >
              <Check className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">¡Listo!</h3>
            <p className="mt-1 text-sm text-gray-600">
              Te escribiremos en breve con nuestras recomendaciones. ¡Que aproveche!
            </p>
            <button
              onClick={cerrar}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: color }}
            >
              Volver a la carta
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-900">{titulo}</h3>
            <p className="mt-1 text-sm text-gray-600">{subtitulo}</p>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Nombre
                </label>
                <input
                  name="nombre"
                  required
                  maxLength={80}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ outlineColor: color }}
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  maxLength={180}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ outlineColor: color }}
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Teléfono <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  name="telefono"
                  type="tel"
                  maxLength={30}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ outlineColor: color }}
                  placeholder="+34 600 00 00 00"
                />
              </div>

              <label className="flex items-start gap-2 text-[11px] text-gray-600">
                <input
                  type="checkbox"
                  name="consentimiento"
                  className="mt-0.5 h-3.5 w-3.5"
                />
                <span>
                  Acepto recibir comunicaciones y la{" "}
                  <a
                    href="/privacidad"
                    target="_blank"
                    rel="noopener"
                    className="underline"
                  >
                    política de privacidad
                  </a>
                  .
                </span>
              </label>

              {error && (
                <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: color }}
              >
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                {enviando ? "Enviando…" : botonTexto}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
