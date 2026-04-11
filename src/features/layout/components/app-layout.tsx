"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/layout/components/app-sidebar";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, UserCircle } from "lucide-react";
import { FloatingSoporteButton } from "@/features/soporte/components";

const ROUTE_TITLES: Record<string, string> = {
  "/": "DASHBOARD",
  "/gerencia": "GERENCIA",
  "/direccion/estructura": "ESTRUCTURA JERÁRQUICA",
  "/gerencia/mantenimiento": "MANTENIMIENTO",
  "/contabilidad": "CONTABILIDAD",
  "/gestoria": "GESTORÍA",
  "/juridico": "JURÍDICO",
  "/rrhh": "RECURSOS HUMANOS",
  "/rrhh/empleados": "EMPLEADOS",
  "/rrhh/fichajes": "FICHAJES",
  "/rrhh/calendarios": "CALENDARIOS",
  "/rrhh/horarios": "HORARIOS",
  "/rrhh/reclutamiento": "RECLUTAMIENTO",
  "/rrhh/comunicados": "COMUNICADOS",
  "/logistica": "LOGÍSTICA",
  "/logistica/fichas-tecnicas": "FICHAS TÉCNICAS",
  "/logistica/partidas": "PARTIDAS",
  "/logistica/productos": "PRODUCTOS",
  "/marketing": "MARKETING",
  "/marketing/calendario": "CALENDARIO",
  "/marketing/contenido": "CONTENIDO",
  "/ajustes": "AJUSTES",
  "/ayuda": "AYUDA",
  "/consultas-pendientes": "CONSULTAS PENDIENTES",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, roles, signOut } = useAuth();

  let title = ROUTE_TITLES[pathname] ?? "";
  if (!title && pathname.startsWith("/rrhh/empleados/")) title = "FICHA EMPLEADO";

  const rolLabel =
    roles.length > 0
      ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1)
      : "—";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 shrink-0 gap-3">
            <SidebarTrigger className="mr-2" />
            {title && (
              <h1 className="text-sm font-bold tracking-wide text-foreground">{title}</h1>
            )}
            <div className="ml-auto flex items-center gap-3">
              {user && (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {profile?.email ?? user.email}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {rolLabel}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={signOut}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Salir</span>
                  </Button>
                </>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        {user && <FloatingSoporteButton />}
      </div>
    </SidebarProvider>
  );
}
