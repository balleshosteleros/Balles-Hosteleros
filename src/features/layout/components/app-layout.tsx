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
  Mail,
  Calendar as CalendarIcon,
  CheckCircle2,
  Settings,
  Video,
  CheckSquare2,
  Phone,
  Notebook,
  MessageCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Cctv,
  Building2,
  Rocket,
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
import { RecordingDrawer } from "@/features/recorder/components/RecordingDrawer";
import { RecordingOverlay } from "@/features/recorder/components/RecordingOverlay";
import { CountdownOverlay } from "@/features/recorder/components/CountdownOverlay";
import { WebcamPip } from "@/features/recorder/components/WebcamPip";
import { RecorderProvider } from "@/features/recorder/contexts/recorder-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import type { AccesoApp } from "@/features/rrhh/data/accesos-apps";
import { listAccesosApps } from "@/features/rrhh/actions/accesos-apps-actions";
import { ExternalLink } from "lucide-react";
import { useViewMode } from "@/features/layout/contexts/view-mode-context";


const NAV_BADGE_BG: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-600",
  emerald: "bg-emerald-600",
  violet: "bg-violet-600",
  green: "bg-green-500",
  sky: "bg-sky-600",
  yellow: "bg-yellow-500",
  slate: "bg-slate-700",
  amber: "bg-amber-500",
};

function NavBadge({ count, color = "blue" }: { count: number; color?: string }) {
  if (count === 0) return null;
  const bg = NAV_BADGE_BG[color] ?? NAV_BADGE_BG.blue;
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
  const signOut = auth?.signOut ?? (() => {});
  const permisosLoaded = auth?.permisosLoaded ?? false;
  const puedeVer = auth?.puedeVer ?? (() => false);
  const hasRole = auth?.hasRole ?? (() => false);

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
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function copyToClipboard(value: string, fieldKey: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField((k) => (k === fieldKey ? null : k)), 1200);
    }).catch((e) => console.error("[layout] copy:", e));
  }

  function maskPassword(pwd: string): string {
    const len = Math.min(pwd.length, 12);
    return "•".repeat(len || 8);
  }

  const { empresaActual, ajustes } = useEmpresa();
  const [accesosAppsRaw, setAccesosAppsRaw] = useState<AccesoApp[]>([]);
  useEffect(() => {
    let alive = true;
    listAccesosApps(empresaActual.id)
      .then((rows) => { if (alive) setAccesosAppsRaw(rows); })
      .catch((e) => console.error("[layout] accesos:", e));
    return () => { alive = false; };
  }, [empresaActual.id]);
  const accesosApps = accesosAppsRaw.filter((a) => a.estado === "Activo");
  const appsCategories = Array.from(new Set(accesosApps.map((a) => a.categoria)));
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
                    {/* Cuenta Google activa (icono) */}
                    <GoogleHeaderPill />

                    {/* Email */}
                    <GmailDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Correo"
                      >
                        <Mail className="!h-[18px] !w-[18px] text-red-500" />
                        <NavBadge count={ajustes.notificaciones.email.badgeActivo ? counts.emails : 0} color="red" />
                      </Button>
                    </GmailDrawer>

                    {/* Calendario */}
                    <CalendarDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Calendario"
                      >
                        <CalendarIcon className="!h-[18px] !w-[18px] text-blue-600" />
                        <NavBadge count={ajustes.notificaciones.calendario.badgeActivo ? counts.events : 0} color="blue" />
                      </Button>
                    </CalendarDrawer>

                    {/* Google Meet */}
                    <MeetDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Reuniones Meet"
                      >
                        <Video className="!h-[18px] !w-[18px] text-emerald-600" />
                        <NavBadge count={ajustes.notificaciones.reuniones.badgeActivo ? counts.meetings : 0} color="emerald" />
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
                        <CheckSquare2 className="!h-[18px] !w-[18px] text-violet-600" />
                        <NavBadge count={ajustes.notificaciones.tareas.badgeActivo ? counts.tasks : 0} color="violet" />
                      </Button>
                    </TareasDrawer>

                    {/* Chat / Comunicación */}
                    <ChatDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Comunicación interna"
                      >
                        <MessageCircle className="!h-[18px] !w-[18px] text-green-500 fill-green-500/15" />
                        <NavBadge count={ajustes.notificaciones.chat.badgeActivo ? counts.chatGroups : 0} color="green" />
                      </Button>
                    </ChatDrawer>

                    {/* Teléfono VoIP */}
                    <TelefonoDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Teléfono"
                      >
                        <Phone className="!h-[18px] !w-[18px] text-sky-600" />
                        <NavBadge count={ajustes.notificaciones.telefono.badgeActivo ? counts.missedCalls : 0} color="sky" />
                      </Button>
                    </TelefonoDrawer>

                    {/* Agenda de contactos */}
                    <AgendaDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Agenda de contactos"
                      >
                        <Notebook className="!h-[18px] !w-[18px] text-yellow-500" />
                        <NavBadge count={ajustes.notificaciones.agenda.badgeActivo ? counts.newContacts : 0} color="yellow" />
                      </Button>
                    </AgendaDrawer>

                    {/* Videovigilancia */}
                    <CamarasDrawer>
                      <Button
                        variant="ghost" size="icon"
                        className="relative h-8 w-8"
                        title="Videovigilancia"
                      >
                        <Cctv className="!h-[18px] !w-[18px] text-slate-700" />
                      </Button>
                    </CamarasDrawer>
                    {/* Separador visual */}
                    <span className="w-px h-5 bg-border mx-0.5" />

                    {/* Accesos a apps externas */}
                    <DropdownMenu open={appsMenuOpen} onOpenChange={setAppsMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="relative h-8 w-8"
                          title="Accesos a aplicaciones"
                          onMouseEnter={() => setAppsMenuOpen(true)}
                        >
                          <Rocket className="!h-[18px] !w-[18px] text-amber-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-96 max-h-[520px] overflow-y-auto"
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
                              .map((app) => {
                                const pwdVisible = !!visiblePasswords[app.id];
                                const tieneUsuario = !!app.usuario;
                                const tieneContrasena = !!app.contrasena;
                                return (
                                  <div
                                    key={app.id}
                                    className="px-2 py-1.5 mx-1 rounded-md hover:bg-accent/50"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        window.open(app.url, "_blank", "noopener,noreferrer")
                                      }
                                      className="flex items-center gap-2 w-full text-left"
                                      title={`Abrir ${app.nombre}`}
                                    >
                                      {app.logoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={app.logoUrl}
                                          alt=""
                                          className="h-4 w-4 rounded object-contain shrink-0"
                                          onError={(e) => {
                                            const img = e.currentTarget;
                                            img.style.display = "none";
                                            const fallback = img.nextElementSibling as HTMLElement | null;
                                            if (fallback) fallback.style.display = "inline";
                                          }}
                                        />
                                      ) : null}
                                      <span
                                        className="text-sm leading-none shrink-0"
                                        style={{ display: app.logoUrl ? "none" : "inline" }}
                                      >
                                        {app.icono}
                                      </span>
                                      <span className="flex-1 text-xs font-medium truncate">
                                        {app.nombre}
                                      </span>
                                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                                    </button>

                                    <div className="mt-1.5 ml-6 space-y-1">
                                      <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground w-16 shrink-0">
                                          Usuario
                                        </span>
                                        {tieneUsuario ? (
                                          <>
                                            <span className="font-mono flex-1 truncate text-foreground/80 select-all">
                                              {app.usuario}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(app.usuario, `${app.id}:user`);
                                              }}
                                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                              title="Copiar usuario"
                                              aria-label="Copiar usuario"
                                            >
                                              {copiedField === `${app.id}:user` ? (
                                                <Check className="h-3 w-3 text-emerald-600" />
                                              ) : (
                                                <Copy className="h-3 w-3" />
                                              )}
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAppsMenuOpen(false);
                                              router.push("/accesos");
                                            }}
                                            className="flex-1 text-left italic text-muted-foreground/70 hover:text-primary hover:underline truncate"
                                            title="Configurar credenciales en Accesos"
                                          >
                                            sin definir — añadir
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground w-16 shrink-0">
                                          Contraseña
                                        </span>
                                        {tieneContrasena ? (
                                          <>
                                            <span className="font-mono flex-1 truncate text-foreground/80 select-all">
                                              {pwdVisible ? app.contrasena : maskPassword(app.contrasena)}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setVisiblePasswords((prev) => ({
                                                  ...prev,
                                                  [app.id]: !prev[app.id],
                                                }));
                                              }}
                                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                              title={pwdVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                                              aria-label={pwdVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                                            >
                                              {pwdVisible ? (
                                                <EyeOff className="h-3 w-3" />
                                              ) : (
                                                <Eye className="h-3 w-3" />
                                              )}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(app.contrasena, `${app.id}:pwd`);
                                              }}
                                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                              title="Copiar contraseña"
                                              aria-label="Copiar contraseña"
                                            >
                                              {copiedField === `${app.id}:pwd` ? (
                                                <Check className="h-3 w-3 text-emerald-600" />
                                              ) : (
                                                <Copy className="h-3 w-3" />
                                              )}
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAppsMenuOpen(false);
                                              router.push("/accesos");
                                            }}
                                            className="flex-1 text-left italic text-muted-foreground/70 hover:text-primary hover:underline truncate"
                                            title="Configurar credenciales en Accesos"
                                          >
                                            sin definir — añadir
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
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
