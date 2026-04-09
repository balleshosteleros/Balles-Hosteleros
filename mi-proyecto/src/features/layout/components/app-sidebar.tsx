"use client";

import {
  LayoutDashboard, Briefcase, Calculator, FileText, Scale, User, UsersRound, Truck, Camera,
  Wrench, ChevronDown, Settings, HelpCircle, MessageSquareWarning, CalendarDays, Utensils,
  ChefHat, UserCheck, ClipboardList, Gift, Banknote, Crown, Network, PercentDiamond,
  TrendingUp, FolderOpen, Clock, Calendar, Timer, UserRoundSearch, HandCoins, Megaphone,
  Package, FileArchive, KeyRound, Gavel, FileUp, ShoppingCart, Warehouse, FlaskConical,
  GraduationCap, UtensilsCrossed, BookOpen, Contact, Thermometer, Sparkles, FileSearch,
  PenLine, CheckCircle2, BarChart3, Landmark, Tag, Zap, ContactRound,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/features/layout/components/nav-link";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmpresaSelector } from "@/features/empresa/components/empresa-selector";

const contabilidadSubs = [
  { title: "CONTACTOS", url: "/contabilidad/contactos", icon: ContactRound },
  { title: "OPERACIONES", url: "/contabilidad/operaciones", icon: Sparkles },
  { title: "FACTURAS", url: "/contabilidad/facturas", icon: FileText },
  { title: "IMPUESTOS", url: "/contabilidad/impuestos", icon: FileSearch },
  { title: "TRANSACCIONES", url: "/contabilidad/transacciones", icon: PenLine },
  { title: "CONCILIACIÓN", url: "/contabilidad/conciliacion", icon: CheckCircle2 },
  { title: "CALENDARIO", url: "/contabilidad/calendario", icon: CalendarDays },
  { title: "ESCENARIOS", url: "/contabilidad/escenarios", icon: BarChart3 },
  { title: "BANCOS", url: "/contabilidad/bancos", icon: Landmark },
  { title: "ETIQUETAS", url: "/contabilidad/etiquetas", icon: Tag },
  { title: "REGLAS AUTOMÁTICAS", url: "/contabilidad/reglas", icon: Zap },
];
const gestoriaSubs = [
  { title: "PRESENTACIONES", url: "/gestoria/presentaciones", icon: FileUp },
];
const juridicoSubs = [
  { title: "PROCESOS", url: "/juridico/procesos", icon: Gavel },
];
const salaSubs = [
  { title: "RESERVAS", url: "/sala/reservas", icon: BookOpen },
  { title: "CLIENTES", url: "/sala/clientes", icon: Contact },
  { title: "TEMPERATURAS", url: "/sala/temperaturas", icon: Thermometer },
];
const cocinaSubs = [
  { title: "FICHAS TÉCNICAS", url: "/cocina/fichas-tecnicas", icon: Utensils },
  { title: "ELABORACIONES", url: "/cocina/elaboraciones", icon: FlaskConical },
  { title: "PARTIDAS", url: "/cocina/partidas", icon: ChefHat },
  { title: "TEMPERATURAS", url: "/cocina/temperaturas", icon: Thermometer },
];
const logisticaSubs = [
  { title: "PROVEEDORES", url: "/logistica/proveedores", icon: Truck },
  { title: "PRODUCTOS", url: "/logistica/productos", icon: Package },
  { title: "PEDIDOS", url: "/logistica/pedidos", icon: ShoppingCart },
  { title: "STOCK", url: "/logistica/stock", icon: Warehouse },
  { title: "INVENTARIOS", url: "/logistica/inventarios", icon: ClipboardList },
];
const marketingSubs = [
  { title: "CALENDARIO", url: "/marketing/calendario", icon: CalendarDays },
  { title: "CONTENIDO", url: "/marketing/contenido", icon: FolderOpen },
];
const direccionSubs = [
  { title: "ESTRUCTURA JERÁRQUICA", url: "/direccion/estructura", icon: Network },
  { title: "DOCUMENTACIÓN", url: "/direccion/documentacion", icon: FileArchive },
  { title: "APERTURAS", url: "/direccion/aperturas", icon: TrendingUp },
];
const gerenciaSubs = [
  { title: "MANTENIMIENTO", url: "/gerencia/mantenimiento", icon: Wrench },
  { title: "REVISIONES", url: "/gerencia/vencimientos", icon: CalendarDays },
  { title: "DESCUENTOS", url: "/gerencia/descuentos", icon: PercentDiamond },
  { title: "RATIOS", url: "/gerencia/ratios", icon: TrendingUp },
  { title: "COMUNICADOS", url: "/gerencia/comunicados", icon: Megaphone },
  { title: "ENCUESTAS", url: "/gerencia/encuestas", icon: ClipboardList },
];
const rrhhSubs = [
  { title: "EMPLEADOS", url: "/rrhh/empleados", icon: UsersRound },
  { title: "FICHAJES", url: "/rrhh/fichajes", icon: Clock },
  { title: "CALENDARIOS", url: "/rrhh/calendarios", icon: Calendar },
  { title: "HORARIOS", url: "/rrhh/horarios", icon: Timer },
  { title: "RECLUTAMIENTO", url: "/rrhh/reclutamiento", icon: UserRoundSearch },
  { title: "BOARDING", url: "/rrhh/boarding", icon: UserCheck },
  { title: "BONUS", url: "/rrhh/bonus", icon: Gift },
  { title: "SALARIOS", url: "/rrhh/salarios", icon: Banknote },
  { title: "PAGOS", url: "/rrhh/pagos", icon: HandCoins },
  { title: "FORMACIÓN", url: "/rrhh/formacion", icon: GraduationCap },
];

type SubItem = { title: string; url: string; icon: React.ElementType };

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
}: {
  icon: React.ElementType;
  label: string;
  prefix: string;
  items: SubItem[];
  collapsed: boolean;
  linkTo?: string;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(prefix);

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
      <Collapsible defaultOpen={isActive}>
        <CollapsibleTrigger asChild>{trigger}</CollapsibleTrigger>
        <CollapsibleContent>
          <SubMenu items={items} collapsed={collapsed} />
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex flex-col items-center gap-1">
          <img
            src="/logo-balles.png"
            alt="Balles Hosteleros"
            className={`${collapsed ? "w-8" : "w-36"} transition-all duration-200`}
          />
          {!collapsed && (
            <span className="text-[10px] tracking-[0.2em] text-sidebar-foreground/40 font-medium uppercase">
              Software de gestión
            </span>
          )}
        </div>
        {!collapsed && (
          <div className="mt-3">
            <EmpresaSelector />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs tracking-widest">
            {!collapsed && "MÓDULOS"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleSection icon={Crown} label="DIRECCIÓN" prefix="/direccion" items={direccionSubs} collapsed={collapsed} />
              <CollapsibleSection icon={UtensilsCrossed} label="SALA" prefix="/sala" items={salaSubs} collapsed={collapsed} />
              <CollapsibleSection icon={ChefHat} label="COCINA" prefix="/cocina" items={cocinaSubs} collapsed={collapsed} />
              <CollapsibleSection icon={Briefcase} label="GERENCIA" prefix="/gerencia" items={gerenciaSubs} collapsed={collapsed} />
              <CollapsibleSection icon={User} label="RECURSOS HUMANOS" prefix="/rrhh" items={rrhhSubs} collapsed={collapsed} linkTo="/rrhh" />
              <CollapsibleSection icon={Camera} label="MARKETING" prefix="/marketing" items={marketingSubs} collapsed={collapsed} linkTo="/marketing" />
              <CollapsibleSection icon={Truck} label="LOGÍSTICA" prefix="/logistica" items={logisticaSubs} collapsed={collapsed} />
              <CollapsibleSection icon={Calculator} label="CONTABILIDAD" prefix="/contabilidad" items={contabilidadSubs} collapsed={collapsed} />
              <CollapsibleSection icon={FileText} label="GESTORÍA" prefix="/gestoria" items={gestoriaSubs} collapsed={collapsed} linkTo="/gestoria" />
              <CollapsibleSection icon={Scale} label="JURÍDICO" prefix="/juridico" items={juridicoSubs} collapsed={collapsed} linkTo="/juridico" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          {[
            { href: "/accesos", icon: KeyRound, label: "ACCESOS" },
            { href: "/consultas-pendientes", icon: MessageSquareWarning, label: "CONSULTAS PENDIENTES" },
            { href: "/ayuda", icon: HelpCircle, label: "AYUDA" },
            { href: "/ajustes", icon: Settings, label: "AJUSTES" },
          ].map(({ href, icon: Icon, label }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton asChild>
                <NavLink
                  href={href}
                  end
                  className="hover:bg-sidebar-accent/50"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                  {!collapsed && <span className="text-sm">{label}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
