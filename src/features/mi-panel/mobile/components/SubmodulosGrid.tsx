"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Camera, Building2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { allSections, type SubItem } from "@/features/layout/data/nav-routes";

/**
 * Cuadraditos de los SUBMÓDULOS de un departamento (móvil). Mismo lenguaje
 * visual que `DepartamentosGrid` / `MasGrid`: rejilla de 3 columnas, tarjeta
 * cuadrada con tinte por `hue` (el del departamento, para coherencia de color).
 *
 * Fuente única: `allSections` de nav-routes (la misma que el sidebar de
 * escritorio), así los submódulos, su orden, sus iconos y sus rutas NO se
 * duplican. El gate de permiso es por DEPARTAMENTO (section.modulo), igual que
 * el sidebar: si ves el departamento, ves todos sus submódulos.
 *
 * Extras solo-móvil: algún submódulo existe únicamente en la app del teléfono
 * (p.ej. ALBARANES → recepción por foto en /m/albaranes) y se inyecta aquí sin
 * tocar la navegación de escritorio.
 */

/** Tinte del departamento (mismo `hue` que en DepartamentosGrid). */
const HUE_POR_KEY: Record<string, number> = {
  direccion: 211,
  sala: 211,
  cocina: 211,
  gerencia: 211,
  calidad: 192,
  rrhh: 192,
  marketing: 192,
  logistica: 192,
  contabilidad: 231,
  gestoria: 231,
  juridico: 252,
};

/**
 * Submódulos que solo existen en móvil, por departamento. Se añaden a los del
 * sidebar (que son pantallas de escritorio) para no perder accesos que ya
 * funcionan en el teléfono.
 */
const EXTRAS_MOVIL: Record<string, SubItem[]> = {
  logistica: [{ title: "ALBARANES", url: "/m/albaranes", icon: Camera }],
};

interface Props {
  deptoKey: string;
}

export function SubmodulosGrid({ deptoKey }: Props) {
  const { puedeVer, permisosLoaded, hasRole } = useAuth();

  const section = allSections.find((s) => s.key === deptoKey);
  const hue = HUE_POR_KEY[deptoKey] ?? 220;

  const items = useMemo<SubItem[]>(() => {
    if (!section) return [];
    const extras = EXTRAS_MOVIL[deptoKey] ?? [];
    return [...section.items, ...extras];
  }, [section, deptoKey]);

  const permitido = useMemo(() => {
    if (!section) return false;
    if (hasRole("director") || hasRole("admin")) return true;
    if (!permisosLoaded) return null; // aún cargando
    return puedeVer(section.modulo);
  }, [section, hasRole, permisosLoaded, puedeVer]);

  // Sin acceso (o departamento sin submódulos): estado vacío neutro.
  if (permitido === false || (permitido && items.length === 0)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          <Building2 className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-semibold">Sin opciones</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          No tienes acceso a este departamento o aún no tiene opciones en móvil.
        </p>
      </div>
    );
  }

  // Mientras cargan permisos no pintamos nada (evita parpadeo).
  if (permitido === null) return null;

  return (
    <div className="grid grid-cols-3 gap-2.5 px-5 pt-2">
      {items.map((it) => {
        const Icon = it.icon as LucideIcon;
        return (
          <Link
            key={it.url}
            href={it.url}
            className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border text-center text-xs font-medium shadow-sm transition-all active:scale-[0.97]"
            style={{
              borderColor: `hsl(${hue} 60% 60% / 0.25)`,
              background: `linear-gradient(160deg, hsl(${hue} 70% 97%) 0%, hsl(${hue} 65% 92%) 100%)`,
              boxShadow: `0 1px 8px -2px hsl(${hue} 60% 50% / 0.18)`,
            }}
          >
            {/* Brillo futurista superior */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-6 left-1/2 h-12 w-20 -translate-x-1/2 rounded-full blur-xl"
              style={{ background: `hsl(${hue} 80% 70% / 0.35)` }}
            />
            <span
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
              style={{
                background: `linear-gradient(145deg, hsl(${hue} 75% 58%) 0%, hsl(${hue} 70% 46%) 100%)`,
                boxShadow: `0 3px 10px -2px hsl(${hue} 70% 45% / 0.5)`,
              }}
            >
              <Icon className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <span
              className="relative px-1 leading-tight"
              style={{ color: `hsl(${hue} 45% 28%)`, textTransform: "none" }}
            >
              {/* Sentence case: el sidebar usa MAYÚSCULAS, en móvil lo suavizamos. */}
              {it.title.charAt(0) + it.title.slice(1).toLowerCase()}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
