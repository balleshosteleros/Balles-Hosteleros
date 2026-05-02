"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Briefcase, Calculator, FileText, Scale, User, Camera,
  Crown, UtensilsCrossed, ChefHat, CheckCircle2, Package,
  Settings, type LucideIcon,
} from "lucide-react";
import { useAuth, type AppRole, ROLE_MODULES } from "@/features/auth/contexts/auth-context";

interface Acceso {
  modulo: string;
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const ACCESOS: Acceso[] = [
  { modulo: "*",            href: "/direccion",    label: "Dirección",    icon: Crown,          color: "text-amber-600" },
  { modulo: "*",            href: "/sala",         label: "Sala",         icon: UtensilsCrossed, color: "text-rose-600" },
  { modulo: "*",            href: "/cocina",       label: "Cocina",       icon: ChefHat,        color: "text-orange-600" },
  { modulo: "gerencia",     href: "/gerencia",     label: "Gerencia",     icon: Briefcase,      color: "text-indigo-600" },
  { modulo: "*",            href: "/calidad",      label: "Calidad",      icon: CheckCircle2,   color: "text-emerald-600" },
  { modulo: "rrhh",         href: "/rrhh",         label: "RRHH",         icon: User,           color: "text-cyan-600" },
  { modulo: "marketing",    href: "/marketing",    label: "Marketing",    icon: Camera,         color: "text-pink-600" },
  { modulo: "logistica",    href: "/logistica",    label: "Logística",    icon: Package,        color: "text-violet-600" },
  { modulo: "contabilidad", href: "/contabilidad", label: "Contabilidad", icon: Calculator,     color: "text-blue-600" },
  { modulo: "gestoria",     href: "/gestoria",     label: "Gestoría",     icon: FileText,       color: "text-slate-600" },
  { modulo: "juridico",     href: "/juridico",     label: "Jurídico",     icon: Scale,          color: "text-stone-600" },
  { modulo: "ajustes",      href: "/ajustes",      label: "Ajustes",      icon: Settings,       color: "text-muted-foreground" },
];

function rolPermite(roles: AppRole[], modulo: string): boolean {
  if (modulo === "*") {
    return roles.some((r) => ROLE_MODULES[r]?.includes("*"));
  }
  return roles.some((r) => {
    const allowed = ROLE_MODULES[r] ?? [];
    return allowed.includes("*") || allowed.includes(modulo);
  });
}

export function AccesosRapidos() {
  const { roles } = useAuth();

  const items = ACCESOS.filter((a) => {
    if (roles.length === 0) return false;
    if (a.modulo === "*") return roles.some((r) => ROLE_MODULES[r]?.includes("*"));
    return rolPermite(roles, a.modulo);
  });

  if (items.length === 0) return null;

  return (
    <Card className="p-4 md:p-5">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Mis accesos</h2>
        <p className="text-xs text-muted-foreground">Módulos disponibles según tu rol</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {items.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-center"
          >
            <a.icon className={`h-5 w-5 ${a.color}`} />
            <span className="text-[11px] font-medium leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
