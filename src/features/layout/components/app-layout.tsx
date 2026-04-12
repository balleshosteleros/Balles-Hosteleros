"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/layout/components/app-sidebar";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  LogOut,
  UserCircle,
  Mail,
  Calendar as CalendarIcon,
} from "lucide-react";
import { FloatingSoporteButton } from "@/features/soporte/components";
import { EmpresaSelector } from "@/features/empresa/components/empresa-selector";
import {
  GmailDrawer,
  CalendarDrawer,
} from "@/features/google-workspace/components";

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
  "/marketing/fidelizacion": "FIDELIZACIÓN",
  "/marketing/captacion": "CAPTACIÓN",
  "/logistica/incidencias": "INCIDENCIAS",
  "/ajustes": "AJUSTES",
  "/ayuda": "AYUDA",
  "/consultas-pendientes": "CONSULTAS PENDIENTES",
  "/formacion": "ONBOARDING",
  "/agenda": "AGENDA",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, roles, signOut } = useAuth();
  const devBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  const showUi = !!user || devBypass;

  let title = ROUTE_TITLES[pathname] ?? "";
  if (!title && pathname.startsWith("/rrhh/empleados/")) title = "FICHA EMPLEADO";

  const rolLabel =
    roles.length > 0
      ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1)
      : devBypass
        ? "Dev"
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
            <div className="ml-auto flex items-center gap-2">
              {showUi && (
                <>
                  {/* Selector de empresa */}
                  <div className="hidden md:block w-52">
                    <EmpresaSelector />
                  </div>

                  <div className="hidden lg:block h-6 w-px bg-border" />

                  {/* Email integrado */}
                  <GmailDrawer>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 px-2"
                      title="Abrir email"
                    >
                      <Mail className="h-4 w-4 text-red-500" />
                      <span className="hidden xl:inline text-xs">Email</span>
                    </Button>
                  </GmailDrawer>

                  {/* Calendario integrado */}
                  <CalendarDrawer>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 px-2"
                      title="Abrir calendario"
                    >
                      <CalendarIcon className="h-4 w-4 text-blue-600" />
                      <span className="hidden xl:inline text-xs">Calendario</span>
                    </Button>
                  </CalendarDrawer>

                  <div className="hidden lg:block h-6 w-px bg-border" />

                  {/* Onboarding */}
                  <Button
                    asChild
                    size="sm"
                    className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20"
                  >
                    <Link href="/formacion">
                      <GraduationCap className="h-4 w-4" />
                      <span className="hidden lg:inline text-xs font-semibold tracking-wide">
                        ONBOARDING
                      </span>
                    </Link>
                  </Button>

                  <div className="hidden lg:block h-6 w-px bg-border" />

                  {/* Usuario */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserCircle className="h-4 w-4" />
                    <span className="hidden 2xl:inline">
                      {profile?.email ?? user?.email ?? "dev@local"}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {rolLabel}
                    </Badge>
                  </div>
                  {user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={signOut}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Salir</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        {showUi && <FloatingSoporteButton />}
      </div>
    </SidebarProvider>
  );
}
