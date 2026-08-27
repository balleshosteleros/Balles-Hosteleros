"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare2, MessageCircle, Phone, FolderOpen } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  primary?: boolean;
};

const items: readonly NavItem[] = [
  { href: "/m", label: "Inicio", icon: Home },
  { href: "/m/llamar", label: "Llamar", icon: Phone },
  { href: "/m/tareas", label: "Tareas", icon: CheckSquare2, primary: true },
  { href: "/m/comunicacion", label: "Chat", icon: MessageCircle },
  { href: "/m/archivos", label: "Archivos", icon: FolderOpen },
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
