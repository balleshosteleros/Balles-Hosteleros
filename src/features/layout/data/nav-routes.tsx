"use client";

import {
  Briefcase, Calculator, FileText, Scale, User, UsersRound, Truck, Camera,
  Wrench, Settings, CalendarDays, ChefHat, ClipboardList, ClipboardCheck,
  Gift, Crown, Network, PercentDiamond, TrendingUp, FolderOpen, Calendar,
  Timer, UserRoundSearch, HandCoins, Megaphone, Package, FileArchive, Files,
  KeyRound, Gavel, FileUp, ShoppingCart, Warehouse, FlaskConical, GraduationCap,
  UtensilsCrossed, BookOpen, Contact, Thermometer, Sparkles, FileSearch, PenLine,
  CheckCircle2, BarChart3, Landmark, Tag, Zap, ContactRound, Heart, UserPlus,
  Apple, CreditCard, Presentation, QrCode, Globe, Send, Wallet, Fingerprint,
  Inbox, FileSignature, Trophy, UserCircle, LayoutDashboard, FileQuestion,
  LayoutGrid, CalendarClock, AlertTriangle, HelpCircle, MessageSquareWarning,
  Video, Mail, MessageSquare, Banknote, Building2, Smartphone, Trash2,
  Bell,
} from "lucide-react";

// ─── Icons custom ──────────────────────────────────────────────────────────

export function AccesosIcon({ className }: { className?: string }) {
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

// Plato visto en planta — círculo exterior + ala (rim) interior + 2 cortes
// verticales que dividen el well en 3 franjas iguales. Perfectamente circular.
export function EscandalloIcon({ className }: { className?: string }) {
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
      {/* borde exterior del plato */}
      <circle cx="12" cy="12" r="10" />
      {/* ala interior */}
      <circle cx="12" cy="12" r="7.5" />
      {/* 2 cortes verticales tocando el ala — 3 franjas iguales */}
      <path d="M9.5 5 V19" />
      <path d="M14.5 5 V19" />
    </svg>
  );
}

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type IconType = React.ElementType;
export type SubItem = { title: string; url: string; icon: IconType; badge?: string };
export type Section = {
  key: string;
  modulo: string;       // permiso para puedeVer()
  icon: IconType;
  label: string;
  prefix: string;
  items: SubItem[];
  linkTo: string;
  fase?: 1 | 2;         // etiqueta de despliegue por fases (1ª verde / 2ª amarilla)
};

// ─── Submenús (fuente única — los consume el sidebar y el header) ─────────

export const miPanelSubs: SubItem[] = [
  { title: "PERFIL", url: "/mi-panel/datos-personales", icon: UserCircle },
  { title: "POINTS", url: "/mi-panel/points", icon: Trophy, badge: "2ª fase" },
  { title: "CALENDARIO", url: "/mi-panel/calendario", icon: CalendarDays },
  { title: "CRONOGRAMA", url: "/mi-panel/cronograma", icon: CalendarClock },
  { title: "HORARIO", url: "/mi-panel/horario", icon: Timer },
  { title: "FICHAJES", url: "/mi-panel/fichajes", icon: Fingerprint },
  { title: "FORMACIÓN", url: "/mi-panel/formacion", icon: GraduationCap, badge: "2ª fase" },
  { title: "CONDICIONES", url: "/mi-panel/condiciones", icon: ClipboardCheck },
  { title: "ENCUESTAS", url: "/mi-panel/encuestas", icon: ClipboardList },
  { title: "CUESTIONARIOS", url: "/mi-panel/cuestionarios", icon: FileQuestion },
  { title: "SOLICITUDES", url: "/mi-panel/ausencias", icon: Inbox },
  { title: "COMUNICADOS", url: "/mi-panel/comunicados", icon: Megaphone },
  { title: "DOCUMENTOS", url: "/mi-panel/documentos", icon: Files },
  { title: "INSPECCIONES", url: "/mi-panel/inspecciones", icon: FileSearch },
  { title: "EQUIPO", url: "/mi-panel/equipo", icon: Network },
];

export const direccionSubs: SubItem[] = [
  { title: "ORGANIGRAMA", url: "/direccion/estructura", icon: Network },
  { title: "CRONOGRAMAS", url: "/direccion/cronogramas", icon: CalendarDays },
  { title: "AUDITORÍAS", url: "/direccion/auditorias", icon: ClipboardCheck },
  { title: "DOCUMENTACIÓN", url: "/direccion/documentacion", icon: FileArchive },
  { title: "APERTURAS", url: "/direccion/aperturas", icon: TrendingUp },
  { title: "PRESENTACIONES", url: "/direccion/presentaciones", icon: Presentation },
  { title: "NOTIFICACIONES", url: "/direccion/notificaciones", icon: Bell },
];

export const salaSubs: SubItem[] = [
  { title: "PUNTO DE VENTA", url: "/sala/pos", icon: CreditCard },
  { title: "TARIFAS", url: "/sala/tarifas", icon: Tag },
  { title: "DESCUENTOS", url: "/sala/descuentos", icon: PercentDiamond },
  { title: "VENTAS", url: "/sala/ventas", icon: TrendingUp },
  { title: "RESERVAS", url: "/sala/reservas", icon: BookOpen },
  { title: "CUPONES", url: "/sala/cupones", icon: Gift },
  { title: "CLIENTES", url: "/sala/clientes", icon: Contact },
];

export const cocinaSubs: SubItem[] = [
  { title: "COMANDAS", url: "/cocina/comandas", icon: Timer },
  { title: "NUEVAS RECETAS", url: "/cocina/nuevas-recetas", icon: Sparkles },
  { title: "ESCANDALLOS", url: "/cocina/escandallos", icon: EscandalloIcon },
  { title: "ELABORACIONES", url: "/cocina/elaboraciones", icon: FlaskConical },
  { title: "PARTIDAS", url: "/cocina/partidas", icon: LayoutGrid },
  { title: "MERMAS", url: "/cocina/mermas", icon: Trash2 },
  { title: "TEMPERATURAS", url: "/cocina/temperaturas", icon: Thermometer },
];

export const logisticaSubs: SubItem[] = [
  { title: "PROVEEDORES", url: "/logistica/proveedores", icon: Truck },
  { title: "PRODUCTOS", url: "/logistica/productos", icon: Apple },
  { title: "PEDIDOS", url: "/logistica/pedidos", icon: ShoppingCart },
  { title: "STOCK", url: "/logistica/stock", icon: Warehouse },
  { title: "INVENTARIOS", url: "/logistica/inventarios", icon: ClipboardList },
];

export const gerenciaSubs: SubItem[] = [
  { title: "MANTENIMIENTO", url: "/gerencia/mantenimiento", icon: Wrench },
  { title: "REVISIONES", url: "/gerencia/vencimientos", icon: CalendarDays },
  { title: "CIERRES", url: "/gerencia/cierres", icon: Wallet },
  { title: "INFORMES", url: "/gerencia/informes", icon: BarChart3 },
  { title: "RATIOS", url: "/gerencia/ratios", icon: TrendingUp },
  { title: "COMUNICADOS", url: "/gerencia/comunicados", icon: Megaphone },
];

export const calidadSubs: SubItem[] = [
  { title: "AUDITORÍAS", url: "/calidad/auditorias", icon: ClipboardList },
  { title: "CUESTIONARIOS", url: "/calidad/cuestionarios", icon: FileQuestion },
  { title: "RESEÑAS", url: "/calidad/resenas", icon: ContactRound },
  { title: "INSPECCIONES", url: "/calidad/inspecciones", icon: FileSearch },
];

export const rrhhSubs: SubItem[] = [
  { title: "EMPLEADOS", url: "/rrhh/empleados", icon: UsersRound },
  { title: "FICHAJES", url: "/rrhh/fichajes", icon: Fingerprint },
  { title: "SOLICITUDES", url: "/rrhh/solicitudes", icon: Inbox },
  { title: "FIRMAS", url: "/rrhh/firmas", icon: FileSignature },
  { title: "CALENDARIOS", url: "/rrhh/calendarios", icon: Calendar },
  { title: "HORARIOS", url: "/rrhh/horarios", icon: Timer },
  { title: "RECLUTAMIENTO", url: "/rrhh/reclutamiento", icon: UserRoundSearch },
  { title: "BONUS", url: "/rrhh/bonus", icon: Gift },
  { title: "POINTS", url: "/rrhh/points", icon: Trophy, badge: "2ª fase" },
  { title: "PAGOS", url: "/rrhh/pagos", icon: HandCoins },
  { title: "PUESTOS", url: "/rrhh/puestos", icon: Banknote },
  { title: "FORMACIÓN", url: "/rrhh/formacion", icon: GraduationCap, badge: "2ª fase" },
  { title: "ENCUESTAS", url: "/rrhh/encuestas", icon: ClipboardList },
];

export const marketingSubs: SubItem[] = [
  { title: "CALENDARIO", url: "/marketing/calendario", icon: CalendarDays },
  { title: "CONTENIDO", url: "/marketing/contenido", icon: FolderOpen },
  { title: "CAMPAÑAS", url: "/marketing/campanas", icon: Send },
  { title: "CARTA DIGITAL", url: "/marketing/carta-digital", icon: QrCode },
  { title: "APP CLIENTES", url: "/marketing/app-clientes", icon: Smartphone },
  { title: "PÁGINA WEB", url: "/marketing/pagina-web", icon: Globe },
  { title: "FIDELIZACIÓN", url: "/marketing/fidelizacion", icon: Heart },
  { title: "CAPTACIÓN", url: "/marketing/captacion", icon: UserPlus },
];

export const contabilidadSubs: SubItem[] = [
  { title: "CONTACTOS", url: "/contabilidad/contactos", icon: ContactRound },
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

export const gestoriaSubs: SubItem[] = [
  { title: "MODELOS", url: "/gestoria/modelos", icon: FileSearch },
  { title: "PRESENTACIONES", url: "/gestoria/presentaciones", icon: FileUp },
  { title: "CONTRATACIONES", url: "/gestoria/contrataciones", icon: UserPlus },
];

export const juridicoSubs: SubItem[] = [
  { title: "PROCESOS", url: "/juridico/procesos", icon: Gavel },
];

// ─── Secciones del sidebar (departamentos) ─────────────────────────────────

export const allSections: Section[] = [
  { key: "direccion", modulo: "DIRECCIÓN", icon: Crown, label: "DIRECCIÓN", prefix: "/direccion", items: direccionSubs, linkTo: "/direccion", fase: 1 },
  { key: "sala", modulo: "SALA", icon: UtensilsCrossed, label: "SALA", prefix: "/sala", items: salaSubs, linkTo: "/sala", fase: 2 },
  { key: "cocina", modulo: "COCINA", icon: ChefHat, label: "COCINA", prefix: "/cocina", items: cocinaSubs, linkTo: "/cocina", fase: 2 },
  { key: "logistica", modulo: "LOGÍSTICA", icon: Package, label: "LOGÍSTICA", prefix: "/logistica", items: logisticaSubs, linkTo: "/logistica", fase: 1 },
  { key: "gerencia", modulo: "GERENCIA", icon: Briefcase, label: "GERENCIA", prefix: "/gerencia", items: gerenciaSubs, linkTo: "/gerencia", fase: 1 },
  { key: "rrhh", modulo: "RECURSOS HUMANOS", icon: User, label: "RECURSOS HUMANOS", prefix: "/rrhh", items: rrhhSubs, linkTo: "/rrhh", fase: 1 },
  { key: "marketing", modulo: "MARKETING", icon: Camera, label: "MARKETING", prefix: "/marketing", items: marketingSubs, linkTo: "/marketing", fase: 2 },
  { key: "contabilidad", modulo: "CONTABILIDAD", icon: Calculator, label: "CONTABILIDAD", prefix: "/contabilidad", items: contabilidadSubs, linkTo: "/contabilidad", fase: 2 },
  { key: "calidad", modulo: "CALIDAD", icon: CheckCircle2, label: "CALIDAD", prefix: "/calidad", items: calidadSubs, linkTo: "/calidad", fase: 1 },
  { key: "gestoria", modulo: "GESTORÍA", icon: FileText, label: "GESTORÍA", prefix: "/gestoria", items: gestoriaSubs, linkTo: "/gestoria", fase: 1 },
  { key: "juridico", modulo: "JURÍDICO", icon: Scale, label: "JURÍDICO", prefix: "/juridico", items: juridicoSubs, linkTo: "/juridico", fase: 1 },
];

// ─── Módulos (raíz: icono + label corto) ───────────────────────────────────

type ModuleMeta = { label: string; icon: IconType };

const MODULE_META: Record<string, ModuleMeta> = {
  "/": { label: "DASHBOARD", icon: LayoutDashboard },
  "/mi-panel": { label: "MIS PANELES", icon: UserCircle },
  "/mis-departamentos": { label: "MIS DEPARTAMENTOS", icon: Building2 },
  "/direccion": { label: "DIRECCIÓN", icon: Crown },
  "/sala": { label: "SALA", icon: UtensilsCrossed },
  "/cocina": { label: "COCINA", icon: ChefHat },
  "/gerencia": { label: "GERENCIA", icon: Briefcase },
  "/calidad": { label: "CALIDAD", icon: CheckCircle2 },
  "/rrhh": { label: "RRHH", icon: User },
  "/marketing": { label: "MARKETING", icon: Camera },
  "/logistica": { label: "LOGÍSTICA", icon: Package },
  "/contabilidad": { label: "CONTABILIDAD", icon: Calculator },
  "/gestoria": { label: "GESTORÍA", icon: FileText },
  "/juridico": { label: "JURÍDICO", icon: Scale },
  "/ajustes": { label: "AJUSTES", icon: Settings },
  "/ayuda": { label: "AYUDA", icon: HelpCircle },
  "/accesos": { label: "ACCESOS", icon: KeyRound },
  "/consultas-pendientes": { label: "CONSULTAS", icon: MessageSquareWarning },
  "/formacion": { label: "FORMACIÓN", icon: GraduationCap },
  "/reuniones": { label: "REUNIONES", icon: Video },
  "/agenda": { label: "AGENDA", icon: ContactRound },
};

// ─── Rutas extra (orphan: existen como leaf pero no salen en sidebar) ──────

const EXTRA_ROUTES: Record<string, { title: string; icon?: IconType }> = {
  "/mi-panel/formacion/curso": { title: "CURSO", icon: GraduationCap },
  "/direccion/cronogramas/productividad": { title: "PRODUCTIVIDAD", icon: TrendingUp },
  "/direccion/presentaciones/branding": { title: "BRANDING", icon: Presentation },
  "/logistica/fichas-tecnicas": { title: "FICHAS TÉCNICAS", icon: ClipboardList },
  "/logistica/partidas": { title: "PARTIDAS", icon: LayoutGrid },
  "/logistica/incidencias": { title: "INCIDENCIAS", icon: AlertTriangle },
  "/marketing/campanas/email": { title: "CAMPAÑAS — EMAIL", icon: Mail },
  "/marketing/campanas/meta": { title: "CAMPAÑAS — META", icon: Send },
  "/marketing/campanas/whatsapp": { title: "CAMPAÑAS — WHATSAPP", icon: MessageSquare },
  "/rrhh/comunicados": { title: "COMUNICADOS", icon: Megaphone },
  "/rrhh/puestos": { title: "PUESTOS", icon: Banknote },
};

// ─── Índice unificado: url → { title, icon } ───────────────────────────────

const ALL_SUBS: SubItem[] = [
  ...miPanelSubs,
  ...direccionSubs,
  ...salaSubs,
  ...cocinaSubs,
  ...logisticaSubs,
  ...gerenciaSubs,
  ...calidadSubs,
  ...rrhhSubs,
  ...marketingSubs,
  ...contabilidadSubs,
  ...gestoriaSubs,
  ...juridicoSubs,
];

const ROUTE_INDEX: Record<string, { title: string; icon?: IconType }> =
  Object.fromEntries([
    // 1. Módulos (raíz)
    ...Object.entries(MODULE_META).map(([url, m]) => [url, { title: m.label, icon: m.icon }] as const),
    // 2. Extras (orphan paths)
    ...Object.entries(EXTRA_ROUTES),
    // 3. Subitems del sidebar (fuente de verdad — pisa cualquier coincidencia)
    ...ALL_SUBS.map((s) => [s.url, { title: s.title, icon: s.icon }] as const),
  ]);

// ─── Helpers ───────────────────────────────────────────────────────────────

export function getModulePath(pathname: string): string {
  if (pathname === "/") return "/";
  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 0 ? `/${segments[0]}` : "/";
}

function getDynamicTitle(pathname: string): string {
  if (pathname.startsWith("/rrhh/empleados/")) return "FICHA EMPLEADO";
  if (pathname.startsWith("/gestoria/modelos/")) return "MODELO";
  if (pathname.startsWith("/direccion/presentaciones/")) {
    if (pathname.endsWith("/present")) return "PRESENTAR";
    if (pathname.endsWith("/print")) return "IMPRIMIR";
    return "PRESENTACIÓN";
  }
  if (pathname.startsWith("/marketing/pagina-web/")) {
    if (pathname.endsWith("/preview")) return "PREVIEW";
    if (pathname.endsWith("/dominios")) return "DOMINIOS";
    return "PÁGINA WEB";
  }
  return "";
}

/**
 * Devuelve título + icono para mostrar en el header.
 * Prioriza la entrada exacta de pathname; si no existe, intenta la raíz del módulo;
 * si tampoco, recurre a títulos dinámicos.
 */
export function getRouteMeta(pathname: string): { title: string; icon: IconType | null } {
  const exact = ROUTE_INDEX[pathname];
  if (exact) return { title: exact.title, icon: exact.icon ?? null };

  const moduleRoot = getModulePath(pathname);
  const dyn = getDynamicTitle(pathname);
  const moduleEntry = ROUTE_INDEX[moduleRoot];

  return {
    title: dyn || moduleEntry?.title || "",
    icon: moduleEntry?.icon ?? null,
  };
}

/** Label corto del módulo (para badges/breadcrumbs). */
export function getModuleLabel(pathname: string): string {
  return MODULE_META[getModulePath(pathname)]?.label ?? "";
}
