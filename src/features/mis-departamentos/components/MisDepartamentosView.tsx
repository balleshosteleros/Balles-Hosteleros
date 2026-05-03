"use client";

import Link from "next/link";
import { useAuth, type AppRole } from "@/features/auth/contexts/auth-context";
import { Card } from "@/components/ui/card";
import {
  Crown, UtensilsCrossed, ChefHat, Briefcase, CheckCircle2, User, Camera,
  Package, Calculator, FileText, Scale, type LucideIcon,
} from "lucide-react";

interface DepartamentoTile {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

const ALL_DEPARTAMENTOS: DepartamentoTile[] = [
  { key: "direccion",    label: "DIRECCIÓN",    href: "/direccion",    icon: Crown,           description: "Organigrama, cronogramas, aperturas",       color: "text-amber-600" },
  { key: "sala",         label: "SALA",         href: "/sala",         icon: UtensilsCrossed, description: "POS, reservas, clientes",                    color: "text-rose-600" },
  { key: "cocina",       label: "COCINA",       href: "/cocina",       icon: ChefHat,         description: "Comandas, fichas técnicas, partidas",        color: "text-orange-600" },
  { key: "gerencia",     label: "GERENCIA",     href: "/gerencia",     icon: Briefcase,       description: "Mantenimiento, cierres, ratios, comunicados", color: "text-blue-600" },
  { key: "calidad",      label: "CALIDAD",      href: "/calidad",      icon: CheckCircle2,    description: "Auditorías, inspecciones",                   color: "text-emerald-600" },
  { key: "rrhh",         label: "RECURSOS HUMANOS", href: "/rrhh",     icon: User,            description: "Empleados, fichajes, horarios, formación",   color: "text-violet-600" },
  { key: "marketing",    label: "MARKETING",    href: "/marketing",    icon: Camera,          description: "Calendario, campañas, fidelización",         color: "text-pink-600" },
  { key: "logistica",    label: "LOGÍSTICA",    href: "/logistica",    icon: Package,         description: "Proveedores, productos, pedidos, stock",     color: "text-teal-600" },
  { key: "contabilidad", label: "CONTABILIDAD", href: "/contabilidad", icon: Calculator,      description: "Facturas, transacciones, conciliación",      color: "text-cyan-600" },
  { key: "gestoria",     label: "GESTORÍA",     href: "/gestoria",     icon: FileText,        description: "Modelos y presentaciones",                   color: "text-slate-600" },
  { key: "juridico",     label: "JURÍDICO",     href: "/juridico",     icon: Scale,           description: "Procesos legales",                           color: "text-zinc-700" },
];

const ROLE_DEPARTAMENTOS: Record<AppRole, string[]> = {
  admin:        ["direccion", "sala", "cocina", "gerencia", "calidad", "rrhh", "marketing", "logistica", "contabilidad", "gestoria", "juridico"],
  director:     ["direccion", "sala", "cocina", "gerencia", "calidad", "rrhh", "marketing", "logistica", "contabilidad", "gestoria", "juridico"],
  gerencia:     ["gerencia", "rrhh", "calidad", "marketing", "logistica", "contabilidad"],
  responsable:  ["sala", "cocina", "gerencia", "rrhh", "calidad", "logistica"],
  empleado:     ["rrhh"],
  solo_lectura: ["gerencia"],
};

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  director: "Director",
  gerencia: "Gerencia",
  responsable: "Responsable",
  empleado: "Empleado",
  solo_lectura: "Solo lectura",
};

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
  const { profile, roles } = useAuth();
  const rolPrincipal: AppRole | null = roles[0] ?? null;
  const rolLabel = rolPrincipal ? ROLE_LABELS[rolPrincipal] : "—";
  const nombre = profile?.nombre ?? "";

  const claves = rolPrincipal ? ROLE_DEPARTAMENTOS[rolPrincipal] : [];
  const tiles = ALL_DEPARTAMENTOS.filter((d) => claves.includes(d.key));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          {rolLabel}
        </p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
          Mis departamentos{nombre ? `, ${nombre}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {dashboardSubtitlePorRol(rolPrincipal)}
        </p>
      </div>

      {tiles.length === 0 ? (
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
