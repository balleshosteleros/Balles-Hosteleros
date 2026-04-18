"use client";

import { usePathname, useRouter } from "next/navigation";
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
  CheckSquare2,
  Phone,
  MessageSquare,
  ClipboardList,
  Clock,
  Timer,
  UserRoundSearch,
  Package,
  Heart,
  UserPlus,
  Globe,
  AlertTriangle,
  Sparkles,
  KeyRound,
  LayoutDashboard,
  HelpCircle,
  Carrot,
  ShoppingCart,
  Warehouse,
  Apple,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingSoporteButton } from "@/features/soporte/components";
import { OnboardingGuard } from "@/features/formacion/components/OnboardingGuard";
import { EmpresaSelector } from "@/features/empresa/components/empresa-selector";
import {
  GmailDrawer,
  CalendarDrawer,
  MeetDrawer,
  TareasDrawer,
  ChatDrawer,
  TelefonoDrawer,
  useDailyCounts,
} from "@/features/google-workspace/components";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getAccesosAppsPorEmpresa } from "@/features/rrhh/data/accesos-apps";
import { ExternalLink } from "lucide-react";

const ROUTE_TITLES: Record<string, string> = {
  "/": "DASHBOARD",
  "/gerencia": "GERENCIA",
  "/direccion/estructura": "ORGANIGRAMA",
  "/direccion/cronogramas": "CRONOGRAMAS",
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
  "/marketing/carta-digital": "CARTA DIGITAL",
  "/marketing/pagina-web": "PÁGINA WEB",
  "/marketing/fidelizacion": "FIDELIZACIÓN",
  "/marketing/captacion": "CAPTACIÓN",
  "/logistica/incidencias": "INCIDENCIAS",
  "/ajustes": "AJUSTES",
  "/ayuda": "AYUDA",
"/formacion": "ONBOARDING",
  "/comunicacion": "COMUNICACIÓN",
  "/reuniones": "REUNIONES",
  "/agenda": "AGENDA",
  "/cocina/comandas": "COMANDAS",
  "/cocina/nuevas-recetas": "NUEVAS RECETAS",
  "/cocina/fichas-tecnicas": "FICHAS TÉCNICAS",
  "/cocina/elaboraciones": "ELABORACIONES",
  "/cocina/partidas": "PARTIDAS",
  "/cocina/temperaturas": "TEMPERATURAS",
  "/sala": "SALA",
  "/sala/reservas": "RESERVAS",
  "/sala/clientes": "CLIENTES",
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
};

const ROUTE_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/direccion": Crown,
  "/direccion/estructura": Crown,
  "/direccion/cronogramas": CalendarIcon,
  "/direccion/documentacion": FileText,
  "/direccion/aperturas": Crown,
  "/sala": UtensilsCrossed,
  "/sala/reservas": UtensilsCrossed,
  "/sala/clientes": UtensilsCrossed,
  "/cocina": ChefHat,
  "/cocina/comandas": Timer,
  "/cocina/nuevas-recetas": Sparkles,
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
  "/marketing/carta-digital": Camera,
  "/marketing/pagina-web": Globe,
  "/marketing/fidelizacion": Heart,
  "/marketing/captacion": UserPlus,
  "/logistica": Package,
  "/logistica/proveedores": Truck,
  "/logistica/productos": Apple,
  "/logistica/pedidos": ShoppingCart,
  "/logistica/stock": Warehouse,
  "/logistica/inventarios": ClipboardList,
  "/logistica/incidencias": AlertTriangle,
  "/contabilidad": Calculator,
  "/gestoria": FileText,
  "/gestoria/presentaciones": FileText,
  "/juridico": Scale,
  "/juridico/procesos": Scale,
  "/ajustes": Settings,
  "/ayuda": HelpCircle,
"/formacion": GraduationCap,
  "/comunicacion": MessageSquareWarning,
  "/reuniones": Video,
  "/agenda": ContactRound,
};

function AccesosIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14.5" y="17.5" width="5" height="3.5" rx="0.8" />
      <path d="M15.5 17.5v-1.2a1.5 1.5 0 0 1 3 0v1.2" />
    </svg>
  );
}

function NavBadge({ count, color = "blue" }: { count: number; color?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={`absolute -top-0.5 -right-0.5 flex items-center justify-center h-3.5 min-w-3.5 px-0.5 rounded-full text-white text-[8px] font-bold leading-none ${
        color === "blue" ? "bg-blue-600" : color === "emerald" ? "bg-emerald-600" : "bg-violet-600"
      }`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, roles, signOut } = useAuth();
  const devBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  const showUi = !!user || devBypass;
  const counts = useDailyCounts();

  let title = ROUTE_TITLES[pathname] ?? "";
  if (!title && pathname.startsWith("/rrhh/empleados/")) title = "FICHA EMPLEADO";
  const TitleIcon = ROUTE_ICONS[pathname] ?? null;

  const rolLabel =
    roles.length > 0
      ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1)
      : devBypass
        ? "Director"
        : "—";

  const router = useRouter();
  const userEmail = profile?.email ?? user?.email ?? "dev@local";
  const userInitial = userEmail[0].toUpperCase();
  const userName = profile?.nombre
    ? profile.apellidos
      ? `${profile.nombre} ${profile.apellidos}`
      : profile.nombre
    : devBypass
      ? "Ivan Ballesteros"
      : userEmail.split("@")[0];
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);
  const { empresaActual } = useEmpresa();
  const accesosApps = getAccesosAppsPorEmpresa(empresaActual.id).filter((a) => a.estado === "Activo");
  const appsCategories = Array.from(new Set(accesosApps.map((a) => a.categoria)));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 shrink-0 gap-3">
            {title && (
              <h1 className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground">
                {TitleIcon && <TitleIcon className="h-4 w-4" />}
                {title}
              </h1>
            )}
            <div className="ml-auto flex items-center gap-3">
              {showUi && (
                <>
                  {/* Integraciones: email + calendario + meet + tareas */}
                  <div className="flex items-center rounded-full border bg-muted/40 px-1 py-0.5 gap-0.5">
                    {/* Email */}
                    <GmailDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-7 w-7"
                        title="Correo"
                      >
                        <Mail className="h-4 w-4 text-red-500" />
                        <NavBadge count={counts.emails} color="blue" />
                      </Button>
                    </GmailDrawer>

                    {/* Calendario */}
                    <CalendarDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-7 w-7"
                        title="Calendario"
                      >
                        <CalendarIcon className="h-4 w-4 text-blue-600" />
                        <NavBadge count={counts.events} color="blue" />
                      </Button>
                    </CalendarDrawer>

                    {/* Google Meet */}
                    <MeetDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-7 w-7"
                        title="Reuniones Meet"
                      >
                        <Video className="h-4 w-4 text-emerald-600" />
                        <NavBadge count={counts.meetings} color="emerald" />
                      </Button>
                    </MeetDrawer>

                    {/* Tareas */}
                    <TareasDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-7 w-7"
                        title="Mis tareas"
                      >
                        <CheckSquare2 className="h-4 w-4 text-violet-600" />
                        <NavBadge count={counts.tasks} color="violet" />
                      </Button>
                    </TareasDrawer>

                    {/* Separador visual */}
                    <span className="w-px h-5 bg-border mx-0.5" />

                    {/* Chat / Comunicación */}
                    <ChatDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-7 w-7"
                        title="Comunicación interna"
                      >
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                      </Button>
                    </ChatDrawer>

                    {/* Teléfono VoIP */}
                    <TelefonoDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-7 w-7"
                        title="Teléfono"
                      >
                        <Phone className="h-4 w-4 text-sky-600" />
                      </Button>
                    </TelefonoDrawer>

                    {/* Accesos a apps externas */}
                    <DropdownMenu open={appsMenuOpen} onOpenChange={setAppsMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="relative h-7 w-7"
                          title="Accesos a aplicaciones"
                          onMouseEnter={() => setAppsMenuOpen(true)}
                        >
                          <AccesosIcon className="h-4 w-4 text-amber-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-72 max-h-[480px] overflow-y-auto"
                        onMouseLeave={() => setAppsMenuOpen(false)}
                      >
                        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                          Aplicaciones — {empresaActual.nombre}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {appsCategories.map((cat) => (
                          <div key={cat}>
                            <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {cat}
                            </p>
                            {accesosApps
                              .filter((a) => a.categoria === cat)
                              .map((app) => (
                                <DropdownMenuItem
                                  key={app.id}
                                  className="cursor-pointer gap-2 px-3 py-1.5"
                                  onSelect={() => window.open(app.url, "_blank", "noopener,noreferrer")}
                                >
                                  {app.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={app.logoUrl} alt="" className="h-4 w-4 rounded object-contain shrink-0" />
                                  ) : (
                                    <span className="text-sm leading-none shrink-0">{app.icono}</span>
                                  )}
                                  <span className="flex-1 text-xs font-medium truncate">{app.nombre}</span>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                                </DropdownMenuItem>
                              ))}
                            <DropdownMenuSeparator />
                          </div>
                        ))}
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 px-3 py-2 text-xs text-muted-foreground"
                          onSelect={() => router.push("/accesos")}
                        >
                          Ver todos los accesos →
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Bloque final: empresa + nombre + ajustes + avatar — todo en un pill */}
                  <div className="flex items-center gap-0.5 rounded-full border bg-muted/40 py-1 px-1.5">
                    {/* Logo empresa */}
                    <EmpresaSelector />

                    <div className="h-5 w-px bg-border mx-1" />

                    {/* Nombre + Rol del empleado */}
                    <div className="hidden md:flex flex-col justify-center px-1 max-w-[140px]">
                      <span
                        className="text-xs font-semibold text-foreground leading-tight truncate"
                        title={userName}
                      >
                        {userName}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground leading-tight truncate uppercase tracking-wide">
                        {rolLabel}
                      </span>
                    </div>

                    {/* Engranaje Ajustes */}
                    <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Ajustes"
                          onMouseEnter={() => setUserMenuOpen(true)}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-52"
                        onMouseLeave={() => setUserMenuOpen(false)}
                      >
                        <DropdownMenuItem
                          onSelect={() => router.push("/ajustes")}
                          className="cursor-pointer gap-2"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          Ajustes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={signOut}
                          className="text-destructive focus:text-destructive cursor-pointer gap-2"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Cerrar sesión
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
