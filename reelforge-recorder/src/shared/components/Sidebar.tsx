"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Video,
  Layers,
  Settings,
  LogOut,
  Sparkles,
  CreditCard,
  Monitor,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/record", label: "Grabar pantalla", icon: Monitor },
  { href: "/videos", label: "Mis Grabaciones", icon: Video },
  { href: "/captures", label: "Archivos Locales", icon: FolderOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 gradient-bg rounded-xl flex items-center justify-center text-white">
            <span className="text-lg">🎬</span>
          </div>
          <div>
            <p className="font-bold text-sm">ReelForge Recorder</p>
            <p className="text-xs text-muted-foreground">Herramienta de grabación</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "gradient-bg text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Quick actions */}
      <div className="p-4 border-t space-y-2">
        <Link href="/record">
          <Button variant="gradient" className="w-full gap-2 text-sm">
            <Monitor className="h-4 w-4" />
            Nueva Grabación
          </Button>
        </Link>
      </div>

      {/* Bottom */}
      <div className="p-4 border-t space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Settings className="h-4 w-4" />
          Configuración
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
