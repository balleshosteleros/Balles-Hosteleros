"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare2, MessageCircle, Phone, Fingerprint } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { FicharSheet } from "./FicharSheet";

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
  { href: "/m/tareas", label: "Tareas", icon: CheckSquare2, primary: true },
  { href: "/m/comunicacion", label: "Chat", icon: MessageCircle },
];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/m";
  const [ficharAbierto, setFicharAbierto] = useState(false);

  // La huella parte el menú en dos: dos entradas, el botón, dos entradas.
  const izquierda = items.slice(0, 2);
  const derecha = items.slice(2);

  const entrada = (item: NavItem) => {
    const Icon = item.icon;
    const active =
      item.href === "/m" ? pathname === "/m" : pathname.startsWith(item.href);
    return (
      <li key={item.href} className="flex-1">
        <Link
          href={item.href}
          prefetch={false}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 text-[10px] font-medium leading-tight transition-colors",
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon
            className={cn("h-5 w-5", item.primary && active && "h-6 w-6")}
            strokeWidth={active ? 2.4 : 2}
          />
          <span className="w-full truncate text-center">{item.label}</span>
        </Link>
      </li>
    );
  };

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
        {izquierda.map(entrada)}

        {/* FICHAR: no navega, abre la hoja de fichaje aquí mismo. El círculo
            sobresale de la barra (margen negativo); el layout recorta solo en
            horizontal (`overflow-x-clip`), así que el saliente se ve. */}
        <li className="flex-1">
          <button
            type="button"
            onClick={() => setFicharAbierto(true)}
            aria-label="Fichar"
            className="flex h-full w-full flex-col items-center justify-start"
          >
            <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-colors active:bg-emerald-600">
              <Fingerprint className="h-7 w-7" strokeWidth={2.2} />
            </span>
            <span className="mt-0.5 w-full truncate text-center text-[10px] font-medium leading-tight text-muted-foreground">
              Fichar
            </span>
          </button>
        </li>

        {derecha.map(entrada)}
      </ul>

      <FicharSheet abierto={ficharAbierto} onCerrar={() => setFicharAbierto(false)} />
    </nav>
  );
}
