"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Fingerprint, LayoutGrid } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  primary?: boolean;
};

const items: readonly NavItem[] = [
  { href: "/m", label: "Inicio", icon: Home },
  { href: "/m/fichar", label: "Fichar", icon: Fingerprint, primary: true },
  { href: "/m/mas", label: "Más", icon: LayoutGrid },
];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/m";

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur pb-[max(env(safe-area-inset-bottom),0px)]"
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
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
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
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
