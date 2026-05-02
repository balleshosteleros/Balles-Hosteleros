"use client";

import {
  Briefcase, Calculator, FileText, Scale, User, UsersRound, Truck, Camera,
  Wrench, ChevronDown, Settings, CalendarDays, Utensils,
  ChefHat, UserCheck, ClipboardList, ClipboardCheck, Gift, Crown, Network, PercentDiamond,
  TrendingUp, FolderOpen, Clock, Calendar, Timer, UserRoundSearch, HandCoins, Megaphone,
  Package, FileArchive, Files, KeyRound, Gavel, FileUp, ShoppingCart, Warehouse, FlaskConical,
  GraduationCap, UtensilsCrossed, BookOpen, Contact, Thermometer, Sparkles, FileSearch,
  PenLine, CheckCircle2, BarChart3, Landmark, Tag, Zap, ContactRound,
  Heart, UserPlus, Apple, CreditCard, Presentation, QrCode, Globe,
  Send, Wallet, LayoutDashboard, Fingerprint, Inbox, FileSignature, Trophy,
} from "lucide-react";

// Icono compuesto: cuadrícula de apps + candado de seguridad
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
      {/* 3 cuadrados de apps */}
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      {/* Candado en posición 4 */}
      <rect x="14.5" y="17.5" width="5" height="3.5" rx="0.8" />
      <path d="M15.5 17.5v-1.2a1.5 1.5 0 0 1 3 0v1.2" />
    </svg>
  );
}
import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/features/layout/components/nav-link";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem,
  SidebarHeader, SidebarFooter, SidebarRail, useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeft } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  { title: "MODELOS", url: "/gestoria/modelos", icon: FileSearch },
  { title: "PRESENTACIONES", url: "/gestoria/presentaciones", icon: FileUp },
];
const juridicoSubs = [
  { title: "PROCESOS", url: "/juridico/procesos", icon: Gavel },
];
const salaSubs = [
  { title: "PUNTO DE VENTA", url: "/sala/pos", icon: CreditCard },
  { title: "RESERVAS", url: "/sala/reservas", icon: BookOpen },
  { title: "CLIENTES", url: "/sala/clientes", icon: Contact },
];
const cocinaSubs = [
  { title: "COMANDAS", url: "/cocina/comandas", icon: Timer },
  { title: "NUEVAS RECETAS", url: "/cocina/nuevas-recetas", icon: Sparkles },
  { title: "FICHAS TÉCNICAS", url: "/cocina/fichas-tecnicas", icon: Utensils },
  { title: "ELABORACIONES", url: "/cocina/elaboraciones", icon: FlaskConical },
  { title: "PARTIDAS", url: "/cocina/partidas", icon: ChefHat },
  { title: "TEMPERATURAS", url: "/cocina/temperaturas", icon: Thermometer },
];
const logisticaSubs = [
  { title: "PROVEEDORES", url: "/logistica/proveedores", icon: Truck },
  { title: "PRODUCTOS", url: "/logistica/productos", icon: Apple },
  { title: "PEDIDOS", url: "/logistica/pedidos", icon: ShoppingCart },
  { title: "STOCK", url: "/logistica/stock", icon: Warehouse },
  { title: "INVENTARIOS", url: "/logistica/inventarios", icon: ClipboardList },
];
const marketingSubs = [
  { title: "CALENDARIO", url: "/marketing/calendario", icon: CalendarDays },
  { title: "CONTENIDO", url: "/marketing/contenido", icon: FolderOpen },
  { title: "CAMPAÑAS", url: "/marketing/campanas", icon: Send },
  { title: "CARTA DIGITAL", url: "/marketing/carta-digital", icon: QrCode },
  { title: "PÁGINA WEB", url: "/marketing/pagina-web", icon: Globe },
  { title: "FIDELIZACIÓN", url: "/marketing/fidelizacion", icon: Heart },
  { title: "CAPTACIÓN", url: "/marketing/captacion", icon: UserPlus },
];
const direccionSubs = [
  { title: "ORGANIGRAMA", url: "/direccion/estructura", icon: Network },
  { title: "CRONOGRAMAS", url: "/direccion/cronogramas", icon: CalendarDays },
  { title: "DOCUMENTACIÓN", url: "/direccion/documentacion", icon: FileArchive },
  { title: "APERTURAS", url: "/direccion/aperturas", icon: TrendingUp },
  { title: "PRESENTACIONES", url: "/direccion/presentaciones", icon: Presentation },
];
const gerenciaSubs = [
  { title: "MANTENIMIENTO", url: "/gerencia/mantenimiento", icon: Wrench },
  { title: "REVISIONES", url: "/gerencia/vencimientos", icon: CalendarDays },
  { title: "CIERRES", url: "/gerencia/cierres", icon: Wallet },
  { title: "DESCUENTOS", url: "/gerencia/descuentos", icon: PercentDiamond },
  { title: "RATIOS", url: "/gerencia/ratios", icon: TrendingUp },
  { title: "COMUNICADOS", url: "/gerencia/comunicados", icon: Megaphone },
  { title: "ENCUESTAS", url: "/gerencia/encuestas", icon: ClipboardList },
];
const calidadSubs = [
  { title: "AUDITORÍAS", url: "/calidad/auditorias", icon: ClipboardList },
  { title: "EMPLEADOS", url: "/calidad/empleados", icon: UsersRound },
  { title: "CLIENTES", url: "/calidad/clientes", icon: ContactRound },
  { title: "INSPECCIONES", url: "/calidad/inspecciones", icon: FileSearch },
];
const miPanelSubs = [
  { title: "EQUIPO", url: "/mi-panel/equipo", icon: Network },
  { title: "CALENDARIO", url: "/mi-panel/calendario", icon: CalendarDays },
  { title: "HORARIO", url: "/mi-panel/horario", icon: Timer },
  { title: "FICHAJES", url: "/mi-panel/fichajes", icon: Fingerprint },
  { title: "CONDICIONES", url: "/mi-panel/condiciones", icon: ClipboardCheck },
  { title: "CUESTIONARIOS", url: "/mi-panel/cuestionarios", icon: ClipboardList },
  { title: "SOLICITUDES", url: "/mi-panel/ausencias", icon: Inbox },
  { title: "COMUNICADOS", url: "/mi-panel/comunicados", icon: Megaphone },
  { title: "DOCUMENTOS", url: "/mi-panel/documentos", icon: Files },
  { title: "FORMACIÓN", url: "/mi-panel/formacion", icon: GraduationCap },
  { title: "TOQUES", url: "/mi-panel/toques", icon: Trophy },
];
const rrhhSubs = [
  { title: "EMPLEADOS", url: "/rrhh/empleados", icon: UsersRound },
  { title: "FICHAJES", url: "/rrhh/fichajes", icon: Fingerprint },
  { title: "SOLICITUDES", url: "/rrhh/solicitudes", icon: Inbox },
  { title: "FIRMAS", url: "/rrhh/firmas", icon: FileSignature },
  { title: "CALENDARIOS", url: "/rrhh/calendarios", icon: Calendar },
  { title: "HORARIOS", url: "/rrhh/horarios", icon: Timer },
  { title: "RECLUTAMIENTO", url: "/rrhh/reclutamiento", icon: UserRoundSearch },
  { title: "BOARDING", url: "/rrhh/boarding", icon: UserCheck },
  { title: "BONUS", url: "/rrhh/bonus", icon: Gift },
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

  const sections = [
    { key: "direccion", icon: Crown, label: "DIRECCIÓN", prefix: "/direccion", items: direccionSubs, linkTo: "/direccion" },
    { key: "sala", icon: UtensilsCrossed, label: "SALA", prefix: "/sala", items: salaSubs, linkTo: "/sala" },
    { key: "cocina", icon: ChefHat, label: "COCINA", prefix: "/cocina", items: cocinaSubs, linkTo: "/cocina" },
    { key: "gerencia", icon: Briefcase, label: "GERENCIA", prefix: "/gerencia", items: gerenciaSubs, linkTo: "/gerencia" },
    { key: "calidad", icon: CheckCircle2, label: "CALIDAD", prefix: "/calidad", items: calidadSubs, linkTo: "/calidad" },
    { key: "rrhh", icon: User, label: "RECURSOS HUMANOS", prefix: "/rrhh", items: rrhhSubs, linkTo: "/rrhh" },
    { key: "marketing", icon: Camera, label: "MARKETING", prefix: "/marketing", items: marketingSubs, linkTo: "/marketing" },
    { key: "logistica", icon: Package, label: "LOGÍSTICA", prefix: "/logistica", items: logisticaSubs, linkTo: "/logistica" },
    { key: "contabilidad", icon: Calculator, label: "CONTABILIDAD", prefix: "/contabilidad", items: contabilidadSubs, linkTo: "/contabilidad" },
    { key: "gestoria", icon: FileText, label: "GESTORÍA", prefix: "/gestoria", items: gestoriaSubs, linkTo: "/gestoria" },
    { key: "juridico", icon: Scale, label: "JURÍDICO", prefix: "/juridico", items: juridicoSubs, linkTo: "/juridico" },
  ] as const;

  const activeKey = sections.find((s) => pathname.startsWith(s.prefix))?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(activeKey);
  const [miPanelOpen, setMiPanelOpen] = useState<boolean>(pathname.startsWith("/mi-panel"));

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
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs tracking-widest">
            {!collapsed && "PERSONAL"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleSection
                icon={LayoutDashboard}
                label="MI PANEL"
                prefix="/mi-panel"
                items={miPanelSubs}
                collapsed={collapsed}
                linkTo="/mi-panel"
                open={miPanelOpen}
                onOpenChange={setMiPanelOpen}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs tracking-widest">
            {!collapsed && "DEPARTAMENTOS"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((s) => (
                <CollapsibleSection
                  key={s.key}
                  icon={s.icon}
                  label={s.label}
                  prefix={s.prefix}
                  items={s.items}
                  collapsed={collapsed}
                  linkTo={"linkTo" in s ? s.linkTo : undefined}
                  open={openKey === s.key}
                  onOpenChange={(isOpen) => setOpenKey(isOpen ? s.key : null)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60" />
      {/* Franja vertical clickeable en el borde — permite expandir/colapsar pulsando el lateral */}
      <SidebarRail />
    </Sidebar>
  );
}
