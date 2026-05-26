"use client";

/**
 * Landing pública /v/[slug]. Hero a pantalla completa con foto del local,
 * logo, texto de bienvenida y dos botones: «Ver carta» (primario, va a
 * /carta/[slug]) y «Suscribirme» (abre el pop-up de captura).
 *
 * El pop-up también se abre solo tras 12 segundos.
 */

import Link from "next/link";
import { ChevronRight, Gift } from "lucide-react";
import { CapturaModal } from "./CapturaModal";
import type { VisitaPublica } from "../services/visita-fetch";

export function VisitaLanding({ visita }: { visita: VisitaPublica }) {
  const { empresa, config } = visita;
  const color = empresa.colorPrimario || "#0ea5e9";

  const abrirCaptura = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("visita:abrir-captura"));
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white">
      {/* HERO */}
      <section className="relative min-h-screen w-full overflow-hidden">
        {/* Foto de fondo */}
        {empresa.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={empresa.heroUrl}
            alt={empresa.nombre}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${empresa.colorSecundario || "#000"} 100%)`,
            }}
          />
        )}

        {/* Gradiente oscuro para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/85" />

        {/* Contenido */}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-6 py-8 text-center">
          {/* Logo */}
          <div className="pt-4">
            {empresa.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={empresa.logoUrl}
                alt={empresa.nombre}
                className="mx-auto h-16 w-auto object-contain drop-shadow-md"
              />
            ) : (
              <div className="text-base font-semibold tracking-wider opacity-90">
                {empresa.nombre.toUpperCase()}
              </div>
            )}
          </div>

          {/* Bienvenida */}
          <div className="my-auto max-w-md">
            <h1 className="text-3xl font-bold leading-tight tracking-tight drop-shadow-md sm:text-4xl">
              {config.bienvenida_titulo}
            </h1>
            {config.bienvenida_subtitulo && (
              <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
                {config.bienvenida_subtitulo}
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="flex w-full max-w-xs flex-col gap-3 pb-4">
            <Link
              href={`/carta/${empresa.slug}`}
              className="group flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold shadow-lg transition-transform hover:scale-[1.02]"
              style={{ background: color, color: "#fff" }}
            >
              Ver carta
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              onClick={abrirCaptura}
              className="flex items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <Gift className="h-4 w-4" />
              {config.popup_boton_texto}
            </button>
          </div>
        </div>
      </section>

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
