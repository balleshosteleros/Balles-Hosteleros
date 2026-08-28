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

      {/*
        Empresa + empleado: pareja fija, en todas las pantallas.

        Mismo pill que el software de ordenador (`bg-muted/40`), pero SIN nombre
        ni puesto: en el móvil ocupan demasiado y aquí manda el título de la
        pantalla (Iván, 28-ago). El fondo gris del pill es además lo que hace
        visible un isotipo de trazo fino, que sobre blanco se pierde.
      */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-full border bg-muted/40 px-1.5 py-1">
        <EmpresaSwitcherMobile
          empresaActual={empresaActual}
          empresas={empresas}
          size="sm"
        />
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <EmpleadoMenuMobile nombre={nombre} avatarUrl={avatarUrl} size="sm" />
      </div>
    </header>
  );
}
