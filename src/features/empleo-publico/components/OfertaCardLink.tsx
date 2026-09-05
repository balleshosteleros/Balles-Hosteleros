"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";

/**
 * Tarjeta de vacante con acuse de recibo al pulsar.
 *
 * La oferta es `force-dynamic` y tarda en llegar: sin esto el candidato tocaba
 * y la tarjeta se quedaba igual, sin ninguna señal, así que creía que el portal
 * estaba roto y volvía a tocar (Iván, 05-sep). Al pulsar marcamos la tarjeta
 * como "abriendo" y la rueda sustituye a la flecha, de modo que la respuesta es
 * inmediata aunque la página aún esté cargando.
 */
export function OfertaCardLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);

  return (
    <Link
      href={href}
      prefetch={false}
      aria-busy={abriendo}
      onClick={(e) => {
        // Con modificadores o botón central el navegador abre en otra pestaña:
        // no marcamos nada porque esta página se queda donde está.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        setAbriendo(true);
        router.push(href);
      }}
      className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 md:p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--brand-primary)] active:scale-[0.99]"
    >
      {/* Relleno con el color de marca al pulsar la vacante */}
      <span
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 group-hover:opacity-[0.06] group-active:opacity-100 ${
          abriendo ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: "var(--brand-primary)" }}
      />
      <div className="relative flex items-start gap-4">
        <div className="flex-1 min-w-0">{children}</div>
        {abriendo ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--brand-text)]" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1 group-active:text-[var(--brand-text)]" />
        )}
      </div>
    </Link>
  );
}
