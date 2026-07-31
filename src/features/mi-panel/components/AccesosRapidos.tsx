"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Briefcase, Calculator, FileText, Scale, User, Camera,
  Crown, UtensilsCrossed, ChefHat, CheckCircle2, Package,
  Settings, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/contexts/auth-context";

interface Acceso {
  /** Nombre canónico del módulo en empresa_roles.permisos (con acentos). */
  modulo: string;
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

// El módulo de cada acceso usa el nombre REAL del permiso (empresa_roles),
// para filtrarse por `puedeVer` según el rol del usuario. Ajustes se muestra
// solo a admin de plataforma (no es un departamento con permiso propio).
const ACCESOS: Acceso[] = [
  { modulo: "DIRECCIÓN",       href: "/direccion",    label: "Dirección",    icon: Crown,          color: "text-amber-600" },
  { modulo: "SALA",            href: "/sala",         label: "Sala",         icon: UtensilsCrossed, color: "text-rose-600" },
  { modulo: "COCINA",          href: "/cocina",       label: "Cocina",       icon: ChefHat,        color: "text-orange-600" },
  { modulo: "GERENCIA",        href: "/gerencia",     label: "Gerencia",     icon: Briefcase,      color: "text-indigo-600" },
  { modulo: "CALIDAD",         href: "/calidad",      label: "Calidad",      icon: CheckCircle2,   color: "text-emerald-600" },
  { modulo: "RECURSOS HUMANOS", href: "/rrhh",        label: "RRHH",         icon: User,           color: "text-cyan-600" },
  { modulo: "MARKETING",       href: "/marketing",    label: "Marketing",    icon: Camera,         color: "text-pink-600" },
  { modulo: "LOGÍSTICA",       href: "/logistica",    label: "Logística",    icon: Package,        color: "text-violet-600" },
  { modulo: "CONTABILIDAD",    href: "/contabilidad", label: "Contabilidad", icon: Calculator,     color: "text-blue-600" },
  { modulo: "GESTORÍA",        href: "/gestoria",     label: "Gestoría",     icon: FileText,       color: "text-slate-600" },
  { modulo: "JURÍDICO",        href: "/juridico",     label: "Jurídico",     icon: Scale,          color: "text-stone-600" },
  { modulo: "AJUSTES",         href: "/ajustes",      label: "Ajustes",      icon: Settings,       color: "text-muted-foreground" },
];

export function AccesosRapidos() {
  const { puedeVer, permisosLoaded } = useAuth();

  const items = permisosLoaded ? ACCESOS.filter((a) => puedeVer(a.modulo)) : [];

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
