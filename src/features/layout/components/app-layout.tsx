"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
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
  ArrowLeft,
} from "lucide-react";
import { getRouteMeta, allSections } from "@/features/layout/data/nav-routes";
import { useEffect, useState, useContext, useRef, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingSoporteButton } from "@/features/soporte/components";
import { AvatarRequiredGuard } from "@/features/auth/components/AvatarRequiredGuard";
import { EmpresaSelector } from "@/features/empresa/components/empresa-selector";
import {
  GmailDrawer,
  CalendarDrawer,
  MeetDrawer,
  DriveDrawer,
  TareasDrawer,
  ChatDrawer,
  TelefonoDrawer,
  GoogleHeaderPill,
  useDailyCounts,
} from "@/features/google-workspace/components";
import { AgendaDrawer } from "@/features/agenda/components/AgendaDrawer";
import { useChatNotifications } from "@/features/comunicacion/hooks/useChatNotifications";
import {
  AplicacionesDrawer,
  AccesosDrawer,
} from "@/features/layout/components/AccesosDrawers";
import { ToolsAvisoPopups } from "@/features/layout/components/ToolsAvisoPopups";
import { ToolTooltip } from "@/features/layout/components/ToolTooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CamarasDrawer } from "@/features/camaras/components/CamarasDrawer";
import { RecordingTrigger } from "@/features/recorder/components/RecordingTrigger";
import { NotificacionBell } from "@/features/notificaciones/components/NotificacionBell";
import { PushEscritorioAviso } from "@/features/notificaciones/components/PushEscritorioAviso";
import { RecordingDrawer } from "@/features/recorder/components/RecordingDrawer";
import { CountdownOverlay } from "@/features/recorder/components/CountdownOverlay";
import { WebcamPip } from "@/features/recorder/components/WebcamPip";
import { RecorderProvider } from "@/features/recorder/contexts/recorder-context";
import { MusicaProvider } from "@/features/sala/musica/contexts/musica-context";
import { MiniReproductor } from "@/features/sala/musica/components/MiniReproductor";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useViewMode } from "@/features/layout/contexts/view-mode-context";
import {
  ModoInmersivoProvider,
  useModoInmersivo,
} from "@/features/layout/contexts/modo-inmersivo-context";
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
  archivos: HERRAMIENTA.archivos.Icon,
  tareas: HERRAMIENTA.tareas.Icon,
  chat: HERRAMIENTA.chat.Icon,
  telefono: HERRAMIENTA.telefono.Icon,
  agenda: HERRAMIENTA.agenda.Icon,
  videovigilancia: HERRAMIENTA.videovigilancia.Icon,
  aplicaciones: HERRAMIENTA.aplicaciones.Icon,
  accesos: HERRAMIENTA.accesos.Icon,
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

/**
 * Providers del chrome del software. `AppLayoutInterno` va DENTRO de ellos
 * porque necesita leer el estado del menú lateral (`useSidebar`) y el modo
 * inmersivo para decidir si la barra superior se repliega.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ModoInmersivoProvider>
        <AppLayoutInterno>{children}</AppLayoutInterno>
      </ModoInmersivoProvider>
    </SidebarProvider>
  );
}

function AppLayoutInterno({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useContext(AuthContext);
  
  // Si no hay contexto (ej: SSR o fuera de AuthProvider), usamos valores por defecto
  const user = auth?.user;
  const profile = auth?.profile;
  const roles = auth?.roles ?? [];
  // Señal de sesión disponible en el PRIMER render: `user` se rellena tarde
  // (dentro del useEffect de onAuthStateChange, tras el primer paint), pero
  // `permisosLoaded` ya viene hidratado del caché/seed de servidor en el
  // mismo render que el sidebar. Usarla evita que la barra superior aparezca
  // "de golpe" unos cientos de ms después de que el software ya se ve.
  const permisosLoaded = auth?.permisosLoaded ?? false;
  // El conmutador "Mis Paneles / Mis Departamentos" se muestra a quien tiene
  // acceso a ≥1 departamento según sus PERMISOS reales (o es admin de
  // plataforma). Quien no tiene ningún departamento no ve el conmutador.
  const esDireccion = auth?.tieneAccesoDepartamentos ?? false;
  const puedeVer = auth?.puedeVer ?? (() => false);
  const signOut = auth?.signOut ?? (() => {});

  const devBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  // `mounted` es false en SSR Y en el primer render del cliente, así que ambos
  // pintan el MISMO HTML (sin barra) → sin mismatch de hidratación (React #418).
  // Tras montar leemos las señales que dependen de localStorage/caché.
  const [mounted, setMounted] = useState(false);
  const [isDemoHost, setIsDemoHost] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setIsDemoHost(window.location.hostname.startsWith("demo."));
    }
  }, []);
  // Mostramos la barra superior en cuanto sabemos que hay sesión — ya sea por
  // `user` (llega tras el primer paint) o por `permisosLoaded` (hidratado del
  // caché, como el sidebar). Pero SOLO tras montar: `permisosLoaded` difiere
  // entre SSR (false, sin localStorage) y cliente (true si hay caché), y pintar
  // esa diferencia en el primer render rompía la hidratación. Con `mounted` el
  // primer paint coincide con el servidor y la barra aparece justo después.
  // `profile` también cuenta como señal de sesión: lo siembra el layout de
  // servidor (ya con la sesión validada) antes del primer paint, así que la
  // cabecera con nombre + rol + foto puede pintarse sin esperar a que el
  // navegador resuelva `user` ni los permisos.
  const hayIndicioDeSesion = !!user || !!profile || permisosLoaded || devBypass || isDemoHost;

  // La barra superior (empresa, notificaciones, correo, calendario, avatar…) no
  // debe PARPADEAR al navegar entre módulos. Las señales de arriba se reescriben
  // en cada navegación —el layout de (main) es force-dynamic y vuelve a sembrar
  // el AuthProvider— y si alguna llega degradada por la carrera de cookies,
  // `user`/`profile`/`permisosLoaded` caen un instante y la barra entera
  // desaparecía y volvía.
  //
  // Una sesión ya confirmada no deja de existir por cambiar de página: hacemos
  // la señal MONÓTONA (solo avanza de oculta a visible). El cierre de sesión no
  // depende de esto — hace `window.location.href = "/"`, que recarga entera la
  // app y remonta este componente desde cero.
  const sesionVistaRef = useRef(false);
  if (hayIndicioDeSesion) sesionVistaRef.current = true;

  const showUi = mounted && sesionVistaRef.current;
  const counts = useDailyCounts();

  // BARRA SUPERIOR REPLEGADA (Reservas). La vista pide el modo inmersivo y la
  // barra se recoge a altura cero. Vuelve a bajar cuando el menú lateral está
  // expandido: acercar el cursor al borde izquierdo saca las dos a la vez y
  // apartarlo las recoge, porque el menú ya se expande/colapsa solo por hover.
  //
  // En MÓVIL nunca se repliega: allí no hay menú lateral con el que volver a
  // sacarla, así que esconderla dejaría la barra irrecuperable.
  const { state: sidebarState, isMobile: sidebarIsMobile } = useSidebar();
  const { inmersivo, inmersivoOscuro } = useModoInmersivo();
  // La cabecera NO se repliega: esta SIEMPRE fija, tambien en Reservas. Antes
  // se escondia sola al colapsar el menu lateral y habia que ir a buscarla con
  // el raton para que volviera a salir (Ivan, 06-sep).

  const { title: headerLabel, icon: ModuleIcon } = getRouteMeta(pathname);

  // VOLVER (solo móvil). En el teléfono las pantallas de módulo son las mismas
  // que en el ordenador, pero sin menú lateral: se sale con esta flecha, que
  // devuelve a la rejilla de submódulos del departamento —las viñetas que ya
  // existen en /m/departamentos/[key]— en vez de dejar la vista sin salida.
  //
  // El departamento se deduce del propio pathname con el `prefix` de
  // `allSections` (misma fuente que el sidebar), así no hay que mantener una
  // tabla aparte: un módulo nuevo funciona solo. Sin departamento que coincida
  // (p.ej. /agenda) se vuelve al inicio de la app.
  const volverHref = (() => {
    const sec = allSections.find(
      (s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`),
    );
    return sec ? `/m/departamentos/${sec.key}` : "/m";
  })();

  // El rol que se muestra bajo el nombre es el ROL REAL del usuario (rol_label:
  // DIRECCIÓN, SALA, COCINA, GESTORÍA…), NO el valor técnico de acceso
  // (director/empleado). «Empleado» no es un rol: si un usuario de SALA aparecía
  // como «EMPLEADO» era porque se pintaba roles[0] (técnico) en vez de rol_label.
  const rolLabel = profile?.rol_label?.trim() || "—";

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

  // Aviso global de mensajes de chat entrantes: toast abajo-derecha + pitido +
  // refresco del badge, en tiempo real (realtime), sin recargar el software.
  useChatNotifications(user?.id ?? null, empresaActual.id);

  function activarVista(modo: "paneles" | "departamentos") {
    setViewMode(modo);
    router.push(modo === "paneles" ? "/mi-panel" : "/mis-departamentos");
    setUserMenuOpen(false);
  }

  return (
    <RecorderProvider>
    <MusicaProvider>
      {/* `software-oscuro` marca el chrome entero (menu lateral incluido) cuando
          la vista inmersiva esta en tema oscuro. El menu se pinta FUERA del
          contenedor de la vista, asi que sin esta clase su borde derecho se
          quedaba con el gris claro del software y contra el azul marino de
          Reservas se veia como una linea blanca partiendo la pantalla. */}
      <div
        className={cn(
          "h-screen flex w-full overflow-hidden",
          inmersivoOscuro && "software-oscuro",
        )}
      >
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <header
            className={cn(
              // MISMO fondo que la pagina (no `--card`): la cabecera y la barra
              // de herramientas de debajo son la misma superficie. Cuando la
              // cabecera era blanco puro sobre el gris de la pagina, ademas
              // del borde, el corte se veia como una franja cruzando la
              // pantalla (Ivan, 06-sep).
              //
              // La linea SI vuelve, pero fina y sola: separa la cabecera de las
              // herramientas sin cambio de fondo detras. En NOCTURNO va BLANCA
              // translucida, porque el `--border` del tema oscuro es el mismo
              // azul marino del lienzo y ahi no se veia nada (Ivan, 06-sep).
              "sticky top-0 z-30 flex items-center bg-background px-3 md:px-4 shrink-0 gap-2 md:gap-3",
              "border-b [.software-oscuro_&]:border-b-white/25",
              "h-14",
            )}
          >
            {/*
              En MÓVIL no hay menú lateral: la navegación del teléfono son las
              viñetas de /m, y el desplegable de escritorio (con todos los
              departamentos y su cabecera) no pinta nada aquí. En su sitio va
              una flecha de volver al departamento (Iván, 07-ago).

              Es un <a> de verdad, no un router.push: si el JS no ha cargado o
              se ha roto, la vista se quedaría sin salida posible.
            */}
            <a
              href={volverHref}
              className="md:hidden -ml-1 shrink-0 flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
              aria-label="Volver"
              title="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </a>
            {(headerLabel || ModuleIcon !== null) && (
              <h1 className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground min-w-0 flex-1 md:flex-none">
                {ModuleIcon !== null && <ModuleIcon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{headerLabel}</span>
              </h1>
            )}
            {/*
              Un solo `ml-auto` en toda la cabecera: el del bloque de la
              derecha. El mini reproductor va DENTRO de ese bloque, si no los
              dos `ml-auto` se repartían el hueco sobrante y el reproductor
              acababa flotando junto al título, con un vacío enorme hasta la
              barra de herramientas.
            */}
            <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
              {showUi && (
                <>
                  {/*
                    Mini reproductor: pegado a la barra de herramientas, a la
                    izquierda de notificaciones. Solo se pinta cuando hay música
                    sonando; el resto del tiempo no existe y ese espacio vuelve
                    a la cabecera.
                  */}
                  <MiniReproductor />

                  {/* Integraciones: Google (cuenta + email + calendario + meet) | tareas + chat + llamadas | apps */}
                  {/* Un solo proveedor para todas las etiquetas de la barra: así el
                      retardo de aparición es común y, al pasar de un icono al de al
                      lado, la etiqueta salta al momento en vez de reaparecer. */}
                  <TooltipProvider delayDuration={300}>
                    <div className="hidden md:flex items-center rounded-full border bg-muted/40 py-1 px-1.5 gap-0.5">
                      {/* Notificaciones — joya de la corona, la primera de la barra */}
                      <NotificacionBell variant="toolbar" />

                      {/* Separador visual */}
                      <span className="w-px h-5 bg-border mx-0.5" />

                      {/* Cuenta Google activa (icono) */}
                      <GoogleHeaderPill />

                      {/* Email */}
                      <GmailDrawer>
                        <ToolTooltip label="Correo">
                          <Button
                            variant="ghost" size="icon"
                            className="relative h-8 w-8"
                          >
                            <ToolIcon.email className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.email.colorKey)}`} />
                            <NavBadge count={ajustes.notificaciones.email.badgeActivo ? counts.emails : 0} color={HERRAMIENTA.email.colorKey} />
                          </Button>
                        </ToolTooltip>
                      </GmailDrawer>

                      {/* Calendario */}
                      <CalendarDrawer>
                        <ToolTooltip label="Calendario">
                          <Button
                            variant="ghost" size="icon"
                            className="relative h-8 w-8"
                          >
                            <ToolIcon.calendario className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.calendario.colorKey)}`} />
                            <NavBadge count={ajustes.notificaciones.calendario.badgeActivo ? counts.events : 0} color={HERRAMIENTA.calendario.colorKey} />
                          </Button>
                        </ToolTooltip>
                      </CalendarDrawer>

                      {/* Archivos — espejo en vivo de Google Drive (PRP-084).
                          Es el ÚNICO Archivos: el explorador propio (PRP-079) se
                          retiró al quedarse sin uso. Icono de carpeta del
                          catálogo, no el logo de Drive. */}
                      <DriveDrawer>
                        <ToolTooltip label="Archivos">
                          <Button
                            variant="ghost" size="icon"
                            className="relative h-8 w-8"
                          >
                            <ToolIcon.archivos className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.archivos.colorKey)}`} />
                          </Button>
                        </ToolTooltip>
                      </DriveDrawer>

                      {/* Google Meet */}
                      <MeetDrawer>
                        <ToolTooltip label="Reuniones">
                          <Button
                            variant="ghost" size="icon"
                            className="relative h-8 w-8"
                          >
                            <ToolIcon.reuniones className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.reuniones.colorKey)}`} />
                            <NavBadge count={ajustes.notificaciones.reuniones.badgeActivo ? counts.meetings : 0} color={HERRAMIENTA.reuniones.colorKey} />
                          </Button>
                        </ToolTooltip>
                      </MeetDrawer>

                      {/* Grabación de pantalla */}
                      <RecordingTrigger />

                      {/* Separador visual */}
                      <span className="w-px h-5 bg-border mx-0.5" />

                      {/* Tareas */}
                      <TareasDrawer>
                        <ToolTooltip label="Tareas">
                          <Button
                            variant="ghost" size="icon"
                            className="relative h-8 w-8"
                          >
                            <ToolIcon.tareas className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.tareas.colorKey)}`} />
                            <NavBadge count={ajustes.notificaciones.tareas.badgeActivo ? counts.tasks : 0} color={HERRAMIENTA.tareas.colorKey} />
                          </Button>
                        </ToolTooltip>
                      </TareasDrawer>

                      {/* Chat / Comunicación */}
                      <ChatDrawer>
                        <ToolTooltip label="Chat">
                          <Button
                            variant="ghost" size="icon"
                            className="relative h-8 w-8"
                          >
                            <ToolIcon.chat className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.chat.colorKey)}`} />
                            <NavBadge count={ajustes.notificaciones.chat.badgeActivo ? counts.chatGroups : 0} color={HERRAMIENTA.chat.colorKey} />
                          </Button>
                        </ToolTooltip>
                      </ChatDrawer>

                      {/* Teléfono VoIP */}
                      <TelefonoDrawer>
                        <ToolTooltip label="Teléfono">
                          <Button
                            variant="ghost" size="icon"
                            className="relative h-8 w-8"
                          >
                            <ToolIcon.telefono className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.telefono.colorKey)}`} />
                            <NavBadge count={ajustes.notificaciones.telefono.badgeActivo ? counts.missedCalls : 0} color={HERRAMIENTA.telefono.colorKey} />
                          </Button>
                        </ToolTooltip>
                      </TelefonoDrawer>

                      {/* Agenda */}
                      <AgendaDrawer>
                        <ToolTooltip label="Agenda">
                          <Button
                            variant="ghost" size="icon"
                            className="relative h-8 w-8"
                          >
                            <ToolIcon.agenda className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.agenda.colorKey)}`} />
                            <NavBadge count={ajustes.notificaciones.agenda.badgeActivo ? counts.newContacts : 0} color={HERRAMIENTA.agenda.colorKey} />
                          </Button>
                        </ToolTooltip>
                      </AgendaDrawer>

                      {/* Videovigilancia — solo si el rol tiene CÁMARAS activado. */}
                      {puedeVer("CÁMARAS") && (
                        <CamarasDrawer>
                          <ToolTooltip label="Videovigilancia">
                            <Button
                              variant="ghost" size="icon"
                              className="relative h-8 w-8"
                            >
                              <ToolIcon.videovigilancia className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.videovigilancia.colorKey)}`} />
                            </Button>
                          </ToolTooltip>
                        </CamarasDrawer>
                      )}
                      {/* Separador visual */}
                      <span className="w-px h-5 bg-border mx-0.5" />

                      {/* Apps externas — dos permisos independientes:
                           · Aplicaciones (cohete): enlaces + usuario, sin secretos → HERR_APLICACIONES.
                           · Contraseñas (candado): bóveda segura con
                             revelado bajo verificación de identidad → HERR_ACCESOS. */}
                      {puedeVer("HERR_APLICACIONES") && (
                        <AplicacionesDrawer empresaSlug={empresaActual.id}>
                          <ToolTooltip label="Aplicaciones">
                            <Button
                              variant="ghost" size="icon"
                              className="relative h-8 w-8"
                            >
                              <ToolIcon.aplicaciones className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.aplicaciones.colorKey)}`} />
                            </Button>
                          </ToolTooltip>
                        </AplicacionesDrawer>
                      )}
                      {puedeVer("HERR_ACCESOS") && (
                        <AccesosDrawer empresaSlug={empresaActual.id}>
                          <ToolTooltip label="Contraseñas">
                            <Button
                              variant="ghost" size="icon"
                              className="relative h-8 w-8"
                            >
                              <ToolIcon.accesos className={`!h-[18px] !w-[18px] ${toolTextColor(HERRAMIENTA.accesos.colorKey)}`} />
                            </Button>
                          </ToolTooltip>
                        </AccesosDrawer>
                      )}
                    </div>
                  </TooltipProvider>

                  {/* Bloque final: empresa + nombre + ajustes + avatar — todo en un pill */}
                  <div className="flex items-center gap-0.5 rounded-full border bg-muted/40 py-1 px-1.5">
                    {/* Logo empresa. SIEMPRE visible, también en móvil.
                        Estaba `hidden md:block` porque se dio por hecho que a
                        las vistas de ordenador solo se llegaba de rebote desde
                        el teléfono; no es cierto —submódulos como Gerencia →
                        Mantenimiento se usan a diario desde el móvil— y allí
                        desaparecía la única forma de cambiar de empresa
                        (Iván, 28-ago: "nunca puede desaparecer"). */}
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

                    {/* Avatar trabajador → Mi Panel */}
                    <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-center rounded-full p-0.5 hover:bg-accent transition-colors focus:outline-none"
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
                        {/*
                          AJUSTES no se ofrece desde el teléfono: la
                          configuración de la empresa se toca desde el
                          ordenador. En el móvil, este menú se alcanzaba al
                          abrir un submódulo que aún no tiene pantalla propia
                          y cae en la vista de escritorio (Iván, 07-ago).
                          `hidden md:flex` (no un check de aparato) porque el
                          resto de la cabecera ya se recorta por ancho.
                        */}
                        {puedeVer("AJUSTES") && (
                          <DropdownMenuItem
                            onSelect={() => router.push("/ajustes")}
                            className="hidden md:flex cursor-pointer gap-2 px-3 py-1.5"
                          >
                            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">AJUSTES</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {/*
                          ENLACE real a /salir, no solo un `onSelect`. El JS puede
                          estar congelado o roto y entonces no habría forma de
                          salir; el navegador resuelve un href pase lo que pase.
                          `signOut()` sigue corriendo para limpiar lo local.
                        */}
                        <DropdownMenuItem asChild className="text-destructive focus:text-destructive cursor-pointer gap-2 px-3 py-1.5">
                          <a href="/salir" onClick={() => { void signOut(); }}>
                            <LogOut className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">CERRAR SESIÓN</span>
                          </a>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}
            </div>
          </header>
          {/* `pb-28` es el aire para que el botón "Guardar" no tape lo último
              del formulario. En una vista INMERSIVA (Reservas) no pinta nada:
              esa vista ya ocupa el alto completo y se hace su propio scroll,
              así que esos 7rem quedaban como una franja vacía por debajo del
              plano por la que se podía seguir bajando (Iván, 29-ago). Sin
              scroll propio tampoco: lo lleva la vista. */}
          <main
            className={cn(
              "flex-1 overflow-x-hidden min-h-0 overscroll-contain",
              inmersivo ? "overflow-y-hidden" : "overflow-y-auto pb-28",
            )}
          >
            <AvatarRequiredGuard>{children}</AvatarRequiredGuard>
          </main>
        </div>
        {showUi && <FloatingSoporteButton />}
      </div>
      {showUi && <ToolsAvisoPopups />}
      {showUi && <PushEscritorioAviso />}
      <RecordingDrawer />
      <CountdownOverlay />
      <WebcamPip />
    </MusicaProvider>
    </RecorderProvider>
  );
}
