"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Crown,
  UtensilsCrossed,
  ChefHat,
  Briefcase,
  CheckCircle2,
  User,
  Camera,
  Package,
  Calculator,
  FileText,
  Scale,
  Boxes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useModuloDisponible } from "@/features/empresa/contexts/catalogo-empresa-context";
import { hueDeTile } from "@/features/mi-panel/mobile/lib/tile-hue";

/**
 * Cuadraditos de "Mis Departamentos" (móvil). Mismo lenguaje visual que
 * `MasGrid` (Mis Paneles): rejilla plana de 3 columnas, tarjeta cuadrada con
 * el tinte que le toca por su fila e icono en recuadro con gradiente. Aquí cada cuadradito es un
 * DEPARTAMENTO, no un acceso personal.
 *
 * De momento solo mostramos los departamentos; sus submódulos se irán abriendo
 * poco a poco, por eso cada tile enlaza a `/m/departamentos/[key]`.
 */
type Depto = {
  key: string;
  /** Clave de permiso que consume `puedeVer()` (uppercase con acentos). */
  modulo: string;
  label: string;
  icon: LucideIcon;
};

// El tinte no va en el departamento: lo pone `hueDeTile` según la fila que
// ocupe, igual que en «Mis paneles» (ver `tile-hue.ts`).
const DEPARTAMENTOS: Depto[] = [
  { key: "direccion", modulo: "DIRECCIÓN", label: "Dirección", icon: Crown },
  { key: "producto", modulo: "PRODUCTO", label: "Producto", icon: Boxes },
  { key: "sala", modulo: "SALA", label: "Sala", icon: UtensilsCrossed },
  { key: "cocina", modulo: "COCINA", label: "Cocina", icon: ChefHat },
  { key: "gerencia", modulo: "GERENCIA", label: "Gerencia", icon: Briefcase },
  { key: "calidad", modulo: "CALIDAD", label: "Calidad", icon: CheckCircle2 },
  { key: "rrhh", modulo: "RECURSOS HUMANOS", label: "Recursos Humanos", icon: User },
  { key: "marketing", modulo: "MARKETING", label: "Marketing", icon: Camera },
  { key: "logistica", modulo: "LOGÍSTICA", label: "Logística", icon: Package },
  { key: "contabilidad", modulo: "CONTABILIDAD", label: "Contabilidad", icon: Calculator },
  { key: "gestoria", modulo: "GESTORÍA", label: "Gestoría", icon: FileText },
  { key: "juridico", modulo: "JURÍDICO", label: "Jurídico", icon: Scale },
];

export function DepartamentosGrid() {
  const { puedeVer, permisosLoaded, esAdminPlataforma } = useAuth();
  const moduloDisponible = useModuloDisponible();

  const tiles = useMemo(() => {
    // El catálogo de la EMPRESA manda incluso para dirección: si aquí no existe
    // ese departamento, no hay módulo que enseñar a nadie.
    const enLaEmpresa = DEPARTAMENTOS.filter((d) => moduloDisponible(d.modulo));
    // Admin de plataforma (DIRECCIÓN): bypass total, ve todos los departamentos.
    if (esAdminPlataforma) return enLaEmpresa;
    // Hasta que carguen permisos no mostramos nada para evitar el parpadeo
    // "todo abierto" → "filtrado".
    if (!permisosLoaded) return [];
    return enLaEmpresa.filter((d) => puedeVer(d.modulo));
  }, [esAdminPlataforma, permisosLoaded, puedeVer, moduloDisponible]);

  if (permisosLoaded && tiles.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          <Briefcase className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-semibold">Sin departamentos</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          No tienes departamentos asignados todavía.
        </p>
      </div>
    );
  }

  return (
    // Mismo escalado proporcional que `MasGrid`: sin `cqi` los cuadros crecían
    // con la pantalla pero el icono se quedaba fijo, y en móviles anchos se
    // veían diminutos dentro de recuadros enormes.
    <div
      className="grid grid-cols-3 gap-2.5 px-5 pt-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      style={{ containerType: "inline-size" }}
    >
      {tiles.map((d, i) => {
        const Icon = d.icon;
        const hue = hueDeTile(i, tiles.length);
        return (
          <Link
            key={d.key}
            href={`/m/departamentos/${d.key}`}
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
                fontSize: "clamp(0.75rem, 3.2cqi, 0.95rem)",
              }}
            >
              {d.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
