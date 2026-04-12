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
  Crown,
  UtensilsCrossed,
  ChefHat,
  Briefcase,
  CheckCircle2,
  User,
  Camera,
  Truck,
  Calculator,
  FileText,
  Scale,
  Settings,
  MessageSquareWarning,
  ContactRound,
  Video,
  ClipboardList,
  Clock,
  Timer,
  UserRoundSearch,
  Package,
  Heart,
  UserPlus,
  AlertTriangle,
  Sparkles,
  KeyRound,
  LayoutDashboard,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { FloatingSoporteButton } from "@/features/soporte/components";
import { OnboardingGuard } from "@/features/formacion/components/OnboardingGuard";
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
  "/comunicacion": "COMUNICACIÓN",
  "/reuniones": "REUNIONES",
  "/agenda": "AGENDA",
  "/cocina/nuevos-platos": "NUEVOS PLATOS",
  "/cocina/fichas-tecnicas": "FICHAS TÉCNICAS",
  "/cocina/elaboraciones": "ELABORACIONES",
  "/cocina/partidas": "PARTIDAS",
  "/cocina/temperaturas": "TEMPERATURAS",
  "/sala": "SALA",
  "/sala/reservas": "RESERVAS",
  "/sala/clientes": "CLIENTES",
  "/sala/temperaturas": "TEMPERATURAS",
  "/direccion": "DIRECCIÓN",
  "/direccion/documentacion": "DOCUMENTACIÓN",
  "/direccion/aperturas": "APERTURAS",
  "/calidad": "CALIDAD",
  "/calidad/auditorias": "AUDITORÍAS",
  "/calidad/empleados": "CALIDAD — EMPLEADOS",
  "/calidad/clientes": "CALIDAD — CLIENTES",
  "/calidad/inspecciones": "INSPECCIONES",
  "/gerencia/descuentos": "DESCUENTOS",
  "/gerencia/ratios": "RATIOS",
  "/gerencia/comunicados": "COMUNICADOS",
  "/gerencia/encuestas": "ENCUESTAS",
  "/gerencia/vencimientos": "REVISIONES",
  "/rrhh/boarding": "BOARDING",
  "/rrhh/bonus": "BONUS",
  "/rrhh/salarios": "SALARIOS",
  "/rrhh/pagos": "PAGOS",
  "/rrhh/formacion": "FORMACIÓN",
  "/logistica/proveedores": "PROVEEDORES",
  "/logistica/pedidos": "PEDIDOS",
  "/logistica/stock": "STOCK",
  "/logistica/inventarios": "INVENTARIOS",
  "/contabilidad/contactos": "CONTACTOS",
  "/contabilidad/facturas": "FACTURAS",
  "/contabilidad/impuestos": "IMPUESTOS",
  "/contabilidad/transacciones": "TRANSACCIONES",
  "/contabilidad/conciliacion": "CONCILIACIÓN",
  "/contabilidad/calendario": "CALENDARIO",
  "/contabilidad/escenarios": "ESCENARIOS",
  "/contabilidad/bancos": "BANCOS",
  "/contabilidad/etiquetas": "ETIQUETAS",
  "/contabilidad/reglas": "REGLAS AUTOMÁTICAS",
  "/gestoria/presentaciones": "PRESENTACIONES",
  "/juridico/procesos": "PROCESOS",
  "/accesos": "ACCESOS",
};

const ROUTE_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/direccion": Crown,
  "/direccion/estructura": Crown,
  "/direccion/documentacion": FileText,
  "/direccion/aperturas": Crown,
  "/sala": UtensilsCrossed,
  "/sala/reservas": UtensilsCrossed,
  "/sala/clientes": UtensilsCrossed,
  "/sala/temperaturas": UtensilsCrossed,
  "/cocina": ChefHat,
  "/cocina/nuevos-platos": Sparkles,
  "/cocina/fichas-tecnicas": ChefHat,
  "/cocina/elaboraciones": ChefHat,
  "/cocina/partidas": ChefHat,
  "/cocina/temperaturas": ChefHat,
  "/gerencia": Briefcase,
  "/gerencia/mantenimiento": Briefcase,
  "/gerencia/descuentos": Briefcase,
  "/gerencia/ratios": Briefcase,
  "/gerencia/comunicados": Briefcase,
  "/gerencia/encuestas": Briefcase,
  "/gerencia/vencimientos": Briefcase,
  "/calidad": CheckCircle2,
  "/calidad/auditorias": ClipboardList,
  "/calidad/empleados": CheckCircle2,
  "/calidad/clientes": CheckCircle2,
  "/calidad/inspecciones": CheckCircle2,
  "/rrhh": User,
  "/rrhh/empleados": User,
  "/rrhh/fichajes": Clock,
  "/rrhh/calendarios": CalendarIcon,
  "/rrhh/horarios": Timer,
  "/rrhh/reclutamiento": UserRoundSearch,
  "/rrhh/boarding": User,
  "/rrhh/bonus": User,
  "/rrhh/salarios": User,
  "/rrhh/pagos": User,
  "/rrhh/formacion": GraduationCap,
  "/rrhh/comunicados": Briefcase,
  "/marketing": Camera,
  "/marketing/calendario": CalendarIcon,
  "/marketing/contenido": Camera,
  "/marketing/fidelizacion": Heart,
  "/marketing/captacion": UserPlus,
  "/logistica": Truck,
  "/logistica/proveedores": Truck,
  "/logistica/productos": Package,
  "/logistica/pedidos": Truck,
  "/logistica/stock": Package,
  "/logistica/inventarios": ClipboardList,
  "/logistica/incidencias": AlertTriangle,
  "/contabilidad": Calculator,
  "/gestoria": FileText,
  "/gestoria/presentaciones": FileText,
  "/juridico": Scale,
  "/juridico/procesos": Scale,
  "/ajustes": Settings,
  "/ayuda": HelpCircle,
  "/consultas-pendientes": MessageSquareWarning,
  "/formacion": GraduationCap,
  "/comunicacion": MessageSquareWarning,
  "/reuniones": Video,
  "/agenda": ContactRound,
  "/accesos": KeyRound,
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, roles, signOut } = useAuth();
  const devBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  const showUi = !!user || devBypass;

  let title = ROUTE_TITLES[pathname] ?? "";
  if (!title && pathname.startsWith("/rrhh/empleados/")) title = "FICHA EMPLEADO";
  const TitleIcon = ROUTE_ICONS[pathname] ?? null;

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
              <h1 className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground">
                {TitleIcon && <TitleIcon className="h-4 w-4" />}
                {title}
              </h1>
            )}
            <div className="ml-auto flex items-center gap-2">
              {showUi && (
                <>
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

                  {/* Bloque final: empresa + correo + rol + salir */}
                  <div className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-1 pr-2">
                    {/* Selector de empresa */}
                    <div className="w-44 md:w-52">
                      <EmpresaSelector />
                    </div>

                    <div className="hidden md:block h-7 w-px bg-border" />

                    {/* Correo + rol */}
                    <div className="hidden md:flex flex-col leading-tight">
                      <span
                        className="max-w-[180px] truncate text-[11px] font-semibold text-foreground"
                        title={profile?.email ?? user?.email ?? "dev@local"}
                      >
                        {profile?.email ?? user?.email ?? "dev@local"}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCircle className="h-3 w-3 text-muted-foreground" />
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wider"
                        >
                          {rolLabel}
                        </Badge>
                      </span>
                    </div>

                    {user && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={signOut}
                        title="Cerrar sesión"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <OnboardingGuard>{children}</OnboardingGuard>
          </main>
        </div>
        {showUi && <FloatingSoporteButton />}
      </div>
    </SidebarProvider>
  );
}
