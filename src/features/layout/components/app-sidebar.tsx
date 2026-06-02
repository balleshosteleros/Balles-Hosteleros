"use client";

import { ChevronDown, LayoutDashboard, PanelLeft, Pin, PinOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/features/layout/components/nav-link";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useViewMode, type ViewMode } from "@/features/layout/contexts/view-mode-context";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  allSections,
  miPanelSubs,
  type Section,
  type SubItem,
} from "@/features/layout/data/nav-routes";

// El sidebar debe reflejar SIEMPRE el área en la que está el usuario:
// rutas bajo /mi-panel → menú Paneles; rutas bajo /mis-departamentos o cualquier
// prefijo de departamento (/sala, /cocina, /rrhh, …) → menú Departamentos.
// Solo en rutas ambiguas (/ajustes, /accesos, /) caemos al modo guardado.
function deriveModeFromPath(pathname: string, sectionsForPrefix: Section[]): ViewMode | null {
  if (pathname === "/mi-panel" || pathname.startsWith("/mi-panel/")) return "paneles";
  if (pathname === "/mis-departamentos" || pathname.startsWith("/mis-departamentos/")) return "departamentos";
  for (const s of sectionsForPrefix) {
    if (pathname === s.prefix || pathname.startsWith(`${s.prefix}/`)) return "departamentos";
  }
  return null;
}

function SubMenu({ items, collapsed }: { items: SubItem[]; collapsed: boolean }) {
  return (
    <SidebarMenuSub>
      {items.map((sub) => (
        <SidebarMenuSubItem key={sub.title}>
          <SidebarMenuButton asChild>
            <NavLink
              href={sub.url}
              end
              className="hover:bg-sidebar-accent/50"
              activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
            >
              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm">{sub.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}

function CollapsibleSection({
  icon: Icon,
  label,
  prefix,
  items,
  collapsed,
  linkTo,
  open,
  onOpenChange,
}: {
  icon: React.ElementType;
  label: string;
  prefix: string;
  items: SubItem[];
  collapsed: boolean;
  linkTo?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trigger = linkTo ? (
    <SidebarMenuButton asChild>
      <NavLink
        href={linkTo}
        end
        className="hover:bg-sidebar-accent/50 cursor-pointer w-full"
        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
      >
        <Icon className="mr-2 h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="text-sm flex-1">{label}</span>
            <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
          </>
        )}
      </NavLink>
    </SidebarMenuButton>
  ) : (
    <SidebarMenuButton className="hover:bg-sidebar-accent/50 cursor-pointer w-full">
      <Icon className="mr-2 h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="text-sm flex-1">{label}</span>
          <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
        </>
      )}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>{trigger}</CollapsibleTrigger>
        <CollapsibleContent>
          <SubMenu items={items} collapsed={collapsed} />
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

const SIDEBAR_PINNED_STORAGE_KEY = "sidebar:pinned";

export function AppSidebar() {
  const { state, setOpen, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const { mode, setMode } = useViewMode();
  const { puedeVer, permisosLoaded, hasRole } = useAuth();

  // 'director' tiene bypass total → mostramos todos los módulos sin esperar a permisos.
  // Para el resto, esperamos a permisosLoaded para evitar parpadeo "todo abierto" → "filtrado".
  const isDirector = hasRole("director");
  const sections = isDirector
    ? allSections
    : permisosLoaded
      ? allSections.filter((s) => puedeVer(s.modulo))
      : [];

  // La URL manda: si el usuario está dentro de un módulo de departamento o de
  // Mi Panel, el sidebar muestra ese menú. El modo guardado solo decide en
  // rutas ambiguas (ajustes, accesos, raíz).
  const derivedMode = deriveModeFromPath(pathname, allSections);
  const effectiveMode: ViewMode = derivedMode ?? mode;

  // Resincronizar el modo persistido cuando la ruta tiene un área clara, así
  // al volver a una ruta ambigua respetamos la última vista visitada.
  useEffect(() => {
    if (derivedMode && derivedMode !== mode) setMode(derivedMode);
  }, [derivedMode, mode, setMode]);

  const activeKey = sections.find((s) => pathname.startsWith(s.prefix))?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(activeKey);

  // Evitar hydration mismatch: useAuth y useViewMode leen localStorage en el render
  // inicial (caché de roles/permisos y modo de vista). En SSR esos lookups devuelven
  // valores por defecto y en cliente devuelven la caché real, así que las secciones
  // del menú difieren. Diferimos el render dinámico al post-mount; la caché ya está
  // poblada para entonces, así que no hay parpadeo perceptible.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // En las páginas hub (Mis Paneles / Mis Departamentos) el sidebar queda fijo
  // expandido — no se auto-colapsa ni se cierra al salir el cursor. Al pulsar
  // un módulo o submódulo se navega fuera de la hub y el auto-collapse arranca.
  const isHubRoute = pathname === "/mi-panel" || pathname === "/mis-departamentos";

  // Modo "fijado": el usuario pulsa el botón del header y el sidebar queda
  // siempre abierto, sin auto-collapse ni hover-leave-close. Persiste entre
  // sesiones. Por defecto está desactivado (modo automático).
  const [isPinned, setIsPinned] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SIDEBAR_PINNED_STORAGE_KEY) === "true") {
      setIsPinned(true);
      setOpen(true);
    }
  }, [setOpen]);

  const isLocked = isPinned || isHubRoute;

  // Auto-collapse: tras pulsar un módulo/submódulo se encoge a los 3s.
  // Hover-to-expand: al pasar el ratón sobre la barra colapsada se expande al
  // instante; al salir el cursor (sin haber pulsado nada) se cierra al instante.
  const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True solo cuando la expansión actual la abrió el hover (no un toggle manual
  // ni un click). Si es true, mouseleave cierra inmediatamente.
  const openedByHoverRef = useRef(false);
  // True desde que el usuario pulsa un link hasta que el sidebar realmente se
  // colapsa. Permite reanudar el timer si el cursor entra y vuelve a salir.
  const pendingPostClickRef = useRef(false);

  const clearAutoCollapseTimer = useCallback(() => {
    if (autoCollapseTimerRef.current) {
      clearTimeout(autoCollapseTimerRef.current);
      autoCollapseTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAutoCollapseTimer(), [clearAutoCollapseTimer]);

  const scheduleAutoCollapse = useCallback(() => {
    if (isMobile || isPinned) return;
    clearAutoCollapseTimer();
    autoCollapseTimerRef.current = setTimeout(() => {
      autoCollapseTimerRef.current = null;
      openedByHoverRef.current = false;
      pendingPostClickRef.current = false;
      setOpen(false);
    }, 3000);
  }, [isMobile, isPinned, clearAutoCollapseTimer, setOpen]);

  const handleSidebarMouseEnter = useCallback(() => {
    if (isMobile || isPinned) return;
    clearAutoCollapseTimer();
    if (collapsed) {
      // En hub el sidebar queda fijo abierto tras el hover, así que no
      // marcamos la expansión como "por hover" (para no cerrarla al salir).
      openedByHoverRef.current = !isLocked;
      setOpen(true);
    }
  }, [isMobile, isPinned, isLocked, collapsed, clearAutoCollapseTimer, setOpen]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (isMobile || isPinned) return;
    if (isLocked) {
      // En la hub el sidebar queda fijo abierto hasta que se pulse algo.
      clearAutoCollapseTimer();
      openedByHoverRef.current = false;
      pendingPostClickRef.current = false;
      return;
    }
    if (openedByHoverRef.current) {
      // Expandido solo por hover sin click → cerrar al instante.
      clearAutoCollapseTimer();
      openedByHoverRef.current = false;
      setOpen(false);
      return;
    }
    if (pendingPostClickRef.current && !autoCollapseTimerRef.current) {
      // Hubo click pero el timer se canceló al re-entrar; reanudar 3s.
      scheduleAutoCollapse();
    }
  }, [isMobile, isPinned, isLocked, clearAutoCollapseTimer, scheduleAutoCollapse, setOpen]);

  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile || isPinned) return;
      const target = e.target as HTMLElement;
      // Solo navegaciones reales (anchor con href) cuentan; expandir una sección
      // colapsable sin navegar no debe disparar el cierre automático.
      if (!target.closest("a[href]")) return;
      openedByHoverRef.current = false;
      pendingPostClickRef.current = true;
      scheduleAutoCollapse();
    },
    [isMobile, isPinned, scheduleAutoCollapse],
  );

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_PINNED_STORAGE_KEY, String(next));
      }
      if (next) {
        clearAutoCollapseTimer();
        openedByHoverRef.current = false;
        pendingPostClickRef.current = false;
        setOpen(true);
      }
      return next;
    });
  }, [clearAutoCollapseTimer, setOpen]);

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      <SidebarHeader className="px-3 py-3">
        {collapsed ? (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={togglePin}
              className={
                "flex items-center justify-center rounded transition-colors py-1 px-1 " +
                (isPinned
                  ? "bg-sidebar-accent/60 text-sidebar-primary hover:bg-sidebar-accent/80"
                  : "hover:bg-sidebar-accent/40 text-sidebar-foreground/80")
              }
              title={isPinned ? "Desfijar menú (volver a modo automático)" : "Fijar menú abierto"}
              aria-pressed={isPinned}
            >
              {isPinned ? <Pin className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </button>
          </div>
        ) : (
          <div className="relative flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={togglePin}
              className={
                "absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded transition-colors " +
                (isPinned
                  ? "bg-sidebar-accent/60 text-sidebar-primary hover:bg-sidebar-accent/80"
                  : "hover:bg-sidebar-accent/40")
              }
              title={isPinned ? "Desfijar menú (volver a modo automático)" : "Fijar menú abierto"}
              aria-pressed={isPinned}
            >
              {isPinned ? (
                <Pin className="h-4 w-4" />
              ) : (
                <PinOff className="h-4 w-4 text-sidebar-foreground/60" />
              )}
            </button>
            <img
              src="/logo-balles.png"
              alt="Balles Hosteleros"
              className="w-36 transition-all duration-200"
            />
            <span className="text-[10px] font-light uppercase tracking-[0.28em] text-sidebar-foreground/60">
              Software de Gestión
            </span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent onClick={handleContentClick}>
        {!mounted ? null : effectiveMode === "paneles" ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs tracking-widest">
              {!collapsed && "MIS PANELES"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      href="/mi-panel"
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">DASHBOARD</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {miPanelSubs.map((sub) => (
                  <SidebarMenuItem key={sub.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        href={sub.url}
                        end
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                      >
                        <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-sm">{sub.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs tracking-widest">
              {!collapsed && "MIS DEPARTAMENTOS"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      href="/mis-departamentos"
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">DASHBOARD</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {sections.map((s) => (
                  <CollapsibleSection
                    key={s.key}
                    icon={s.icon}
                    label={s.label}
                    prefix={s.prefix}
                    items={s.items}
                    collapsed={collapsed}
                    linkTo={s.linkTo}
                    open={openKey === s.key}
                    onOpenChange={(isOpen) => setOpenKey(isOpen ? s.key : null)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60" />
    </Sidebar>
  );
}
