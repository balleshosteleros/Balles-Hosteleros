"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare2, MessageCircle, Phone, Fingerprint } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  primary?: boolean;
  /** Botón destacado del centro: círculo elevado, más grande que el resto. */
  destacado?: boolean;
};

// Fichar va en el CENTRO y destacado a propósito: es lo que más veces al día
// hace un empleado, y hasta ahora la única forma de fichar era cazar el aviso
// automático en su ventana de ±15 min. Si se te pasaba, no había manera de
// fichar desde ningún sitio (nadie enlazaba a /m/fichar).
const items: readonly NavItem[] = [
  { href: "/m", label: "Inicio", icon: Home },
  { href: "/m/llamar", label: "Llamar", icon: Phone },
  { href: "/m/fichar", label: "Fichar", icon: Fingerprint, destacado: true },
  { href: "/m/tareas", label: "Tareas", icon: CheckSquare2, primary: true },
  { href: "/m/comunicacion", label: "Chat", icon: MessageCircle },
];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/m";

  return (
    <nav
      aria-label="Navegación principal"
      // `fixed bottom-0` se ancla al documento, y en iOS Safari la barra se despega
      // al hacer scroll (cuando aparece/desaparece la barra del navegador). Con
      // `position: sticky` sobre el contenedor a altura de pantalla completa, la
      // barra queda pegada abajo SIEMPRE, sin saltos. La altura se publica en
      // --nav-h para que cada pantalla reserve exactamente ese hueco.
      style={{ height: "var(--nav-h)" }}
      className="sticky bottom-0 z-50 mt-auto w-full shrink-0 border-t border-border/60 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/m" ? pathname === "/m" : pathname.startsWith(item.href);
          if (item.destacado) {
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-label={item.label}
                  className="flex h-full flex-col items-center justify-start"
                >
                  {/* Círculo elevado: sube sobre la barra con margen negativo y
                      se recorta contra el fondo para que el relieve se vea. El
                      contenedor de la barra NO puede recortarlo (no lleva
                      overflow hidden), así que el saliente queda visible. */}
                  <span
                    className={cn(
                      "-mt-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background shadow-lg transition-colors",
                      active
                        ? "bg-emerald-600 text-white shadow-emerald-600/30"
                        : "bg-emerald-500 text-white shadow-emerald-500/30 active:bg-emerald-600",
                    )}
                  >
                    <Icon className="h-7 w-7" strokeWidth={active ? 2.6 : 2.2} />
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 w-full truncate text-center text-[10px] font-medium leading-tight",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                // Sin prefetch: el layout de /m es `force-dynamic`, así que cada
                // prefetch NO es gratis — ejecuta el layout entero en el
                // servidor (sesión, guard de empleado, datos). Con la barra
                // siempre en pantalla, Next los lanzaba todos a la vez y en los
                // logs se veían GET simultáneos a tareas, solicitudes, points,
                // perfil, pagos, llamar, horario… en el mismo segundo. Esa
                // avalancha es la que tumbaba la pestaña en móviles con poca
                // memoria. La navegación sigue siendo instantánea al tocar.
                prefetch={false}
                className={cn(
                  // 5 iconos dejan ~62 px por celda en un iPhone SE: la
                  // etiqueta se achica un punto y no se parte en dos líneas.
                  "flex flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 text-[10px] font-medium leading-tight transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    item.primary && active && "h-6 w-6",
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
