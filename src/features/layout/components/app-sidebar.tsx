"use client";

import { ChevronDown, LayoutDashboard, PanelLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/features/layout/components/nav-link";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useViewMode } from "@/features/layout/contexts/view-mode-context";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  allSections,
  miPanelSubs,
  type SubItem,
} from "@/features/layout/data/nav-routes";

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

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const { mode } = useViewMode();
  const { puedeVer, permisosLoaded, hasRole } = useAuth();

  // 'director' tiene bypass total → mostramos todos los módulos sin esperar a permisos.
  // Para el resto, esperamos a permisosLoaded para evitar parpadeo "todo abierto" → "filtrado".
  const isDirector = hasRole("director");
  const sections = isDirector
    ? allSections
    : permisosLoaded
      ? allSections.filter((s) => puedeVer(s.modulo))
      : [];

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        {collapsed ? (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex items-center justify-center rounded hover:bg-sidebar-accent/40 transition-colors py-1 px-1"
              title="Expandir menú"
            >
              <PanelLeft className="h-5 w-5 text-sidebar-foreground/80" />
            </button>
          </div>
        ) : (
          <div className="relative flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={toggleSidebar}
              className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded hover:bg-sidebar-accent/40 transition-colors"
              title="Colapsar menú"
            >
              <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
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

      <SidebarContent>
        {!mounted ? null : mode === "paneles" ? (
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
