"use client";

import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/layout/components/app-sidebar";
import { AuthContext } from "@/features/auth/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut,
  UserCircle,
  CheckCircle2,
  Settings,
  Building2,
} from "lucide-react";
import { getRouteMeta } from "@/features/layout/data/nav-routes";
import { useEffect, useState, useContext } from "react";
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
import { AvatarRequiredGuard } from "@/features/auth/components/AvatarRequiredGuard";
import { EmpresaSelector } from "@/features/empresa/components/empresa-selector";
import {
  GmailDrawer,
  CalendarDrawer,
  MeetDrawer,
  TareasDrawer,
  ChatDrawer,
  TelefonoDrawer,
  GoogleHeaderPill,
  useDailyCounts,
} from "@/features/google-workspace/components";
import { AgendaDrawer } from "@/features/agenda/components/AgendaDrawer";
import { ToolsAvisoPopups } from "@/features/layout/components/ToolsAvisoPopups";
import { CamarasDrawer } from "@/features/camaras/components/CamarasDrawer";
import { RecordingTrigger } from "@/features/recorder/components/RecordingTrigger";
import { NotificacionBell } from "@/features/notificaciones/components/NotificacionBell";
import { RecordingDrawer } from "@/features/recorder/components/RecordingDrawer";
import { RecordingOverlay } from "@/features/recorder/components/RecordingOverlay";
import { CountdownOverlay } from "@/features/recorder/components/CountdownOverlay";
import { WebcamPip } from "@/features/recorder/components/WebcamPip";
import { RecorderProvider } from "@/features/recorder/contexts/recorder-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useViewMode } from "@/features/layout/contexts/view-mode-context";
import {
  HERRAMIENTA,
  toolTextColor,
  toolBadgeBg,
  type ToolColorKey,
} from "@/features/layout/data/herramientas";

// Iconos de las herramientas — leídos del catálogo único.
const ToolIcon = {
  email: HERRAMIENTA.email.Icon,
  calendario: HERRAMIENTA.calendario.Icon,
  reuniones: HERRAMIENTA.reuniones.Icon,
  tareas: HERRAMIENTA.tareas.Icon,
  chat: HERRAMIENTA.chat.Icon,
  telefono: HERRAMIENTA.telefono.Icon,
  agenda: HERRAMIENTA.agenda.Icon,
  videovigilancia: HERRAMIENTA.videovigilancia.Icon,
  aplicaciones: HERRAMIENTA.aplicaciones.Icon,
};

function NavBadge({ count, color }: { count: number; color: ToolColorKey }) {
  if (count === 0) return null;
  const bg = toolBadgeBg(color);
  return (
    <span
      className={`absolute -top-0.5 -right-0.5 flex items-center justify-center h-3.5 min-w-3.5 px-0.5 rounded-full text-white text-[8px] font-bold leading-none ${bg}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useContext(AuthContext);
  
  // Si no hay contexto (ej: SSR o fuera de AuthProvider), usamos valores por defecto
  const user = auth?.user;
  const profile = auth?.profile;
  const roles = auth?.roles ?? [];
  const puedeVer = auth?.puedeVer ?? (() => false);
  const signOut = auth?.signOut ?? (() => {});

  const devBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  const [isDemoHost, setIsDemoHost] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDemoHost(window.location.hostname.startsWith("demo."));
    }
  }, []);
  const showUi = !!user || devBypass || isDemoHost;
  const counts = useDailyCounts();

  const { title: headerLabel, icon: ModuleIcon } = getRouteMeta(pathname);

  const rolLabel =
    roles.length > 0
      ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1)
      : "—";

  const router = useRouter();
  const userEmail = profile?.email ?? user?.email ?? "";
  const userInitial = profile
    ? (profile.nombre ? profile.nombre[0].toUpperCase() : (userEmail[0]?.toUpperCase() ?? "?"))
    : "";
  const userName = profile?.nombre
    ? profile.apellidos
      ? `${profile.nombre} ${profile.apellidos}`
      : profile.nombre
    : profile
      ? (userEmail.split("@")[0] || "—")
      : "";
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { ajustes } = useEmpresa();
  const { mode: viewMode, setMode: setViewMode } = useViewMode();

  function activarVista(modo: "paneles" | "departamentos") {
    setViewMode(modo);
    router.push(modo === "paneles" ? "/mi-panel" : "/mis-departamentos");
    setUserMenuOpen(false);
  }

  return (
    <RecorderProvider>
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <header className="sticky top-0 z-30 h-14 flex items-center border-b bg-card px-3 md:px-4 shrink-0 gap-2 md:gap-3">
            <SidebarTrigger className="md:hidden -ml-1 shrink-0" />
            {(headerLabel || ModuleIcon !== null) && (
              <h1 className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground min-w-0 flex-1 md:flex-none">
                {ModuleIcon !== null && <ModuleIcon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{headerLabel}</span>
              </h1>
            )}
            <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
              {showUi && (
                <>
                  {/* Integraciones: Google (cuenta + email + calendario + meet) | tareas + chat + llamadas | apps */}
                  <div className="hidden md:flex items-center rounded-full border bg-muted/40 py-1 px-1.5 gap-0.5">
                    {/* Notificaciones — joya de la corona, la primera de la barra */}
                    <NotificacionBell variant="toolbar" />

                    {/* Separador visual */}
                    <span className="w-px h-5 bg-border mx-0.5" />

                    {/* Cuenta Google activa (icono) */}
                    <GoogleHeaderPill />

                    {/* Email */}
                    <GmailDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Correo"
                      >
                        <ToolIcon.email className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.email.colorKey)}`} />
                        <NavBadge count={ajustes.notificaciones.email.badgeActivo ? counts.emails : 0} color={HERRAMIENTA.email.colorKey} />
                      </Button>
                    </GmailDrawer>

                    {/* Calendario */}
                    <CalendarDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Calendario"
                      >
                        <ToolIcon.calendario className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.calendario.colorKey)}`} />
                        <NavBadge count={ajustes.notificaciones.calendario.badgeActivo ? counts.events : 0} color={HERRAMIENTA.calendario.colorKey} />
                      </Button>
                    </CalendarDrawer>

                    {/* Google Meet */}
                    <MeetDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Reuniones Meet"
                      >
                        <ToolIcon.reuniones className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.reuniones.colorKey)}`} />
                        <NavBadge count={ajustes.notificaciones.reuniones.badgeActivo ? counts.meetings : 0} color={HERRAMIENTA.reuniones.colorKey} />
                      </Button>
                    </MeetDrawer>

                    {/* Grabación de pantalla */}
                    <RecordingTrigger />

                    {/* Separador visual */}
                    <span className="w-px h-5 bg-border mx-0.5" />

                    {/* Tareas */}
                    <TareasDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Mis tareas"
                      >
                        <ToolIcon.tareas className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.tareas.colorKey)}`} />
                        <NavBadge count={ajustes.notificaciones.tareas.badgeActivo ? counts.tasks : 0} color={HERRAMIENTA.tareas.colorKey} />
                      </Button>
                    </TareasDrawer>

                    {/* Chat / Comunicación */}
                    <ChatDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Comunicación interna"
                      >
                        <ToolIcon.chat className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.chat.colorKey)}`} />
                        <NavBadge count={ajustes.notificaciones.chat.badgeActivo ? counts.chatGroups : 0} color={HERRAMIENTA.chat.colorKey} />
                      </Button>
                    </ChatDrawer>

                    {/* Teléfono VoIP */}
                    <TelefonoDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Teléfono"
                      >
                        <ToolIcon.telefono className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.telefono.colorKey)}`} />
                        <NavBadge count={ajustes.notificaciones.telefono.badgeActivo ? counts.missedCalls : 0} color={HERRAMIENTA.telefono.colorKey} />
                      </Button>
                    </TelefonoDrawer>

                    {/* Agenda de contactos */}
                    <AgendaDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Agenda de contactos"
                      >
                        <ToolIcon.agenda className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.agenda.colorKey)}`} />
                        <NavBadge count={ajustes.notificaciones.agenda.badgeActivo ? counts.newContacts : 0} color={HERRAMIENTA.agenda.colorKey} />
                      </Button>
                    </AgendaDrawer>

                    {/* Videovigilancia */}
                    <CamarasDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Videovigilancia"
                      >
                        <ToolIcon.videovigilancia className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.videovigilancia.colorKey)}`} />
                      </Button>
                    </CamarasDrawer>
                    {/* Separador visual */}
                    <span className="w-px h-5 bg-border mx-0.5" />

                    {/* Accesos a apps externas — solo si el rol tiene HERR_APLICACIONES */}
                    {puedeVer("HERR_APLICACIONES") && (
                      // Las contraseñas ya NO se muestran en la barra (era texto plano,
                      // segundo camino inseguro). El icono lleva al módulo seguro
                      // /accesos, con cifrado + verificación de identidad por revelado.
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Accesos a aplicaciones"
                        onClick={() => router.push("/accesos")}
                      >
                        <ToolIcon.aplicaciones className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.aplicaciones.colorKey)}`} />
                      </Button>
                    )}
                  </div>

                  {/* Bloque final: empresa + nombre + ajustes + avatar — todo en un pill */}
                  <div className="flex items-center gap-0.5 rounded-full border bg-muted/40 py-1 px-1.5">
                    {/* Logo empresa */}
                    <EmpresaSelector />

                    <div className="hidden md:block h-5 w-px bg-border mx-1" />

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

                    {/* Avatar trabajador → Mi Panel */}
                    <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-center rounded-full p-0.5 hover:bg-accent transition-colors focus:outline-none"
                          title="Mi panel"
                          aria-label="Mi panel"
                          onMouseEnter={() => setUserMenuOpen(true)}
                        >
                          <Avatar className="h-8 w-8 ring-1 ring-border">
                            {profile?.avatar_url ? (
                              <AvatarImage src={profile.avatar_url} alt={userName} />
                            ) : null}
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                              {userInitial}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-60"
                        onMouseLeave={() => setUserMenuOpen(false)}
                      >
                        <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1.5">
                          Cambiar vista
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          className={`cursor-pointer gap-2 px-3 py-2 ${viewMode === "paneles" ? "bg-accent/60" : ""}`}
                          onSelect={() => activarVista("paneles")}
                        >
                          <UserCircle className={`h-4 w-4 ${viewMode === "paneles" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs tracking-widest uppercase ${viewMode === "paneles" ? "text-primary font-bold" : "font-semibold"}`}>
                            MIS PANELES
                          </span>
                          {viewMode === "paneles" && (
                            <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={`cursor-pointer gap-2 px-3 py-2 ${viewMode === "departamentos" ? "bg-accent/60" : ""}`}
                          onSelect={() => activarVista("departamentos")}
                        >
                          <Building2 className={`h-4 w-4 ${viewMode === "departamentos" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs tracking-widest uppercase ${viewMode === "departamentos" ? "text-primary font-bold" : "font-semibold"}`}>
                            MIS DEPARTAMENTOS
                          </span>
                          {viewMode === "departamentos" && (
                            <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {roles.includes("director") && (
                          <DropdownMenuItem
                            onSelect={() => router.push("/ajustes")}
                            className="cursor-pointer gap-2 px-3 py-1.5"
                          >
                            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">AJUSTES</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={signOut}
                          className="text-destructive focus:text-destructive cursor-pointer gap-2 px-3 py-1.5"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">CERRAR SESIÓN</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain">
            <AvatarRequiredGuard>
              <OnboardingGuard>{children}</OnboardingGuard>
            </AvatarRequiredGuard>
          </main>
        </div>
        {showUi && <FloatingSoporteButton />}
      </div>
      {showUi && <ToolsAvisoPopups />}
      <RecordingDrawer />
      <RecordingOverlay />
      <CountdownOverlay />
      <WebcamPip />
    </SidebarProvider>
    </RecorderProvider>
  );
}
