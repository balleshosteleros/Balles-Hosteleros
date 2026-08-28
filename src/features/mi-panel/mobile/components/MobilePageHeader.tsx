"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useMobileIdentidad } from "./MobileIdentidadProvider";
import { EmpresaSwitcherMobile } from "./EmpresaSwitcherMobile";
import { EmpleadoMenuMobile } from "./EmpleadoMenuMobile";

interface Props {
  title: string;
  subtitle?: string;
  backHref?: string;
}

/**
 * Cabecera de las pantallas internas del móvil (módulos y submódulos).
 *
 * A la derecha van SIEMPRE los dos iconos juntos: el de la empresa (para poder
 * cambiar de empresa) y el del empleado. Estén donde estén, nunca desaparecen
 * (Iván, 28-ago) — antes solo salían en el Inicio y, al entrar en un módulo, no
 * había forma de cambiar de empresa sin volver atrás.
 */
export function MobilePageHeader({ title, subtitle, backHref = "/m" }: Props) {
  const { nombre, avatarUrl, empresaActual, empresas } = useMobileIdentidad();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border/60 bg-background/95 px-3 pt-[max(env(safe-area-inset-top),10px)] pb-3 backdrop-blur">
      <Link
        href={backHref}
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        aria-label="Volver"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Empresa + empleado: pareja fija, en todas las pantallas. */}
      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card py-0.5 pl-1 pr-0.5">
        <EmpresaSwitcherMobile
          empresaActual={empresaActual}
          empresas={empresas}
          size="sm"
        />
        <span className="h-5 w-px shrink-0 bg-border" />
        <EmpleadoMenuMobile nombre={nombre} avatarUrl={avatarUrl} size="sm" />
      </div>
    </header>
  );
}
