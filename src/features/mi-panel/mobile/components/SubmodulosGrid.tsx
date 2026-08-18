"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Building2 } from "lucide-react";
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
 * Redirecciones solo-móvil: algún submódulo tiene pantalla propia de teléfono
 * y la del sidebar es de escritorio. Aquí se cambia SOLO el destino, sin tocar
 * la navegación de escritorio ni añadir botones que allí no existen: la rejilla
 * del móvil enseña los mismos submódulos que el ordenador, ni uno más.
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
 * Submódulos con pantalla propia de teléfono: misma entrada que en el ordenador
 * (mismo título, mismo icono, mismo sitio), pero el enlace lleva a la versión
 * móvil en vez de a la de escritorio.
 *
 * PEDIDOS: la recepción de albaranes (subir por foto con OCR y recibir la
 * mercancía de un pedido) colgaba de un botón suelto "ALBARANES" que en el
 * ordenador NO existe, porque allí los albaranes son una pestaña DENTRO de
 * Pedidos. Se fusionó para que la estructura sea la misma en los dos sitios:
 * esa pantalla, sin tocarla por dentro, es ahora la de Pedidos en móvil.
 */
const RUTA_MOVIL: Record<string, string> = {
  "/logistica/pedidos": "/m/pedidos",
};

/**
 * Submódulos que NO se muestran en el teléfono.
 *
 * MÚSICA es de ordenador a propósito: la música del local suena en el equipo
 * conectado a los altavoces, y ese equipo nunca es un móvil. Enseñar aquí la
 * pantalla completa (subir canciones, horarios, biblioteca) solo invitaría a
 * intentar poner música desde el teléfono, que es justo lo que no queremos.
 *
 * Ojo: esto oculta la ENTRADA de la rejilla, no el mini reproductor de la barra
 * superior, que ya es solo de escritorio por su propio `hidden lg:flex`.
 */
const OCULTOS_EN_MOVIL = new Set<string>(["/sala/musica"]);

interface Props {
  deptoKey: string;
}

export function SubmodulosGrid({ deptoKey }: Props) {
  const { puedeVer, permisosLoaded, esAdminPlataforma } = useAuth();

  const section = allSections.find((s) => s.key === deptoKey);
  const hue = HUE_POR_KEY[deptoKey] ?? 220;

  const items = useMemo<SubItem[]>(() => {
    if (!section) return [];
    // Los mismos submódulos que el sidebar, solo se reapunta el destino de los
    // que tienen pantalla de móvil propia.
    return section.items
      .filter((it) => !OCULTOS_EN_MOVIL.has(it.url))
      .map((it) => (RUTA_MOVIL[it.url] ? { ...it, url: RUTA_MOVIL[it.url] } : it));
  }, [section]);

  const permitido = useMemo(() => {
    if (!section) return false;
    if (esAdminPlataforma) return true;
    if (!permisosLoaded) return null; // aún cargando
    return puedeVer(section.modulo);
  }, [section, esAdminPlataforma, permisosLoaded, puedeVer]);

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
    // Mismo escalado proporcional que `MasGrid` (ver comentario allí).
    <div
      className="grid grid-cols-3 gap-2.5 px-5 pt-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      style={{ containerType: "inline-size" }}
    >
      {items.map((it) => {
        const Icon = it.icon as LucideIcon;
        return (
          <Link
            key={it.url}
            href={it.url}
            className="group relative flex aspect-square flex-col items-center justify-center gap-[4cqi] overflow-hidden rounded-2xl border text-center font-medium shadow-sm transition-all active:scale-[0.97]"
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
              className="relative flex items-center justify-center rounded-xl text-white shadow-sm"
              style={{
                width: "clamp(2.75rem, 12cqi, 4rem)",
                height: "clamp(2.75rem, 12cqi, 4rem)",
                background: `linear-gradient(145deg, hsl(${hue} 75% 58%) 0%, hsl(${hue} 70% 46%) 100%)`,
                boxShadow: `0 3px 10px -2px hsl(${hue} 70% 45% / 0.5)`,
              }}
            >
              <Icon className="h-1/2 w-1/2" strokeWidth={2.1} />
            </span>
            <span
              className="relative px-1 leading-tight"
              style={{
                color: `hsl(${hue} 45% 28%)`,
                textTransform: "none",
                fontSize: "clamp(0.75rem, 3.2cqi, 0.95rem)",
              }}
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
