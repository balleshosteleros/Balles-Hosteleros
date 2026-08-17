"use client";

/**
 * Banner de consentimiento de cookies.
 *
 * POR QUÉ:
 * La política de cookies que genera el software promete un banner donde el
 * visitante puede aceptar o rechazar. Si el banner no existe, el documento
 * promete algo que no se cumple — y eso es peor que no decir nada.
 *
 * REQUISITOS DE LA AEPD QUE SE CUMPLEN AQUÍ:
 * - Rechazar es tan fácil como aceptar: dos botones, mismo tamaño y mismo peso
 *   visual, en la misma pantalla. Nada de "Rechazar" escondido en un enlace.
 * - Nada se instala antes de elegir: mientras no haya decisión, el estado es
 *   "denegado" (ver `hayConsentimiento`), así que la analítica no debe cargar.
 * - Retirar el consentimiento es tan fácil como darlo: el enlace
 *   "Configurar cookies" del pie reabre el banner (evento `pw-abrir-cookies`).
 * - Caduca a los 12 meses y se vuelve a preguntar.
 *
 * Deliberadamente simple: dos botones y una línea de texto. Cuanto menos texto,
 * más gente lo lee.
 */

import { useCallback, useEffect, useState } from "react";

const CLAVE = "pw_cookies_consentimiento";
const MESES_VALIDEZ = 12;

export type DecisionCookies = "aceptado" | "rechazado";

interface ConsentimientoGuardado {
  decision: DecisionCookies;
  fecha: string;
}

function leerConsentimiento(): ConsentimientoGuardado | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return null;

    const guardado = JSON.parse(crudo) as ConsentimientoGuardado;
    if (guardado.decision !== "aceptado" && guardado.decision !== "rechazado") return null;

    // Caducidad: pasados los meses de validez se vuelve a preguntar.
    const fecha = new Date(guardado.fecha);
    if (Number.isNaN(fecha.getTime())) return null;
    const caduca = new Date(fecha);
    caduca.setMonth(caduca.getMonth() + MESES_VALIDEZ);
    if (caduca.getTime() < Date.now()) return null;

    return guardado;
  } catch {
    return null;
  }
}

/**
 * Estado del consentimiento para quien necesite decidir si carga scripts.
 * Mientras no haya decisión explícita, devuelve `false`.
 */
export function hayConsentimiento(): boolean {
  return leerConsentimiento()?.decision === "aceptado";
}

interface Props {
  /** Ruta de la política de cookies, si la empresa la tiene publicada. */
  hrefPolitica?: string | null;
}

export function BannerCookies({ hrefPolitica }: Props) {
  const [visible, setVisible] = useState(false);
  const [montado, setMontado] = useState(false);

  // Regla MEMORY.md: nada que dependa de localStorage se pinta hasta montar,
  // o el servidor y el cliente renderizan cosas distintas.
  useEffect(() => {
    setMontado(true);
    if (!leerConsentimiento()) setVisible(true);
  }, []);

  // El enlace "Configurar cookies" del pie reabre el banner.
  useEffect(() => {
    const abrir = () => setVisible(true);
    window.addEventListener("pw-abrir-cookies", abrir);
    return () => window.removeEventListener("pw-abrir-cookies", abrir);
  }, []);

  const decidir = useCallback((decision: DecisionCookies) => {
    try {
      const registro: ConsentimientoGuardado = {
        decision,
        fecha: new Date().toISOString(),
      };
      window.localStorage.setItem(CLAVE, JSON.stringify(registro));
      window.dispatchEvent(new CustomEvent("pw-cookies-decidido", { detail: registro }));
    } catch {
      // Si el navegador bloquea el almacenamiento, no insistimos: se vuelve a
      // preguntar en la siguiente visita. Nunca se asume aceptación.
    }
    setVisible(false);
  }, []);

  if (!montado || !visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/15 bg-black/90 p-4 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-sm leading-snug text-white/85">
          Usamos cookies para mejorar tu experiencia.{" "}
          {hrefPolitica ? (
            <a
              href={hrefPolitica}
              className="underline underline-offset-2 hover:text-white"
            >
              Más información
            </a>
          ) : null}
        </p>

        {/* Los dos botones con el MISMO tamaño y peso: rechazar tiene que ser
            tan fácil como aceptar (criterio AEPD). */}
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decidir("rechazado")}
            className="flex-1 rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:flex-none"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => decidir("aceptado")}
            className="flex-1 rounded-full px-5 py-2 text-sm font-semibold text-black transition-transform hover:scale-105 sm:flex-none"
            style={{ backgroundColor: "var(--pw-primario)" }}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Enlace para reabrir el banner. Va en el pie de la web: retirar el
 * consentimiento debe ser tan fácil como darlo.
 */
export function EnlaceConfigurarCookies({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("pw-abrir-cookies"))}
      className={className ?? "text-white/60 underline underline-offset-2 hover:text-white"}
    >
      Configurar cookies
    </button>
  );
}
