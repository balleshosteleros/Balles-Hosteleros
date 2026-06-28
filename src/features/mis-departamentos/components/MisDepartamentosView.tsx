"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth, type AppRole } from "@/features/auth/contexts/auth-context";
import { Card } from "@/components/ui/card";
import {
  Crown, UtensilsCrossed, ChefHat, Briefcase, CheckCircle2, User, Camera,
  Package, Calculator, FileText, Scale, type LucideIcon,
} from "lucide-react";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_LARGOS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

function saludoSegunHora(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

interface DepartamentoTile {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

interface DepartamentoTileExt extends DepartamentoTile {
  modulo: string;
}

const ALL_DEPARTAMENTOS: DepartamentoTileExt[] = [
  { key: "direccion",    modulo: "DIRECCIÓN",        label: "DIRECCIÓN",    href: "/direccion",    icon: Crown,           description: "Organigrama, cronogramas, aperturas",       color: "text-amber-600" },
  { key: "sala",         modulo: "SALA",             label: "SALA",         href: "/sala",         icon: UtensilsCrossed, description: "POS, reservas, clientes",                    color: "text-rose-600" },
  { key: "cocina",       modulo: "COCINA",           label: "COCINA",       href: "/cocina",       icon: ChefHat,         description: "Comandas, escandallos, partidas",            color: "text-orange-600" },
  { key: "gerencia",     modulo: "GERENCIA",         label: "GERENCIA",     href: "/gerencia",     icon: Briefcase,       description: "Mantenimiento, cierres, ratios, comunicados", color: "text-blue-600" },
  { key: "calidad",      modulo: "CALIDAD",          label: "CALIDAD",      href: "/calidad",      icon: CheckCircle2,    description: "Auditorías, inspecciones",                   color: "text-emerald-600" },
  { key: "rrhh",         modulo: "RRHH",             label: "RECURSOS HUMANOS", href: "/rrhh",     icon: User,            description: "Empleados, fichajes, horarios, formación",   color: "text-violet-600" },
  { key: "marketing",    modulo: "MARKETING",        label: "MARKETING",    href: "/marketing",    icon: Camera,          description: "Calendario, campañas, fidelización",         color: "text-pink-600" },
  { key: "logistica",    modulo: "LOGÍSTICA",        label: "LOGÍSTICA",    href: "/logistica",    icon: Package,         description: "Proveedores, productos, pedidos, stock",     color: "text-teal-600" },
  { key: "contabilidad", modulo: "CONTABILIDAD",     label: "CONTABILIDAD", href: "/contabilidad", icon: Calculator,      description: "Facturas, transacciones, conciliación",      color: "text-cyan-600" },
  { key: "gestoria",     modulo: "GESTORÍA",         label: "GESTORÍA",     href: "/gestoria",     icon: FileText,        description: "Modelos y presentaciones",                   color: "text-sky-600" },
  { key: "juridico",     modulo: "JURÍDICO",         label: "JURÍDICO",     href: "/juridico",     icon: Scale,           description: "Procesos legales",                           color: "text-fuchsia-600" },
];

function dashboardSubtitlePorRol(rol: AppRole | null): string {
  if (!rol) return "Estos son tus departamentos asignados.";
  switch (rol) {
    case "admin":
    case "director":
      return "Tienes visión completa del grupo. Selecciona un departamento para entrar.";
    case "gerencia":
      return "Áreas operativas y económicas bajo tu supervisión.";
    case "responsable":
      return "Departamentos del día a día del local.";
    case "empleado":
      return "Estas son las áreas a las que tienes acceso.";
    case "solo_lectura":
      return "Tienes acceso de consulta sobre estos departamentos.";
    default:
      return "Estos son tus departamentos asignados.";
  }
}

export function MisDepartamentosView() {
  const { profile, user, roles, puedeVer, permisosLoaded, hasRole } = useAuth();
  const rolPrincipal: AppRole | null = roles[0] ?? null;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // El auth-context puede marcar `permisosLoaded=true` un instante ANTES de que
  // `roles` llegue poblado (carrera de cookies post-login + reintentos de
  // loadFreshAuth). En ese hueco un director aparece sin roles → se pinta en
  // falso "No tienes departamentos". Para evitarlo, durante unos segundos tras
  // montar tratamos "permisos cargados pero sin ningún rol" como todavía
  // cargando, dando tiempo a que el rol real resuelva.
  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => setGraceElapsed(true), 4000);
    return () => clearTimeout(t);
  }, [mounted]);
  const rolesPendientes = roles.length === 0 && !graceElapsed;

  const tiles = useMemo(() => {
    // 'director' / 'admin' tienen bypass total — ven todos los departamentos.
    if (hasRole("director") || hasRole("admin")) return ALL_DEPARTAMENTOS;
    // Hasta que carguen permisos no mostramos nada para evitar el parpadeo
    // "todo abierto" → "filtrado".
    if (!permisosLoaded) return [];
    return ALL_DEPARTAMENTOS.filter((d) => puedeVer(d.modulo));
  }, [hasRole, permisosLoaded, puedeVer]);

  // Loading hasta que (a) el componente esté montado y (b) los permisos hayan
  // resuelto. admin/director cortocircuitan en `tiles` sin esperar permisos.
  // `rolesPendientes` extiende el skeleton durante el periodo de gracia cuando
  // aún no ha llegado ningún rol, para no pintar "No tienes departamentos" en
  // falso mientras el rol (p.ej. director) termina de resolver.
  const isLoading =
    !mounted ||
    (!permisosLoaded && !hasRole("director") && !hasRole("admin")) ||
    rolesPendientes;

  const userName = profile?.nombre
    ? profile.apellidos
      ? `${profile.nombre} ${profile.apellidos}`
      : profile.nombre
    : (user?.email?.split("@")[0] ?? "");

  const today = mounted ? new Date() : null;
  const fechaLarga = today
    ? `${DIAS_LARGOS[today.getDay()]} ${today.getDate()} de ${MESES_LARGOS[today.getMonth()]}`
    : "";

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Cabecera — se renderiza solo tras montar para evitar hydration mismatch
          (saludo por hora local, fecha por zona local y subtítulo por rol cargado async). */}
      <div className="min-h-[5.5rem]">
        {mounted ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {saludoSegunHora()}{userName ? `, ${userName.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{fechaLarga}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {dashboardSubtitlePorRol(rolPrincipal)}
            </p>
          </>
        ) : null}
      </div>

      {isLoading ? (
        // Skeleton mientras montamos y resolvemos permisos. Evita el flash de
        // "No tienes departamentos asignados todavía" antes de que el contexto
        // de auth termine de cargar.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 h-[92px] animate-pulse bg-muted/40 border-muted" />
          ))}
        </div>
      ) : tiles.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No tienes departamentos asignados todavía.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((d) => {
            const Icon = d.icon;
            return (
              <Link key={d.key} href={d.href} className="group">
                <Card className="p-5 h-full border transition-all hover:border-primary/40 hover:shadow-md group-hover:-translate-y-0.5">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 rounded-xl bg-muted/60 p-3 ${d.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold tracking-wider uppercase truncate">
                        {d.label}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {d.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
