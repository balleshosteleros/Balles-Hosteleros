"use client";

import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/layout/components/app-sidebar";
import { AuthContext } from "@/features/auth/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut,
  UserCircle,
  CheckCircle2,
  Settings,
  Building2,
  Eye,
  Copy,
  ExternalLink,
  Loader2,
  Search,
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
import {
  listAccesosApps,
  revelarAccesoApp,
} from "@/features/rrhh/actions/accesos-apps-actions";
import {
  VerificacionAccesosProvider,
  useVerificacionAccesos,
} from "@/features/rrhh/components/useVerificacionAccesos";
import type { AccesoApp } from "@/features/rrhh/data/accesos-apps";
import { toast } from "sonner";

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

/** Contraseña o dato extra de un acceso dentro del desplegable: revela bajo demanda 10s. */
function AccesoPasswordCell({
  appId,
  indice,
  tiene,
  nombreExtra,
}: {
  appId: string;
  indice: number;
  tiene: boolean;
  nombreExtra?: string;
}) {
  const { ensureVerificado } = useVerificacionAccesos();
  const [valor, setValor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (valor === null) return;
    const t = setTimeout(() => setValor(null), 10_000);
    return () => clearTimeout(t);
  }, [valor]);

  if (!tiene) return <span className="text-muted-foreground text-[11px]">—</span>;

  const revelar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const ok = await ensureVerificado();
      if (!ok) return;
      const res = await revelarAccesoApp(appId, indice, nombreExtra);
      if (res.ok) setValor(res.contrasena);
      else toast.error(res.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
      {valor !== null ? valor : "••••"}
      {valor !== null ? (
        <button
          onClick={() => {
            navigator.clipboard.writeText(valor);
            toast.success(nombreExtra ? `${nombreExtra} copiado` : "Contraseña copiada");
          }}
          className="text-muted-foreground hover:text-foreground"
          title="Copiar"
        >
          <Copy className="h-3 w-3" />
        </button>
      ) : (
        <button
          onClick={revelar}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Ver contraseña"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
        </button>
      )}
    </span>
  );
}

/** Logo de la app en el desplegable (favicon/simpleicons con fallback a inicial). */
function AccesoAppLogo({ nombre, logoUrl }: { nombre: string; logoUrl?: string | null }) {
  const [err, setErr] = useState(false);
  if (logoUrl && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt=""
        onError={() => setErr(true)}
        className="h-5 w-5 rounded object-contain shrink-0"
      />
    );
  }
  return (
    <div className="h-5 w-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
      {nombre[0]?.toUpperCase() || "?"}
    </div>
  );
}

/** Desplegable de accesos a apps de la empresa actual (lectura segura + búsqueda). */
function AccesosAppsMenu({ empresaSlug }: { empresaSlug: string }) {
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<AccesoApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!open || !empresaSlug) return;
    let alive = true;
    setLoading(true);
    setBusqueda("");
    listAccesosApps(empresaSlug)
      .then((rows) => {
        if (alive) setApps(rows.filter((a) => a.estado === "Activo"));
      })
      .catch((e) => console.error("[accesos] menu:", e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, empresaSlug]);

  // Filtra por nombre de app O por usuario/etiqueta de cualquiera de sus accesos.
  const q = busqueda.trim().toLowerCase();
  const appsFiltradas = !q
    ? apps
    : apps.filter((app) => {
        if (app.nombre.toLowerCase().includes(q)) return true;
        return app.accesos.some(
          (acc) =>
            (acc.usuario ?? "").toLowerCase().includes(q) ||
            (acc.etiqueta ?? "").toLowerCase().includes(q),
        );
      });

  return (
    // Provider FUERA del DropdownMenu: el diálogo de verificación no se ve
    // afectado por el cierre del desplegable.
    <VerificacionAccesosProvider>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost" size="icon"
            className="relative h-8 w-8"
            title="Accesos a aplicaciones"
          >
            <ToolIcon.aplicaciones className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.aplicaciones.colorKey)}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Accesos a aplicaciones
          </DropdownMenuLabel>
          {/* Buscador: por app o por usuario */}
          <div className="px-2 pb-2" onKeyDown={(e) => e.stopPropagation()}>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar app o usuario…"
                className="h-8 pl-7 text-xs"
                autoFocus
              />
            </div>
          </div>
          <DropdownMenuSeparator />
          {loading && (
            <div className="px-3 py-3 text-xs text-muted-foreground">Cargando…</div>
          )}
          {!loading && appsFiltradas.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              {q ? "Sin coincidencias." : "No hay accesos."}
            </div>
          )}
          {!loading &&
            appsFiltradas.map((app) => (
              <div key={app.id} className="px-3 py-2 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2">
                  <AccesoAppLogo nombre={app.nombre} logoUrl={app.logoUrl} />
                  <span className="text-xs font-semibold truncate flex-1">{app.nombre}</span>
                  {app.url && (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      title="Abrir"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <div className="mt-1 space-y-1.5 pl-7">
                  {app.accesos.map((acc, idx) => {
                    const datosExtra = (acc.datosExtra ?? []).filter((d) => d.tiene);
                    if (!acc.tieneContrasena && !acc.usuario && datosExtra.length === 0) {
                      return null;
                    }
                    return (
                      <div
                        key={idx}
                        className="space-y-0.5 border-l border-border/40 pl-2 first:border-l-0 first:pl-0"
                      >
                        {acc.etiqueta && (
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {acc.etiqueta}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono truncate text-muted-foreground">
                            <span className="not-italic">Usuario: </span>
                            {acc.usuario || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-muted-foreground">Contraseña:</span>
                          <AccesoPasswordCell
                            appId={app.id}
                            indice={idx}
                            tiene={acc.tieneContrasena ?? false}
                          />
                        </div>
                        {datosExtra.map((d) => (
                          <div
                            key={d.nombre}
                            className="flex items-center justify-between gap-2 text-[11px]"
                          >
                            <span className="text-muted-foreground truncate">{d.nombre}:</span>
                            <AccesoPasswordCell
                              appId={app.id}
                              indice={idx}
                              tiene={!!d.tiene}
                              nombreExtra={d.nombre}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </VerificacionAccesosProvider>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useContext(AuthContext);
  
  // Si no hay contexto (ej: SSR o fuera de AuthProvider), usamos valores por defecto
  const user = auth?.user;
  const profile = auth?.profile;
  const roles = auth?.roles ?? [];
  // La vista "Mis Departamentos" es exclusiva del rol dirección (director/admin).
  // El resto solo dispone de "Mis Paneles" como vista.
  const esDireccion = roles.includes("director") || roles.includes("admin");
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

  const { ajustes, empresaActual } = useEmpresa();
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

                    {/* Accesos a apps externas — solo si el rol tiene HERR_APLICACIONES.
                        Desplegable con usuario en claro y contraseña revelable bajo
                        demanda (cifrado + verificación de identidad en server). */}
                    {puedeVer("HERR_APLICACIONES") && (
                      <AccesosAppsMenu empresaSlug={empresaActual.id} />
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
                        {esDireccion && (
                          <>
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
                          </>
                        )}
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
