"use client";

/**
 * Landing pública /v/[slug] — estilo app móvil:
 *  - Contenido centrado vertical + horizontalmente.
 *  - Fondo elegante (foto si hay, si no degradado de marca).
 *  - Copy persuasivo orientado a que el cliente entienda que dejando los
 *    datos accede a la carta + los extras (no es una barrera, es un upgrade).
 *  - Animaciones de entrada stagger para que se sienta "rápido como una app".
 */

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { CapturaModal } from "./CapturaModal";
import type { VisitaPublica } from "../services/visita-fetch";

export function VisitaLanding({ visita }: { visita: VisitaPublica }) {
  const { empresa, config } = visita;
  const color = empresa.colorPrimario || "#0ea5e9";
  const colorSec = empresa.colorSecundario || "#0a0a0a";

  const incentivos = (config.bienvenida_subtitulo || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const abrirCaptura = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("visita:abrir-captura"));
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black text-white"
      style={{ minHeight: "100dvh" }}
    >
      {/* Fondo: foto si existe, si no degradado de marca elegante */}
      {empresa.heroUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={empresa.heroUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at top, ${color}55 0%, transparent 55%), linear-gradient(180deg, ${colorSec} 0%, #060606 100%)`,
          }}
        />
      )}

      {/* Overlay para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/85" />

      {/* Contenido centrado */}
      <div
        className="relative z-10 flex flex-1 flex-col px-6"
        style={{
          paddingTop: "max(28px, env(safe-area-inset-top))",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        {/* Logo arriba — pequeño y minimalista */}
        <header className="flex justify-center motion-safe:animate-[fadeDown_0.5s_ease-out]">
          {empresa.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logoUrl}
              alt={empresa.nombre}
              className="h-10 w-auto object-contain drop-shadow"
            />
          ) : (
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] opacity-90">
              {empresa.nombre}
            </div>
          )}
        </header>

        {/* Bloque central: headline + bullets + CTA */}
        <div className="my-auto mx-auto w-full max-w-sm space-y-7 text-center motion-safe:animate-[fadeUp_0.55s_ease-out_0.05s_both]">
          <h1 className="text-[30px] font-bold leading-[1.08] tracking-tight drop-shadow-sm sm:text-[34px]">
            {config.bienvenida_titulo}
          </h1>

          {incentivos.length > 0 && (
            <ul className="mx-auto inline-flex flex-col gap-2.5 text-left text-[15px] text-white/95">
              {incentivos.map((linea, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5"
                  style={{
                    animation: `fadeUp 0.5s ease-out ${0.2 + i * 0.08}s both`,
                  }}
                >
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full shadow"
                    style={{ background: color }}
                    aria-hidden
                  >
                    <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                  </span>
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
          )}

          {/* CTA principal */}
          <button
            onClick={abrirCaptura}
            className="group flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-semibold shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.97]"
            style={{
              background: color,
              color: "#fff",
              animation: "fadeUp 0.55s ease-out 0.45s both",
            }}
          >
            {config.popup_boton_texto}
            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Escape discreto centrado abajo */}
        <div
          className="flex justify-center pt-2 motion-safe:animate-[fadeUp_0.5s_ease-out_0.65s_both]"
        >
          <Link
            href={`/carta/${empresa.slug}`}
            className="px-3 py-2 text-[12px] font-medium text-white/55 underline-offset-4 transition-colors hover:text-white/90 hover:underline"
          >
            Ver carta sin suscribirse →
          </Link>
        </div>
      </div>

      {/* Animaciones inline para no añadir CSS global */}
      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Modal captura */}
      <CapturaModal
        empresaId={empresa.id}
        empresaSlug={empresa.slug}
        colorPrimario={empresa.colorPrimario}
        titulo={config.popup_titulo}
        subtitulo={config.popup_subtitulo}
        botonTexto={config.popup_boton_texto}
      />
    </div>
  );
}
