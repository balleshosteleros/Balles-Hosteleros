import {
  LayoutDashboard, Briefcase, Calculator, FileText, Scale, User, UsersRound, Truck, Camera, Wrench, ChevronDown, Settings, HelpCircle, MessageSquareWarning, CalendarDays, Utensils, ChefHat, UserCheck, ClipboardList, Gift, Banknote, Crown, Network, PercentDiamond, TrendingUp, FolderOpen, Clock, Calendar, Timer, UserRoundSearch, HandCoins, Megaphone, Package, FileArchive, KeyRound, Gavel, FileUp, ShoppingCart, Warehouse, FlaskConical, GraduationCap, UtensilsCrossed, BookOpen, Contact, Thermometer, Users, Sparkles, FileSearch, PenLine, CheckCircle2, BarChart3, Landmark, Tag, Zap, ContactRound,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import logoBalles from "@/assets/logo-balles.png";
import { EmpresaSelector } from "@/components/EmpresaSelector";

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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isGerencia = location.pathname.startsWith("/gerencia");
  const isDireccion = location.pathname.startsWith("/direccion");
  const isRRHH = location.pathname.startsWith("/rrhh");
  const isMarketing = location.pathname.startsWith("/marketing");
  const isContabilidad = location.pathname.startsWith("/contabilidad");
  const isLogistica = location.pathname.startsWith("/logistica");
  const isJuridico = location.pathname.startsWith("/juridico");
  const isGestoria = location.pathname.startsWith("/gestoria");
  const isSala = location.pathname.startsWith("/sala");
  const isCocina = location.pathname.startsWith("/cocina");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex flex-col items-center gap-1">
          <img
            src={logoBalles}
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
              {/* DIRECCIÓN with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isDireccion}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-sidebar-accent/50 cursor-pointer w-full">
                      <Crown className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-sm flex-1">DIRECCIÓN</span>
                          <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {direccionSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* SALA with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isSala}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-sidebar-accent/50 cursor-pointer w-full">
                      <UtensilsCrossed className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-sm flex-1">SALA</span>
                          <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {salaSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* COCINA with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isCocina}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-sidebar-accent/50 cursor-pointer w-full">
                      <ChefHat className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-sm flex-1">COCINA</span>
                          <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {cocinaSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <Collapsible defaultOpen={isGerencia}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-sidebar-accent/50 cursor-pointer w-full">
                      <Briefcase className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-sm flex-1">GERENCIA</span>
                          <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {gerenciaSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* RECURSOS HUMANOS with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isRRHH}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton asChild>
                      <NavLink to="/rrhh" end className="hover:bg-sidebar-accent/50 cursor-pointer w-full" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                        <User className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="text-sm flex-1">RECURSOS HUMANOS</span>
                            <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {rrhhSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* MARKETING with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isMarketing}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton asChild>
                      <NavLink to="/marketing" end className="hover:bg-sidebar-accent/50 cursor-pointer w-full" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                        <Camera className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="text-sm flex-1">MARKETING</span>
                            <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {marketingSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* LOGÍSTICA with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isLogistica}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-sidebar-accent/50 cursor-pointer w-full">
                      <Truck className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-sm flex-1">LOGÍSTICA</span>
                          <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {logisticaSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* CONTABILIDAD with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isContabilidad}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-sidebar-accent/50 cursor-pointer w-full">
                      <Calculator className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-sm flex-1">CONTABILIDAD</span>
                          <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {contabilidadSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* GESTORÍA with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isGestoria}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton asChild>
                      <NavLink to="/gestoria" end className="hover:bg-sidebar-accent/50 cursor-pointer w-full" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                        <FileText className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="text-sm flex-1">GESTORÍA</span>
                            <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {gestoriaSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* JURÍDICO with sub-items */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isJuridico}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton asChild>
                      <NavLink to="/juridico" end className="hover:bg-sidebar-accent/50 cursor-pointer w-full" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                        <Scale className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="text-sm flex-1">JURÍDICO</span>
                            <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {juridicoSubs.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={sub.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                              <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                              {!collapsed && <span className="text-sm">{sub.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/accesos" end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                <KeyRound className="mr-2 h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">ACCESOS</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/consultas-pendientes" end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                <MessageSquareWarning className="mr-2 h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">CONSULTAS PENDIENTES</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/ayuda" end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                <HelpCircle className="mr-2 h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">AYUDA</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/ajustes" end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                <Settings className="mr-2 h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">AJUSTES</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
